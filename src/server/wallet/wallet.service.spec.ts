import { WalletService } from './wallet.service';
import { PrismaService } from '../database/prisma.service';
import { PairAccessService } from '../pairs/pair-access.service';
import { Clock } from '../domain/clock';
import { Prisma } from '@prisma/client';

describe('WalletService weekly settlements', () => {
  const membership = { pairId: 'pair-id', pair: { timezone: 'Asia/Kolkata' } };
  let service: WalletService;
  let tx: any;
  let prisma: any;

  beforeEach(() => {
    tx = {
      goal: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'goal-id',
          ownerId: 'owner-id',
          startsOn: '2026-10-12',
          weekdays: [1, 3, 5],
          requiredCount: 2,
          weeklyTokens: 3,
        }]),
      },
      weeklySettlement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'settlement-id', ...data })),
      },
      checkIn: {
        findMany: jest.fn().mockResolvedValue([
          { localDate: '2026-10-12' },
          { localDate: '2026-10-14' },
          { localDate: '2026-10-15' },
        ]),
      },
      ledgerEntry: { create: jest.fn().mockResolvedValue({ id: 'ledger-id' }) },
    };
    prisma = { runInTransaction: jest.fn((callback) => callback(tx)) };
    const access = { requirePair: jest.fn().mockResolvedValue(membership) };
    const clock = { now: jest.fn().mockReturnValue(new Date('2026-10-18T19:00:00.000Z')) };
    service = new WalletService(prisma as PrismaService, access as unknown as PairAccessService, clock as Clock);
  });

  it('awards the configured amount once when scheduled check-ins meet the weekly target', async () => {
    const result = await service.settle('owner-id');

    expect(tx.weeklySettlement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        goalId: 'goal-id',
        weekStart: '2026-10-12',
        completedCount: 2,
        requiredCount: 2,
        awardedTokens: 3,
      }),
    }));
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 3, userId: 'owner-id', reason: 'WEEKLY_AWARD' }),
    }));
    expect(result).toEqual({ settlements: [expect.objectContaining({ awardedTokens: 3 })], hasMore: false, processed: 1 });
  });

  it('records a closed missed week with zero tokens and no ledger entry', async () => {
    tx.goal.findMany.mockResolvedValueOnce([{
      id: 'goal-id',
      ownerId: 'owner-id',
      startsOn: '2026-10-12',
      weekdays: [1, 3, 5],
      requiredCount: 2,
      weeklyTokens: 3,
    }]);
    tx.checkIn.findMany.mockResolvedValueOnce([]);

    const result = await service.settle('owner-id');

    expect(tx.weeklySettlement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ completedCount: 0, awardedTokens: 0 }),
    }));
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    expect(result.processed).toBe(1);
  });

  it('retries a weekly-settlement unique race and returns the committed result', async () => {
    const uniqueRace = new Prisma.PrismaClientKnownRequestError('duplicate weekly settlement', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { modelName: 'WeeklySettlement', target: ['goalId', 'weekStart'] },
    });
    tx.goal.findMany.mockResolvedValueOnce([]);
    prisma.runInTransaction
      .mockRejectedValueOnce(uniqueRace)
      .mockImplementationOnce((callback: (txArg: any) => Promise<unknown>) => callback(tx));

    const result = await service.settle('owner-id');

    expect(prisma.runInTransaction).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ settlements: [], hasMore: false, processed: 0 });
  });
});
