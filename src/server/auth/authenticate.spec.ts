import { SignJWT } from 'jose';
import { Authenticator } from './authenticate';
import { UnauthorizedError } from '../http/errors';

const secret = 'test-only-secret-with-at-least-thirty-two-characters';
const subject = '11111111-1111-4111-8111-111111111111';
describe('Bearer authentication', () => {
  const environment = { ...process.env };
  let db: any;
  let identity: Authenticator;
  beforeEach(() => {
    process.env.AUTH_MODE = 'local';
    process.env.NODE_ENV = 'test';
    process.env.LOCAL_AUTH_SECRET = secret;
    db = {
      user: { upsert: jest.fn(), findUnique: jest.fn() },
      authSession: { findUnique: jest.fn() },
    };
    identity = new Authenticator(db);
  });
  afterAll(() => {
    process.env = environment;
  });
  const token = (
    key = secret,
    audience = 'group-quests-api',
    expiration: string | number | null = '5m',
  ) => {
    let jwt = new SignJWT({ email: 'User@Example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setIssuer('group-quests-local')
      .setAudience(audience);
    if (expiration !== null) jwt = jwt.setExpirationTime(expiration);
    return jwt.sign(new TextEncoder().encode(key));
  };
  it('verifies a local token and synchronizes its identity', async () => {
    await expect(identity.authenticate(`Bearer ${await token()}`)).resolves.toEqual({
      id: subject,
      email: 'user@example.com',
    });
    expect(db.user.upsert).toHaveBeenCalledWith({
      where: { id: subject },
      create: { id: subject, email: 'user@example.com' },
      update: { email: 'user@example.com' },
    });
  });
  it.each([
    ['missing expiration', () => token(secret, 'group-quests-api', null)],
    ['expired', () => token(secret, 'group-quests-api', Math.floor(Date.now() / 1000) - 60)],
    ['wrong audience', () => token(secret, 'other-api')],
    ['bad signature', () => token('another-key-with-at-least-32-characters')],
  ])('rejects %s', async (_name, create) => {
    await expect(identity.authenticate(`Bearer ${await create()}`)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(db.user.upsert).not.toHaveBeenCalled();
  });
  it('rejects missing credentials and local tokens in production', async () => {
    await expect(identity.authenticate(null)).rejects.toBeInstanceOf(UnauthorizedError);
    process.env.NODE_ENV = 'production';
    await expect(identity.authenticate(`Bearer ${await token()}`)).rejects.toThrow(
      'Local authentication is disabled',
    );
    expect(db.user.upsert).not.toHaveBeenCalled();
  });
  it('requires a verified account and an active revocable first-party session', async () => {
    process.env.AUTH_MODE = 'jwt';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = secret;
    process.env.JWT_ISSUER = 'pair-habits';
    process.env.JWT_AUDIENCE = 'pair-habits-api';
    db.user.findUnique.mockResolvedValue({
      id: subject,
      email: 'registered@example.com',
      emailVerifiedAt: new Date(),
    });
    db.authSession.findUnique.mockResolvedValue({
      userId: subject,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    const jwt = await new SignJWT({ sid: subject })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setIssuer('pair-habits')
      .setAudience('pair-habits-api')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    await expect(identity.authenticate(`Bearer ${jwt}`)).resolves.toEqual({
      id: subject,
      email: 'registered@example.com',
    });
    expect(db.user.upsert).not.toHaveBeenCalled();
    db.authSession.findUnique.mockResolvedValue({
      userId: subject,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await expect(identity.authenticate(`Bearer ${jwt}`)).rejects.toThrow('Session expired');
    db.user.findUnique.mockResolvedValue(null);
    await expect(identity.authenticate(`Bearer ${jwt}`)).rejects.toThrow('Account is unavailable');
    db.user.findUnique.mockResolvedValue({ id: subject, emailVerifiedAt: null });
    await expect(identity.authenticate(`Bearer ${jwt}`)).rejects.toThrow('Account is unavailable');
  });
});
