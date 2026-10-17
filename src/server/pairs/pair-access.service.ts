import { ForbiddenError } from '../http/errors';
import { Membership } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type PairMembership = Membership & {
  pair: { id: string; name: string; timezone: string; createdAt: Date };
};

export class PairAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requirePair(userId: string): Promise<PairMembership> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      include: { pair: true },
    });
    if (!membership) throw new ForbiddenError('You are not in a pair');
    return membership as PairMembership;
  }
}
