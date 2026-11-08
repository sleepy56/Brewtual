import type { Prisma } from '@prisma/client';
import { ConflictError } from '../http/errors';

// Both invitation formats must distinguish a waiting space from an existing couple.
export async function joinPartnerSpace(tx: Prisma.TransactionClient, userId: string, pairId: string) {
  const current = await tx.membership.findUnique({ where: { userId } });
  if (current?.pairId === pairId) return tx.membership.findUniqueOrThrow({ where: { userId }, include: { pair: true } });
  const members = await tx.membership.findMany({ where: { pairId }, select: { slot: true } });
  if (members.length !== 1) throw new ConflictError('This partner space has no open place. Ask your partner to check their connection in Together.');
  const slot = members[0].slot === 1 ? 2 : 1;
  if (!current) return tx.membership.create({ data: { pairId, userId, slot }, include: { pair: true } });

  if (await tx.membership.count({ where: { pairId: current.pairId } }) !== 1) {
    throw new ConflictError('You are already connected to a partner. Open Together to see the linked account before joining another space.');
  }
  // Existing wallet history stays attached to its original space and is never rewritten.
  if (await tx.ledgerEntry.findFirst({ where: { pairId: current.pairId }, select: { id: true } })) {
    throw new ConflictError('Your waiting space has token history. Invite your partner into this space to keep that history intact.');
  }
  const scope = { scopeKind: 'PAIR' as const, scopeId: current.pairId };
  const now = new Date();
  await tx.invite.updateMany({ where: { pairId: current.pairId, acceptedAt: null }, data: { expiresAt: now } });
  await tx.connectionCode.updateMany({ where: { kind: 'partner', targetId: current.pairId }, data: { expiresAt: now } });
  // Membership foreign keys carry pending legacy habits, rewards, and invites with the owner.
  const member = await tx.membership.update({ where: { userId }, data: { pairId, slot }, include: { pair: true } });
  await tx.sharedNote.updateMany({ where: scope, data: { scopeId: pairId, version: { increment: 1 } } });
  await tx.taskShare.updateMany({ where: scope, data: { scopeId: pairId } });
  await tx.taskTokenProposal.updateMany({ where: { ...scope, status: 'ACTIVE' }, data: { status: 'PENDING', approvedById: null, approvedAt: null } });
  await tx.taskTokenProposal.updateMany({ where: scope, data: { scopeId: pairId } });
  await tx.spaceReward.updateMany({ where: { ...scope, status: 'ACTIVE' }, data: { status: 'PENDING', approvedById: null } });
  await tx.spaceReward.updateMany({ where: scope, data: { scopeId: pairId } });
  return member;
}
