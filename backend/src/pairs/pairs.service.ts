import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PairAccessService } from './pair-access.service';

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class PairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairAccess: PairAccessService,
  ) {}

  async createPair(user: AuthenticatedUser, name: string, timezone: string) {
    const cleanName = name.trim();
    if (!cleanName) throw new ConflictException('Pair name is required');
    try {
      return await this.prisma.runInTransaction(async (tx) => {
        const existing = await tx.membership.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (existing) throw new ConflictException('You already belong to a pair');

        const pair = await tx.pair.create({
          data: { name: cleanName, timezone },
        });
        await tx.membership.create({
          data: { pairId: pair.id, userId: user.id, slot: 1 },
        });
        return pair;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isUniqueViolation(error)) {
        throw new ConflictException('You already belong to a pair');
      }
      throw error;
    }
  }

  async current(userId: string) {
    return this.pairAccess.requirePair(userId);
  }

  async createInvite(user: AuthenticatedUser, email: string) {
    const recipient = normalizeEmail(email);
    if (recipient === normalizeEmail(user.email)) {
      throw new ConflictException('You cannot invite yourself');
    }
    const membership = await this.pairAccess.requirePair(user.id);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_LIFETIME_MS);

    try {
      await this.prisma.runInTransaction(async (tx) => {
        const members = await tx.membership.count({
          where: { pairId: membership.pairId },
        });
        if (members !== 1) throw new ConflictException('Pair has no open member slot');

        const pending = await tx.invite.findFirst({
          where: {
            pairId: membership.pairId,
            acceptedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true },
        });
        if (pending) {
          throw new ConflictException('An active invite already exists for this pair');
        }

        await tx.invite.create({
          data: {
            pairId: membership.pairId,
            createdById: user.id,
            email: recipient,
            tokenHash,
            expiresAt,
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isUniqueViolation(error)) {
        throw new ConflictException('An active invite already exists for this pair');
      }
      throw error;
    }
    return { token, expiresAt };
  }

  async acceptInvite(user: AuthenticatedUser, token: string) {
    const tokenHash = hashToken(token);
    const now = new Date();
    try {
      return await this.prisma.runInTransaction(async (tx) => {
        const invite = await tx.invite.findUnique({
          where: { tokenHash },
          include: { pair: true },
        });
        if (!invite) throw new NotFoundException('Invite is invalid or expired');
        if (invite.acceptedAt) throw new ConflictException('Invite has already been used');
        if (invite.expiresAt <= now) {
          throw new ConflictException('Invite is invalid or expired');
        }
        if (normalizeEmail(invite.email) !== normalizeEmail(user.email)) {
          throw new ForbiddenException('Invite was issued to another email address');
        }
        if (invite.createdById === user.id) {
          throw new ConflictException('You cannot accept your own invite');
        }

        const existingMembership = await tx.membership.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (existingMembership) {
          throw new ConflictException('You already belong to a pair');
        }
        const members = await tx.membership.count({
          where: { pairId: invite.pairId },
        });
        if (members !== 1) throw new ConflictException('Pair has no open member slot');

        const membership = await tx.membership.create({
          data: { pairId: invite.pairId, userId: user.id, slot: 2 },
          include: { pair: true },
        });
        const updated = await tx.invite.updateMany({
          where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Invite has already been used or expired');
        }
        return membership;
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException('You already belong to a pair or the pair is full');
      }
      throw error;
    }
  }
}
