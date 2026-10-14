import { ForbiddenException, Injectable } from '@nestjs/common';
import { Membership } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type PairMembership = Membership & {
  pair: { id: string; name: string; timezone: string; createdAt: Date };
};

@Injectable()
export class PairAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requirePair(userId: string): Promise<PairMembership> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      include: { pair: true },
    });
    if (!membership) throw new ForbiddenException('You are not in a pair');
    return membership as PairMembership;
  }
}
