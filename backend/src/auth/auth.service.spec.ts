import { createHash } from 'node:crypto';
import { jwtVerify } from 'jose';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password';

const secret = 'a-test-signing-key-with-at-least-32-characters';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'alex@example.com', passwordHash: '' };

describe('Password authentication', () => {
  const environment = { ...process.env };
  let prisma: any;
  let auth: AuthService;

  beforeAll(async () => { user.passwordHash = await hashPassword('a unique and long password'); });
  beforeEach(() => {
    process.env.AUTH_MODE = 'jwt'; process.env.JWT_SECRET = secret;
    process.env.JWT_ISSUER = 'pair-habits'; process.env.JWT_AUDIENCE = 'pair-habits-api';
    prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) }, authSession: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: user.id, ...data })),
      findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    } };
    auth = new AuthService(prisma);
  });
  afterAll(() => { process.env = environment; });

  it('salts passwords independently and rejects wrong passwords', async () => {
    const hash = await hashPassword('a unique and long password');
    expect(hash).not.toEqual(user.passwordHash);
    expect(await verifyPassword('a unique and long password', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('anything', 'malformed')).toBe(false);
  });

  it('issues a short-lived session JWT and stores only a refresh token hash', async () => {
    const session = await auth.login(' ALEX@example.com ', 'a unique and long password');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(prisma.authSession.create.mock.calls[0][0].data.tokenHash).toEqual(createHash('sha256').update(session.refreshToken).digest('hex'));
    const { payload } = await jwtVerify(session.accessToken, new TextEncoder().encode(secret), { issuer: 'pair-habits', audience: 'pair-habits-api' });
    expect(payload.sub).toBe(user.id); expect(payload.sid).toBe(user.id);
    expect(payload.exp! - payload.iat!).toBe(900);
    expect(session.user).not.toHaveProperty('passwordHash');
  });

  it('returns identical errors for unknown accounts and wrong passwords', async () => {
    await expect(auth.login(user.email, 'wrong')).rejects.toThrow('Email or password is incorrect');
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(auth.login('unknown@example.com', 'wrong')).rejects.toThrow('Email or password is incorrect');
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('does not enable password login in local token mode', async () => {
    process.env.AUTH_MODE = 'local';
    await expect(auth.login(user.email, 'anything')).rejects.toThrow('requires JWT');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rotates credentials conditionally and refuses a concurrent replay', async () => {
    const token = 'a'.repeat(43);
    prisma.authSession.findUnique.mockResolvedValue({ id: user.id, userId: user.id, user, revokedAt: null, expiresAt: new Date(Date.now() + 60000) });
    const session = await auth.refresh(token);
    expect(session.refreshToken).not.toBe(token);
    expect(prisma.authSession.updateMany.mock.calls[0][0].where.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(auth.refresh(token)).rejects.toThrow('Session expired');
  });

  it.each([null, { revokedAt: new Date(), expiresAt: new Date(Date.now() + 60000) }, { revokedAt: null, expiresAt: new Date(0) }])('rejects unavailable sessions', async session => {
    prisma.authSession.findUnique.mockResolvedValue(session);
    await expect(auth.refresh('a'.repeat(43))).rejects.toThrow('Session expired');
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('revokes the session on logout', async () => {
    await auth.logout('a'.repeat(43));
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({ where: { tokenHash: createHash('sha256').update('a'.repeat(43)).digest('hex'), revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });
});
