import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const email = 'alex@example.com';
const password = 'a long registration password';

describe('Email verification', () => {
  const environment = { ...process.env };
  let prisma: any;
  let mail: { send: jest.Mock };
  let auth: AuthService;

  beforeEach(() => {
    process.env.AUTH_MODE = 'jwt';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      pendingSignup: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      runInTransaction: jest.fn(async callback => callback(prisma)),
    };
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    auth = new AuthService(prisma, mail as never);
  });
  afterAll(() => { process.env = environment; });

  it('creates an immediately usable account without mail by default and removes stale pending signup', async () => {
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    mail.send.mockRejectedValue(new Error('SMTP is unavailable'));
    const result = await auth.signup(' ALEX@example.com ', password);
    expect(result.verificationRequired).toBe(false);
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.email).toBe(email);
    expect(data).not.toHaveProperty('emailVerifiedAt');
    expect(await verifyPassword(password, data.passwordHash)).toBe(true);
    expect(prisma.pendingSignup.deleteMany).toHaveBeenCalledWith({ where: { email } });
    await expect(auth.resendVerification(email)).resolves.toEqual(result);
    expect(prisma.pendingSignup.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not overwrite existing accounts or hide database failures when verification is off', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    const result = await auth.signup(email, password);
    prisma.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate email', { code: 'P2002', clientVersion: 'test' }));
    await expect(auth.signup(email, 'another long password')).resolves.toEqual(result);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
    prisma.user.create.mockRejectedValue(new Error('Database unavailable'));
    await expect(auth.signup(email, password)).rejects.toThrow('Database unavailable');
  });

  it('does not overwrite an existing account or reveal whether it exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ email, emailVerifiedAt: new Date() });
    const existing = await auth.signup(email, password);
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await auth.resendVerification(email);
    expect(existing).toEqual(unknown);
    expect(prisma.pendingSignup.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('stores only a hashed one-use token and a scrypt password hash', async () => {
    await auth.signup(' ALEX@example.com ', password);
    const { data } = prisma.pendingSignup.create.mock.calls[0][0];
    const [recipient, token] = mail.send.mock.calls[0];
    expect(recipient).toBe(email);
    expect(data.tokenHash).toBe(digest(token));
    expect(data.tokenHash).not.toBe(token);
    expect(await verifyPassword(password, data.passwordHash)).toBe(true);
    expect(data.expiresAt.getTime() - data.lastSentAt.getTime()).toBe(30 * 60 * 1000);
  });

  it('verifies legacy accounts without replacing their ID or password', async () => {
    const passwordHash = await hashPassword(password);
    const existing = { id: 'legacy-user', email, passwordHash, emailVerifiedAt: null };
    prisma.user.findUnique.mockResolvedValue(existing);
    await auth.signup(email, 'an attacker chosen different password');
    const pending = prisma.pendingSignup.create.mock.calls[0][0].data;
    expect(pending.passwordHash).toBe(passwordHash);
    prisma.pendingSignup.findUnique.mockResolvedValue(pending);
    const token = mail.send.mock.calls[0][1];
    await expect(auth.confirmVerification(email, token, 'an attacker chosen different password')).rejects.toThrow('invalid or expired');
    await auth.confirmVerification(email, token, password);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: existing.id, emailVerifiedAt: null, passwordHash },
      data: { passwordHash, emailVerifiedAt: expect.any(Date) },
    });
  });

  it('clears a pending registration and hides provider errors when mail fails', async () => {
    mail.send.mockRejectedValue(new Error('secret SMTP token'));
    await expect(auth.signup(email, password)).rejects.toThrow('Verification email is unavailable');
    expect(prisma.pendingSignup.deleteMany).toHaveBeenCalledWith({ where: {
      email, tokenHash: prisma.pendingSignup.create.mock.calls[0][0].data.tokenHash,
    } });
  });

  it('enforces persistent resend cooldown, hourly cap and expiry', async () => {
    const pending = { email, tokenHash: 'old', passwordHash: await hashPassword(password),
      expiresAt: new Date(Date.now() + 60000), lastSentAt: new Date(), windowStart: new Date(), sendCount: 1 };
    prisma.pendingSignup.findUnique.mockResolvedValue(pending);
    await auth.resendVerification(email);
    pending.lastSentAt = new Date(Date.now() - 61000);
    pending.sendCount = 5;
    await auth.resendVerification(email);
    pending.expiresAt = new Date(0);
    pending.sendCount = 1;
    await auth.resendVerification(email);
    expect(prisma.pendingSignup.updateMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('requires the registration password, rejects expiry and consumes concurrently only once', async () => {
    const token = 'a'.repeat(43);
    const pending = { email, tokenHash: digest(token), passwordHash: await hashPassword(password), expiresAt: new Date(Date.now() + 60000) };
    prisma.pendingSignup.findUnique.mockResolvedValue(pending);
    await expect(auth.confirmVerification(email, token, 'wrong password')).rejects.toThrow('invalid or expired');
    await expect(auth.confirmVerification('other@example.com', token, password)).rejects.toThrow('invalid or expired');
    expect(prisma.runInTransaction).not.toHaveBeenCalled();
    let consumed = false;
    prisma.pendingSignup.deleteMany.mockImplementation(async () => {
      if (consumed) return { count: 0 };
      consumed = true;
      return { count: 1 };
    });
    const results = await Promise.allSettled([
      auth.confirmVerification(email, token, password), auth.confirmVerification(email, token, password),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create.mock.calls[0][0].data).toEqual({ email, passwordHash: pending.passwordHash, emailVerifiedAt: expect.any(Date) });
    await expect(auth.confirmVerification(email, token, password)).rejects.toThrow('invalid or expired');
    pending.expiresAt = new Date(0);
    await expect(auth.confirmVerification(email, token, password)).rejects.toThrow('invalid or expired');
  });
});
