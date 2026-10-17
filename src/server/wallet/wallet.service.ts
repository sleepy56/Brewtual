
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PairAccessService } from '../pairs/pair-access.service';
import { Clock } from '../domain/clock';
import { addLocalDays, localDate, localWeekday, weekStart } from '../domain/calendar';

const SETTLEMENT_LIMIT = 104;
const SETTLEMENT_RACE_RETRIES = 3;

function isSettlementUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = error.meta as { modelName?: string; target?: string | string[] } | undefined;
  if (meta?.modelName === 'WeeklySettlement') return true;
  const target = Array.isArray(meta?.target) ? meta.target.join(',') : meta?.target ?? '';
  return target.includes('goalId') && target.includes('weekStart');
}

export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairAccess: PairAccessService,
    private readonly clock: Clock,
  ) {}

  async balance(userId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    const aggregate = await this.prisma.ledgerEntry.aggregate({
      where: { pairId: membership.pairId, userId },
      _sum: { amount: true },
    });
    return { userId, balance: aggregate._sum.amount ?? 0 };
  }

  async ledger(userId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.ledgerEntry.findMany({
      where: { pairId: membership.pairId, userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async settle(userId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    const now = this.clock.now();
    const today = localDate(now, membership.pair.timezone);
    const currentWeek = weekStart(today);
    const lastClosedWeek = addLocalDays(currentWeek, -7);

    const settleBatch = async (raceRetry = 0) => {
      try {
        return await this.prisma.runInTransaction(async (tx) => {
          const goals = await tx.goal.findMany({
            where: {
              pairId: membership.pairId,
              status: 'ACTIVE',
              startsOn: { lte: lastClosedWeek },
              settlements: { none: { weekStart: lastClosedWeek } },
            },
            take: SETTLEMENT_LIMIT + 1,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });

          const candidates: Array<{ goal: (typeof goals)[number]; weekStart: string }> = [];
          for (const goal of goals) {
            if (!goal.startsOn) continue;
            // Settlement rows are created in order from startsOn and a whole weekly batch
            // commits atomically. The latest row therefore identifies the next unsettled week.
            const latest = await tx.weeklySettlement.findFirst({
              where: { goalId: goal.id, weekStart: { lte: lastClosedWeek } },
              orderBy: { weekStart: 'desc' },
              select: { weekStart: true },
            });
            let monday = latest ? addLocalDays(latest.weekStart, 7) : goal.startsOn;
            for (; monday <= lastClosedWeek && candidates.length <= SETTLEMENT_LIMIT; monday = addLocalDays(monday, 7)) {
              candidates.push({ goal, weekStart: monday });
            }
            if (candidates.length > SETTLEMENT_LIMIT) break;
          }

          const batch = candidates.slice(0, SETTLEMENT_LIMIT);
          const settlements = [];
          for (const { goal, weekStart: monday } of batch) {
            const weekEnd = addLocalDays(monday, 6);
            const checkIns = await tx.checkIn.findMany({
              where: { goalId: goal.id, localDate: { gte: monday, lte: weekEnd } },
              select: { localDate: true },
            });
            const scheduledDates = checkIns
              .filter((checkIn) => goal.weekdays.includes(localWeekday(checkIn.localDate)))
              .map((checkIn) => checkIn.localDate);
            const completedCount = new Set(scheduledDates).size;
            const awardedTokens = completedCount >= goal.requiredCount ? goal.weeklyTokens : 0;
            const settlement = await tx.weeklySettlement.create({
              data: {
                goalId: goal.id,
                weekStart: monday,
                completedCount,
                requiredCount: goal.requiredCount,
                awardedTokens,
              },
            });
            if (awardedTokens > 0) {
              await tx.ledgerEntry.create({
                data: {
                  pairId: membership.pairId,
                  userId: goal.ownerId,
                  amount: awardedTokens,
                  reason: 'WEEKLY_AWARD',
                  sourceId: settlement.id,
                  idempotencyKey: `weekly-award:${goal.id}:${monday}`,
                },
              });
            }
            settlements.push(settlement);
          }
          return { settlements, hasMore: candidates.length > batch.length, processed: batch.length };
        });
      } catch (error) {
        if (raceRetry < SETTLEMENT_RACE_RETRIES && isSettlementUniqueConflict(error)) {
          return settleBatch(raceRetry + 1);
        }
        throw error;
      }
    };
    return settleBatch();
  }
}
