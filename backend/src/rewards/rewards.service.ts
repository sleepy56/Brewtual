import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PairAccessService } from '../pairs/pair-access.service';
import { Clock } from '../domain/clock';
import { CreateRewardDto } from './dto/create-reward.dto';

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairAccess: PairAccessService,
    private readonly clock: Clock,
  ) {}

  async list(userId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.reward.findMany({
      where: { pairId: membership.pairId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateRewardDto) {
    const membership = await this.pairAccess.requirePair(userId);
    if (!dto.title.trim() || !dto.fulfillmentExpectation.trim()) {
      throw new BadRequestException('title and fulfillmentExpectation cannot be empty');
    }
    return this.prisma.reward.create({
      data: {
        pairId: membership.pairId,
        offeredById: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        fulfillmentExpectation: dto.fulfillmentExpectation.trim(),
        cost: dto.cost,
        status: 'PENDING',
      },
    });
  }

  async approve(userId: string, rewardId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.runInTransaction(async (tx) => {
      const reward = await tx.reward.findFirst({ where: { id: rewardId, pairId: membership.pairId } });
      if (!reward) throw new NotFoundException('Reward not found');
      if (reward.offeredById === userId) throw new ForbiddenException('The offerer cannot approve their own reward');
      if (reward.status !== 'PENDING') throw new ConflictException('Reward is no longer pending approval');
      const result = await tx.reward.updateMany({
        where: { id: reward.id, pairId: membership.pairId, status: 'PENDING' },
        data: { status: 'ACTIVE', approvedById: userId, approvedAt: this.clock.now() },
      });
      if (result.count !== 1) throw new ConflictException('Reward is no longer pending approval');
      return tx.reward.findUniqueOrThrow({ where: { id: reward.id } });
    });
  }

  async reject(userId: string, rewardId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.runInTransaction(async (tx) => {
      const reward = await tx.reward.findFirst({ where: { id: rewardId, pairId: membership.pairId } });
      if (!reward) throw new NotFoundException('Reward not found');
      if (reward.offeredById === userId) throw new ForbiddenException('The offerer cannot reject their own reward');
      if (reward.status !== 'PENDING') throw new ConflictException('Reward is no longer pending review');
      const result = await tx.reward.updateMany({
        where: { id: reward.id, pairId: membership.pairId, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      if (result.count !== 1) throw new ConflictException('Reward is no longer pending review');
      return tx.reward.findUniqueOrThrow({ where: { id: reward.id } });
    });
  }

  async redeem(userId: string, rewardId: string, idempotencyKey: string) {
    const membership = await this.pairAccess.requirePair(userId);
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key must contain 8 to 128 characters');
    }

    try {
      return await this.prisma.runInTransaction(async (tx) => {
        const prior = await tx.redemption.findUnique({
          where: { spenderId_idempotencyKey: { spenderId: userId, idempotencyKey } },
        });
        if (prior) {
          if (prior.rewardId !== rewardId || prior.pairId !== membership.pairId) {
            throw new ConflictException('This Idempotency-Key was already used for a different reward');
          }
          return prior;
        }

        const reward = await tx.reward.findFirst({ where: { id: rewardId, pairId: membership.pairId } });
        if (!reward) throw new NotFoundException('Reward not found');
        if (reward.offeredById === userId) throw new ForbiddenException('You cannot redeem your own reward');
        if (reward.status !== 'ACTIVE') throw new ConflictException('Only approved rewards can be redeemed');

        const balance = await tx.ledgerEntry.aggregate({
          where: { pairId: membership.pairId, userId },
          _sum: { amount: true },
        });
        const available = balance._sum.amount ?? 0;
        if (available < reward.cost) throw new ConflictException('Insufficient token balance');

        const redemption = await tx.redemption.create({
          data: {
            pairId: membership.pairId,
            rewardId,
            spenderId: userId,
            cost: reward.cost,
            idempotencyKey,
            status: 'REQUESTED',
          },
        });
        await tx.ledgerEntry.create({
          data: {
            pairId: membership.pairId,
            userId,
            amount: -reward.cost,
            reason: 'REWARD_REDEMPTION',
            sourceId: redemption.id,
            idempotencyKey: `redemption:${redemption.id}`,
          },
        });
        return redemption;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const prior = await this.prisma.redemption.findUnique({
          where: { spenderId_idempotencyKey: { spenderId: userId, idempotencyKey } },
        });
        if (prior) {
          if (prior.rewardId !== rewardId || prior.pairId !== membership.pairId) {
            throw new ConflictException('This Idempotency-Key was already used for a different reward');
          }
          return prior;
        }
      }
      throw error;
    }
  }

  async redemptions(userId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.redemption.findMany({
      where: { pairId: membership.pairId },
      include: { reward: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async fulfill(userId: string, redemptionId: string) {
    const membership = await this.pairAccess.requirePair(userId);
    return this.prisma.runInTransaction(async (tx) => {
      const redemption = await tx.redemption.findFirst({
        where: { id: redemptionId, pairId: membership.pairId },
        include: { reward: true },
      });
      if (!redemption) throw new NotFoundException('Redemption not found');
      if (redemption.reward.offeredById !== userId) {
        throw new ForbiddenException('Only the reward offerer can mark it fulfilled');
      }
      if (redemption.status === 'FULFILLED') return redemption;
      const fulfilledAt = this.clock.now();
      const result = await tx.redemption.updateMany({
        where: { id: redemption.id, pairId: membership.pairId, status: 'REQUESTED' },
        data: { status: 'FULFILLED', fulfilledAt },
      });
      if (result.count !== 1) throw new ConflictException('Redemption is no longer awaiting fulfillment');
      return tx.redemption.findUniqueOrThrow({ where: { id: redemption.id } });
    });
  }
}
