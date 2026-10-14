import { ForbiddenException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { PrismaService } from '../database/prisma.service';
import { PairAccessService } from '../pairs/pair-access.service';
import { Clock } from '../domain/clock';

describe('GoalsService approval and check-in rules', () => {
  const goal = {
    id: 'goal-id',
    pairId: 'pair-id',
    ownerId: 'owner-id',
    proposedById: 'owner-id',
    title: 'Walk',
    description: null,
    weekdays: [1, 3, 5],
    requiredCount: 2,
    weeklyTokens: 4,
    status: 'PENDING',
    startsOn: null,
  };
  const membership = { pairId: 'pair-id', pair: { timezone: 'Asia/Kolkata' } };
  let service: GoalsService;
  let tx: any;
  let prisma: any;
  let access: any;
  let clock: any;

  beforeEach(() => {
    tx = {
      goal: {
        findFirst: jest.fn().mockResolvedValue(goal),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...goal, status: 'ACTIVE', startsOn: '2026-10-12' }),
      },
      checkIn: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'check-in-id' }),
      },
    };
    prisma = { runInTransaction: jest.fn((callback) => callback(tx)) };
    access = { requirePair: jest.fn().mockResolvedValue(membership) };
    clock = { now: jest.fn().mockReturnValue(new Date('2026-10-05T02:00:00.000Z')) };
    service = new GoalsService(prisma as PrismaService, access as PairAccessService, clock as Clock);
  });

  it('activates only after the other partner approves and sets the next local Monday', async () => {
    await service.approve('partner-id', 'goal-id');
    expect(tx.goal.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'goal-id', pairId: 'pair-id', status: 'PENDING' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        approvedById: 'partner-id',
        startsOn: '2026-10-12',
      }),
    }));
  });

  it('blocks a proposer from approving their own goal', async () => {
    await expect(service.approve('owner-id', 'goal-id')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.goal.updateMany).not.toHaveBeenCalled();
  });
});
