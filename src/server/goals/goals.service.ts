import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PairAccessService } from '../pairs/pair-access.service';
import { Clock } from '../domain/clock';
import { localDate, localWeekday, nextMondayAfter } from '../domain/calendar';
import { CreateGoal } from '../schemas';

export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairAccess: PairAccessService,
    private readonly clock: Clock,
  ) {}

  async list(userId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.goal.findMany({
      where: { pairId: membership.pairId },
      include: { checkIns: { orderBy: { localDate: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateGoal) {
    const membership = await this.pairAccess.requirePair(userId);
    if (!dto.title.trim()) throw new BadRequestError('title cannot be empty');
    if (dto.requiredCount > dto.weekdays.length) {
      throw new BadRequestError('requiredCount cannot exceed the number of scheduled weekdays');
    }
    return this.prisma.goal.create({
      data: {
        pairId: membership.pairId,
        ownerId: userId,
        proposedById: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        weekdays: dto.weekdays,
        requiredCount: dto.requiredCount,
        weeklyTokens: dto.weeklyTokens,
        status: 'PENDING',
      },
    });
  }

  async approve(userId: string, goalId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.runInTransaction(async (tx) => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, pairId: membership.pairId } });
      if (!goal) throw new NotFoundError('Goal not found');
      if (goal.proposedById === userId) throw new ForbiddenError('The proposer cannot approve their own goal');
      if (goal.status !== 'PENDING') throw new ConflictError('Goal is no longer pending approval');

      const now = this.clock.now();
      const result = await tx.goal.updateMany({
        where: { id: goal.id, pairId: membership.pairId, status: 'PENDING' },
        data: {
          status: 'ACTIVE',
          approvedById: userId,
          approvedAt: now,
          startsOn: nextMondayAfter(now, membership.pair.timezone),
        },
      });
      if (result.count !== 1) throw new ConflictError('Goal is no longer pending approval');
      return tx.goal.findUniqueOrThrow({ where: { id: goal.id } });
    });
  }

  async reject(userId: string, goalId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.runInTransaction(async (tx) => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, pairId: membership.pairId } });
      if (!goal) throw new NotFoundError('Goal not found');
      if (goal.proposedById === userId) throw new ForbiddenError('The proposer cannot reject their own goal');
      if (goal.status !== 'PENDING') throw new ConflictError('Goal is no longer pending review');
      const result = await tx.goal.updateMany({
        where: { id: goal.id, pairId: membership.pairId, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      if (result.count !== 1) throw new ConflictError('Goal is no longer pending review');
      return tx.goal.findUniqueOrThrow({ where: { id: goal.id } });
    });
  }

  async checkIn(userId: string, goalId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    const today = localDate(this.clock.now(), membership.pair.timezone);
    try {
      return await this.prisma.runInTransaction(async (tx) => {
        const goal = await tx.goal.findFirst({ where: { id: goalId, pairId: membership.pairId } });
        if (!goal) throw new NotFoundError('Goal not found');
        if (goal.ownerId !== userId) throw new ForbiddenError('Only the goal owner can check in');
        if (goal.status !== 'ACTIVE') throw new ConflictError('Only active goals can be checked in');
        if (!goal.startsOn || today < goal.startsOn) throw new ConflictError('This goal is not eligible for check-ins yet');
        if (!goal.weekdays.includes(localWeekday(today))) throw new BadRequestError('Today is not a scheduled day for this goal');

        const existing = await tx.checkIn.findUnique({ where: { goalId_localDate: { goalId, localDate: today } } });
        if (existing) return existing;
        return tx.checkIn.create({ data: { goalId, userId, localDate: today } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.checkIn.findUnique({ where: { goalId_localDate: { goalId, localDate: today } } });
        if (raced) return raced;
      }
      throw error;
    }
  }

  async undoToday(userId: string, goalId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    const today = localDate(this.clock.now(), membership.pair.timezone);
    return this.prisma.runInTransaction(async (tx) => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, pairId: membership.pairId } });
      if (!goal) throw new NotFoundError('Goal not found');
      if (goal.ownerId !== userId) throw new ForbiddenError('Only the goal owner can undo a check-in');
      const result = await tx.checkIn.deleteMany({ where: { goalId, userId, localDate: today } });
      return { removed: result.count === 1, localDate: today };
    });
  }
}
