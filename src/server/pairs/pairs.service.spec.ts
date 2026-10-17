import { ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { PairAccessService } from './pair-access.service';
import { PairsService } from './pairs.service';

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'one@example.com' };
const pair = { id: '22222222-2222-4222-8222-222222222222', name: 'Us', timezone: 'UTC' };

describe('PairAccessService', () => {
  it('returns membership with its pair, and denies users without membership', async () => {
    const membership = { id: 'membership', pairId: pair.id, userId: user.id, slot: 1, pair };
    const prisma = { membership: { findUnique: jest.fn().mockResolvedValue(membership) } };
    await expect(new PairAccessService(prisma as never).requirePair(user.id)).resolves.toBe(
      membership,
    );

    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(new PairAccessService(prisma as never).requirePair(user.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('PairsService invite handling', () => {
  const makeService = (tx: Record<string, any>) => {
    const prisma = {
      runInTransaction: jest.fn((fn: (transaction: any) => unknown) => fn(tx)),
    };
    const access = {
      requirePair: jest.fn().mockResolvedValue({ pairId: pair.id, pair }),
    };
    return { service: new PairsService(prisma as never, access as never), access };
  };

  it('refuses invitations to the current user and never creates them', async () => {
    const tx = { membership: { count: jest.fn() }, invite: { create: jest.fn() } };
    const { service } = makeService(tx);
    await expect(service.createInvite(user, ' ONE@example.com ')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(tx.membership.count).not.toHaveBeenCalled();
  });

  it('replaces an open invite when the inviter changes the partner email', async () => {
    const tx = {
      membership: { count: jest.fn().mockResolvedValue(1) },
      invite: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prior' }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const { service } = makeService(tx);
    await expect(service.createInvite(user, 'two@example.com')).resolves.toMatchObject({
      token: expect.any(String),
      expiresAt: expect.any(Date),
    });
    expect(tx.invite.update).toHaveBeenCalledWith({
      where: { id: 'prior' },
      data: { expiresAt: expect.any(Date) },
    });
    expect(tx.invite.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'two@example.com' }),
    }));
  });

  it.each([
    ['unknown token', null, user, NotFoundError],
    [
      'expired token',
      { id: 'invite', acceptedAt: null, expiresAt: new Date(0), email: user.email, createdById: 'other', pairId: pair.id, pair },
      user,
      ConflictError,
    ],
    [
      'wrong recipient',
      { id: 'invite', acceptedAt: null, expiresAt: new Date(Date.now() + 60_000), email: 'other@example.com', createdById: 'other', pairId: pair.id, pair },
      user,
      ForbiddenError,
    ],
    [
      'a user who already belongs to a pair',
      { id: 'invite', acceptedAt: null, expiresAt: new Date(Date.now() + 60_000), email: user.email, createdById: 'other', pairId: pair.id, pair },
      user,
      ConflictError,
    ],
  ])('rejects %s', async (_case, invite, acceptingUser, expected) => {
    const tx = {
      invite: { findUnique: jest.fn().mockResolvedValue(invite) },
      membership: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing' }),
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    const { service } = makeService(tx);
    await expect(service.acceptInvite(acceptingUser as typeof user, 'some-token')).rejects.toBeInstanceOf(
      expected as new (...args: never[]) => Error,
    );
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it('requires membership before reading or creating pair invitations', async () => {
    const access = { requirePair: jest.fn().mockRejectedValue(new ForbiddenError()) };
    const service = new PairsService({} as never, access as never);
    await expect(service.createInvite(user, 'two@example.com')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(access.requirePair).toHaveBeenCalledWith(user.id);
  });
});
