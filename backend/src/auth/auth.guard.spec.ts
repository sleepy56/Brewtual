import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SignJWT } from 'jose';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

const localSecret = 'test-only-secret-with-at-least-thirty-two-characters';
const subject = '11111111-1111-4111-8111-111111111111';

describe('AuthGuard', () => {
  const originalEnv = { ...process.env };
  let prisma: { user: { upsert: jest.Mock } };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    process.env.AUTH_MODE = 'local';
    process.env.NODE_ENV = 'test';
    process.env.LOCAL_AUTH_SECRET = localSecret;
    prisma = { user: { upsert: jest.fn().mockResolvedValue({}) } };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new AuthGuard(reflector as unknown as Reflector, prisma as never);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows public routes without parsing a token or connecting to the database', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('verifies a local JWT and synchronizes its authenticated identity', async () => {
    const token = await new SignJWT({ email: 'User@Example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setIssuer('group-quests-local')
      .setAudience('group-quests-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(localSecret));
    const request = { headers: { authorization: `Bearer ${token}` } };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request).toHaveProperty('user', { id: subject, email: 'user@example.com' });
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: subject },
      create: { id: subject, email: 'user@example.com' },
      update: { email: 'user@example.com' },
    });
  });

  it.each([
    [
      'missing expiration',
      async () =>
        new SignJWT({ email: 'user@example.com' })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(subject)
          .setIssuer('group-quests-local')
          .setAudience('group-quests-api')
          .setIssuedAt()
          .sign(new TextEncoder().encode(localSecret)),
    ],
    [
      'expired token',
      async () =>
        new SignJWT({ email: 'user@example.com' })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(subject)
          .setIssuer('group-quests-local')
          .setAudience('group-quests-api')
          .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
          .sign(new TextEncoder().encode(localSecret)),
    ],
    [
      'wrong audience',
      async () =>
        new SignJWT({ email: 'user@example.com' })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(subject)
          .setIssuer('group-quests-local')
          .setAudience('another-api')
          .setExpirationTime('5m')
          .sign(new TextEncoder().encode(localSecret)),
    ],
    [
      'bad signature',
      async () =>
        new SignJWT({ email: 'user@example.com' })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(subject)
          .setIssuer('group-quests-local')
          .setAudience('group-quests-api')
          .setExpirationTime('5m')
          .sign(new TextEncoder().encode('a different key with enough length to sign')),
    ],
  ])('rejects a token with %s', async (_case, createToken) => {
    const token = await (createToken as () => Promise<string>)();
    const request = { headers: { authorization: `Bearer ${token}` } };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects missing bearer credentials and unsupported local auth environments', async () => {
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    process.env.NODE_ENV = 'production';
    const withToken = {
      ...context,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer anything' } }),
      }),
    };
    await expect(guard.canActivate(withToken as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
