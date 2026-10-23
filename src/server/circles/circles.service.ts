import { createHash, randomBytes } from 'node:crypto';
import type { PrismaService } from '../database/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
const hash = (code: string) => createHash('sha256').update(code).digest('hex');
export class CirclesService {
  constructor(private db: PrismaService) {}
  async requireMember(userId: string, circleId: string) {
    if (!await this.db.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } }))
      throw new ForbiddenError('Join this circle to see its goals.');
  }
  async list(userId: string) {
    return this.db.circle.findMany({ where: { members: { some: { userId } } }, include: {
      members: { select: { userId: true, user: { select: { id: true, email: true } } } },
      goals: { include: { cheers: { select: { userId: true } } } },
      offers: { include: { pledges: { select: { userId: true } } } },
    }, orderBy: { createdAt: 'asc' } });
  }
  async create(userId: string, name: string) {
    return this.db.circle.create({ data: { name, members: { create: { userId } } } });
  }
  async code(userId: string, kind: 'partner' | 'group', targetId: string) {
    if (kind === 'group') await this.requireMember(userId, targetId);
    else {
      const member = await this.db.membership.findUnique({ where: { userId } });
      if (member?.pairId !== targetId) throw new ForbiddenError('This is not your partner space.');
      if (await this.db.membership.count({ where: { pairId: targetId } }) !== 1) throw new ConflictError('Your partner space is full.');
    }
    const code = `${kind === 'partner' ? 'PAIR' : 'GROUP'}-${randomBytes(16).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await this.db.connectionCode.create({ data: { hash: hash(code), kind, targetId, creatorId: userId, expiresAt } });
    return { code, expiresAt };
  }
  async join(userId: string, code: string) {
    return this.db.runInTransaction(async tx => {
      const invite = await tx.connectionCode.findUnique({ where: { hash: hash(code) } });
      if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new NotFoundError('Code is invalid or expired.');
      if (invite.kind === 'group') {
        if (!await tx.circle.findUnique({ where: { id: invite.targetId } })) throw new NotFoundError('Circle no longer exists.');
        await tx.circleMember.upsert({ where: { circleId_userId: { circleId: invite.targetId, userId } }, create: { circleId: invite.targetId, userId }, update: {} });
      } else {
        if (invite.creatorId === userId) throw new ConflictError('Share this code with your partner.');
        if (await tx.membership.findUnique({ where: { userId } })) throw new ConflictError('You already have a partner space.');
        if (await tx.membership.count({ where: { pairId: invite.targetId } }) !== 1) throw new ConflictError('Partner space is full.');
        await tx.membership.create({ data: { pairId: invite.targetId, userId, slot: 2 } });
        await tx.connectionCode.update({ where: { hash: invite.hash }, data: { usedAt: new Date() } });
      }
      return { kind: invite.kind, targetId: invite.targetId };
    });
  }
  async goal(userId: string, circleId: string, title: string, target: number) {
    await this.requireMember(userId, circleId);
    return this.db.circleGoal.create({ data: { circleId, ownerId: userId, title, target } });
  }
  async progress(userId: string, circleId: string, id: string, progress: number) {
    await this.requireMember(userId, circleId);
    return this.db.runInTransaction(async tx => {
      const goal = await tx.circleGoal.findUnique({ where: { id } });
      if (!goal || goal.circleId !== circleId || goal.ownerId !== userId) throw new ForbiddenError('Only the owner can update this goal.');
      if (progress > goal.target) throw new ConflictError('Progress cannot exceed the target.');
      return tx.circleGoal.update({ where: { id }, data: { progress } });
    });
  }
  async cheer(userId: string, circleId: string, goalId: string) {
    await this.requireMember(userId, circleId);
    if (!await this.db.circleGoal.findFirst({ where: { id: goalId, circleId } })) throw new NotFoundError('Goal not found.');
    return this.db.circleCheer.upsert({ where: { goalId_userId: { goalId, userId } }, create: { goalId, circleId, userId }, update: {} });
  }
  async offer(userId: string, circleId: string, goalId: string, title: string) {
    await this.requireMember(userId, circleId);
    if (!await this.db.circleGoal.findFirst({ where: { id: goalId, circleId } })) throw new NotFoundError('Choose a goal in this circle.');
    return this.db.circleOffer.create({ data: { circleId, authorId: userId, goalId, title } });
  }
  async pledge(userId: string, circleId: string, offerId: string) {
    await this.requireMember(userId, circleId);
    if (!await this.db.circleOffer.findFirst({ where: { id: offerId, circleId } })) throw new NotFoundError('Offer not found.');
    return this.db.circlePledge.upsert({ where: { offerId_userId: { offerId, userId } }, create: { offerId, circleId, userId }, update: {} });
  }
}
