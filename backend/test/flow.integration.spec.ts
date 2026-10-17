import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import request from 'supertest';
import { Clock } from '../src/domain/clock';
import { PrismaService } from '../src/database/prisma.service';
import { setupApp } from '../src/http/setup-app';
import { hashPassword } from '../src/auth/password';
import { VerificationMailService } from '../src/auth/verification-mail.service';

describe('two-person API flow against PostgreSQL', () => {
  const secret = 'integration-only-key-with-at-least-32-characters';
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const emails = ['alice@example.com', 'bob@example.com', 'outsider@example.com'];
  const schema = `test_${randomUUID().replace(/-/g, '')}`;
  let app: INestApplication | undefined;
  let admin: PrismaClient | undefined;
  let db: PrismaService;
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  let tokens: string[];
  let goalId: string;
  let rewardId: string;
  let redemptionId: string;
  let inviteToken: string;
  let pairId: string;
  let now = new Date('2026-10-11T10:00:00Z');

  const get = (person: number, path: string) => request(app!.getHttpServer()).get(`/api/v1${path}`).auth(tokens[person], { type: 'bearer' });
  const post = (person: number, path: string) => request(app!.getHttpServer()).post(`/api/v1${path}`).auth(tokens[person], { type: 'bearer' });

  beforeAll(async () => {
    const connection = process.env.TEST_DATABASE_URL;
    if (!connection) throw new Error('Set TEST_DATABASE_URL to a local PostgreSQL database. Tests create and remove only an isolated test schema.');
    admin = new PrismaClient({ datasourceUrl: connection });
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const scoped = new URL(connection);
    scoped.searchParams.set('schema', schema);
    process.env.DATABASE_URL = scoped.toString();
    process.env.DATABASE_URL_UNPOOLED = scoped.toString();
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'local';
    process.env.LOCAL_AUTH_SECRET = secret;
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, stdio: 'pipe', timeout: 30000 });
    tokens = await Promise.all(ids.map((id, index) => new SignJWT({ email: emails[index] })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuer('group-quests-local')
      .setAudience('group-quests-api').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret))));
    // Import after setting startup environment: ConfigModule validates at import.
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock).useValue({ now: () => now })
      .overrideProvider(VerificationMailService).useValue(mail).compile();
    app = module.createNestApplication({ logger: false });
    setupApp(app);
    await app.init();
    db = app.get(PrismaService);
  }, 60000);

  afterAll(async () => {
    await app?.close();
    if (admin) {
      if (!/^test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  });

  it('exposes health and rejects unauthenticated requests', async () => {
    await request(app!.getHttpServer()).get('/api/v1/health').expect(200, { status: 'ok' });
    await request(app!.getHttpServer()).get('/api/v1/health/ready').expect(200, { status: 'ready' });
    await request(app!.getHttpServer()).get('/api/v1/goals').expect(401);
    await post(0, '/pairs').send({ name: 'Private pair', timezone: 'Invalid/Timezone' }).expect(400);
    await post(0, '/pairs').send({ name: 'Private pair', timezone: 'Asia/Calcutta', admin: true }).expect(400);
  });

  it('pairs only the invited email and prevents duplicate membership and used invites', async () => {
    pairId = (await post(0, '/pairs').send({ name: 'Private pair', timezone: 'Asia/Calcutta' }).expect(201)).body.id;
    await post(0, '/pairs').send({ name: 'Duplicate', timezone: 'UTC' }).expect(409);
    inviteToken = (await post(0, '/pairs/invites').send({ email: emails[1] }).expect(201)).body.token;
    await post(2, '/pairs/invites/accept').send({ token: inviteToken }).expect(403);
    await post(1, '/pairs/invites/accept').send({ token: inviteToken }).expect(201);
    await post(1, '/pairs/invites/accept').send({ token: inviteToken }).expect(409);
    await post(0, '/pairs/invites').send({ email: emails[2] }).expect(409);
    await post(2, '/pairs').send({ name: 'Other pair', timezone: 'UTC' }).expect(201);
    expect(await db.membership.count({ where: { pairId } })).toBe(2);
  });

  it('requires partner approval and scopes every goal to its pair', async () => {
    await post(0, '/goals').send({ title: 'Invalid target', weekdays: [1], requiredCount: 2, weeklyTokens: 10 }).expect(400);
    await post(0, '/goals').send({ title: 'Duplicate weekdays', weekdays: [1, 1], requiredCount: 1, weeklyTokens: 10 }).expect(400);
    goalId = (await post(0, '/goals').send({ title: 'Go for a walk', weekdays: [1, 3, 5], requiredCount: 2, weeklyTokens: 10 }).expect(201)).body.id;
    await post(0, `/goals/${goalId}/approve`).expect(403);
    await post(2, `/goals/${goalId}/approve`).expect(404);
    expect((await get(2, '/goals').expect(200)).body).toEqual([]);
    const approved = (await post(1, `/goals/${goalId}/approve`).expect(201)).body;
    expect(approved.startsOn).toBe('2026-10-12');
    await post(0, `/goals/${goalId}/check-ins`).expect(409);
    await post(1, `/goals/${goalId}/check-ins`).expect(403);
  });

  it('stores one eligible same-day check-in and allows same-day undo', async () => {
    now = new Date('2026-10-12T10:00:00Z');
    const checkIns = await Promise.all([post(0, `/goals/${goalId}/check-ins`), post(0, `/goals/${goalId}/check-ins`)]);
    expect(checkIns.map(result => result.status)).toEqual([201, 201]);
    expect(checkIns[0].body.id).toBe(checkIns[1].body.id);
    expect(await db.checkIn.count({ where: { goalId } })).toBe(1);
    const undone = await request(app!.getHttpServer()).delete(`/api/v1/goals/${goalId}/check-ins/today`).auth(tokens[0], { type: 'bearer' }).expect(200);
    expect(undone.body.removed).toBe(true);
    await post(0, `/goals/${goalId}/check-ins`).expect(201);
    now = new Date('2026-10-13T10:00:00Z');
    await post(0, `/goals/${goalId}/check-ins`).send({ localDate: '2026-10-12' }).expect(400);
    now = new Date('2026-10-14T10:00:00Z');
    await post(0, `/goals/${goalId}/check-ins`).expect(201);
    expect(await db.checkIn.count({ where: { goalId } })).toBe(2);
  });

  it('settles only a closed local week once, including concurrent retries and missed weeks', async () => {
    // A second active goal records a missed week without creating debt.
    now = new Date('2026-10-11T10:00:00Z');
    const missed = (await post(0, '/goals').send({ title: 'Read', weekdays: [1], requiredCount: 1, weeklyTokens: 20 }).expect(201)).body;
    await post(1, `/goals/${missed.id}/approve`).expect(201);
    now = new Date('2026-10-18T18:29:59Z'); // Sunday 23:59:59 in the pair timezone.
    expect((await post(0, '/wallet/settle').expect(201)).body.processed).toBe(0);
    now = new Date('2026-10-18T18:30:00Z'); // Monday local midnight.
    const results = await Promise.all([post(0, '/wallet/settle'), post(1, '/wallet/settle')]);
    expect(results.map(result => result.status)).toEqual([201, 201]);
    expect(await db.weeklySettlement.count()).toBe(2);
    expect(await db.ledgerEntry.count()).toBe(1);
    expect((await get(0, '/wallet').expect(200)).body.balance).toBe(10);
    expect((await get(1, '/wallet').expect(200)).body.balance).toBe(0);
    expect((await get(2, '/wallet/ledger').expect(200)).body).toEqual([]);
    expect((await post(0, '/wallet/settle').expect(201)).body.processed).toBe(0);
    expect((await db.weeklySettlement.findFirstOrThrow({ where: { goalId: missed.id } })).awardedTokens).toBe(0);
  });

  it('approves partner rewards and makes repeated concurrent redemption safe', async () => {
    rewardId = (await post(1, '/rewards').send({ title: 'Choose the weekend activity', fulfillmentExpectation: 'Plan together this weekend', cost: 7 }).expect(201)).body.id;
    await post(1, `/rewards/${rewardId}/approve`).expect(403);
    await post(0, `/rewards/${rewardId}/approve`).expect(201);
    await post(1, `/rewards/${rewardId}/redeem`).set('Idempotency-Key', 'self-redeem-key').expect(403);
    await post(0, `/rewards/${rewardId}/redeem`).expect(400);
    const results = await Promise.all([
      post(0, `/rewards/${rewardId}/redeem`).set('Idempotency-Key', 'first-redemption'),
      post(0, `/rewards/${rewardId}/redeem`).set('Idempotency-Key', 'first-redemption'),
    ]);
    expect(results.map(result => result.status)).toEqual([201, 201]);
    redemptionId = results[0].body.id;
    expect(results[1].body.id).toBe(redemptionId);
    expect(results[0].body.cost).toBe(7);
    expect((await get(0, '/wallet').expect(200)).body.balance).toBe(3);
    expect(await db.redemption.count()).toBe(1);
  });

  it('rolls back unaffordable spending and serializes competing spends', async () => {
    const expensive = (await post(1, '/rewards').send({ title: 'An outing', fulfillmentExpectation: 'Choose a date', cost: 4 }).expect(201)).body;
    await post(0, `/rewards/${expensive.id}/approve`).expect(201);
    await post(0, `/rewards/${expensive.id}/redeem`).set('Idempotency-Key', 'too-expensive').expect(409);
    expect((await get(0, '/wallet').expect(200)).body.balance).toBe(3);
    expect(await db.redemption.count()).toBe(1);
    const small = (await post(1, '/rewards').send({ title: 'Pick a shared hobby', fulfillmentExpectation: 'Arrange together', cost: 2 }).expect(201)).body;
    await post(0, `/rewards/${small.id}/approve`).expect(201);
    await post(0, `/rewards/${small.id}/redeem`).set('Idempotency-Key', 'first-redemption').expect(409);
    const races = await Promise.all([
      post(0, `/rewards/${small.id}/redeem`).set('Idempotency-Key', 'competing-spend-a'),
      post(0, `/rewards/${small.id}/redeem`).set('Idempotency-Key', 'competing-spend-b'),
    ]);
    expect(races.map(result => result.status).sort()).toEqual([201, 409]);
    expect((await get(0, '/wallet').expect(200)).body.balance).toBe(1);
    expect(await db.redemption.count()).toBe(2);
    expect(await db.ledgerEntry.count()).toBe(3);
  });

  it('lets only the offerer fulfill a request and protects the ledger at the database boundary', async () => {
    await post(0, `/rewards/redemptions/${redemptionId}/fulfill`).expect(403);
    await post(2, `/rewards/redemptions/${redemptionId}/fulfill`).expect(404);
    expect((await post(1, `/rewards/redemptions/${redemptionId}/fulfill`).expect(201)).body.status).toBe('FULFILLED');
    await post(1, `/rewards/redemptions/${redemptionId}/fulfill`).expect(201);
    const entry = await db.ledgerEntry.findFirstOrThrow();
    await expect(db.ledgerEntry.update({ where: { id: entry.id }, data: { amount: 999 } })).rejects.toThrow();
    await expect(db.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow();
    await expect(db.membership.create({ data: { pairId, userId: ids[2], slot: 3 } })).rejects.toThrow();
    expect((await get(0, '/wallet').expect(200)).body.balance).toBe(1);
  });

  it('logs in, rotates browser cookies, rejects replay, and revokes access on logout', async () => {
    process.env.AUTH_MODE = 'jwt'; process.env.JWT_SECRET = secret;
    try {
      await db.user.update({ where: { id: ids[0] }, data: { passwordHash: await hashPassword('individual password for Alice'), emailVerifiedAt: new Date() } });
      const browserPost = (path: string) => request(app!.getHttpServer()).post(`/api/v1/auth/${path}`).set('Origin', 'http://localhost:3000');
      await browserPost('login').send({ email: emails[0], password: 'wrong', client: 'web' }).expect(401);
      await browserPost('login').send({ email: emails[0], password: 'anything', client: 'web', admin: true }).expect(400);
      await request(app!.getHttpServer()).post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({ email: emails[0], password: 'individual password for Alice', client: 'web' }).expect(403);
      const login = await browserPost('login').send({ email: emails[0], password: 'individual password for Alice', client: 'web' }).expect(201);
      expect(login.body).not.toHaveProperty('refreshToken');
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
      await request(app!.getHttpServer()).get('/api/v1/me').auth(login.body.accessToken, { type: 'bearer' }).expect(200, { id: ids[0], email: emails[0] });
      const rotated = await browserPost('refresh').set('Cookie', cookie).send({ client: 'web' }).expect(201);
      const nextCookie = rotated.headers['set-cookie'][0].split(';')[0];
      expect(nextCookie).not.toBe(cookie);
      await browserPost('refresh').set('Cookie', cookie).send({ client: 'web' }).expect(401);
      await browserPost('logout').set('Cookie', nextCookie).send({ client: 'web' }).expect(201);
      await browserPost('refresh').set('Cookie', nextCookie).send({ client: 'web' }).expect(401);
      await request(app!.getHttpServer()).get('/api/v1/me').auth(rotated.body.accessToken, { type: 'bearer' }).expect(401);
    } finally { process.env.AUTH_MODE = 'local'; }
  });

  it('verifies signup once, rejects expired tokens and blocks unverified credentials', async () => {
    process.env.AUTH_MODE = 'jwt'; process.env.JWT_SECRET = secret;
    const origin = 'http://localhost:3000';
    const browserPost = (path: string) => request(app!.getHttpServer()).post(`/api/v1/auth/${path}`).set('Origin', origin);
    const email = `signup-${randomUUID()}@example.com`;
    const password = 'a unique registration password';
    try {
      const signup = await browserPost('signup').send({ email, password, client: 'web' }).expect(202);
      const token = mail.send.mock.lastCall[1] as string;
      const pending = await db.pendingSignup.findUniqueOrThrow({ where: { email } });
      expect(pending.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      await browserPost('verify/confirm').send({ email, token, password: 'wrong registration password', client: 'web' }).expect(400);
      const confirmations = await Promise.all([
        browserPost('verify/confirm').send({ email, token, password, client: 'web' }),
        browserPost('verify/confirm').send({ email, token, password, client: 'web' }),
      ]);
      expect(confirmations.map(result => result.status).sort()).toEqual([201, 400]);
      await browserPost('verify/confirm').send({ email, token, password, client: 'web' }).expect(400);
      expect(await db.user.findUnique({ where: { email } })).toMatchObject({ email, emailVerifiedAt: expect.any(Date) });
      await browserPost('signup').send({ email, password: 'attacker chosen password', client: 'web' }).expect(202, signup.body);
      expect(mail.send).toHaveBeenCalledTimes(1);

      const failedEmail = `mail-failure-${randomUUID()}@example.com`;
      mail.send.mockRejectedValueOnce(new Error('provider details must stay private'));
      await browserPost('signup').send({ email: failedEmail, password, client: 'web' }).expect(503);
      expect(await db.pendingSignup.findUnique({ where: { email: failedEmail } })).toBeNull();

      const expiredEmail = `expired-${randomUUID()}@example.com`;
      await browserPost('signup').send({ email: expiredEmail, password, client: 'web' }).expect(202);
      const expiredToken = mail.send.mock.lastCall[1] as string;
      await db.pendingSignup.update({ where: { email: expiredEmail }, data: { expiresAt: new Date(0) } });
      await browserPost('verify/confirm').send({ email: expiredEmail, token: expiredToken, password, client: 'web' }).expect(400);

      const unverifiedEmail = `unverified-${randomUUID()}@example.com`;
      const unverified = await db.user.create({ data: { email: unverifiedEmail, passwordHash: await hashPassword(password) } });
      const refreshToken = 'a'.repeat(43);
      const session = await db.authSession.create({ data: { userId: unverified.id, tokenHash: createHash('sha256').update(refreshToken).digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
      await browserPost('login').send({ email: unverifiedEmail, password, client: 'web' }).expect(401);
      await request(app!.getHttpServer()).post('/api/v1/auth/refresh').send({ client: 'native', refreshToken }).expect(401);
      const accessToken = await new SignJWT({ sid: session.id }).setProtectedHeader({ alg: 'HS256' })
        .setSubject(unverified.id).setIssuer('pair-habits').setAudience('pair-habits-api').setExpirationTime('5m')
        .sign(new TextEncoder().encode(secret));
      await request(app!.getHttpServer()).get('/api/v1/me').auth(accessToken, { type: 'bearer' }).expect(401);
    } finally { process.env.AUTH_MODE = 'local'; }
  });

  it('runs two verified FAKE-mail signups through pairing, goal approval and reward redemption', async () => {
    process.env.AUTH_MODE = 'jwt'; process.env.JWT_SECRET = secret;
    const postAuth = (path: string) => request(app!.getHttpServer()).post(`/api/v1/auth/${path}`);
    const registered = [0, 1].map(index => ({ email: `full-flow-${randomUUID()}@example.com`, password: `individual test password ${index}` }));
    // Isolate the two test clients from the earlier signup-rate-limit cases.
    app!.getHttpAdapter().getInstance().set('trust proxy', 1);
    try {
      for (const [index, account] of registered.entries()) {
        const clientIp = `198.51.100.${index + 1}`;
        await postAuth('signup').set('x-forwarded-for', clientIp).send({ ...account, client: 'native' }).expect(202);
        const token = mail.send.mock.lastCall[1] as string; // Fake mail captures the confirmation token; it never sends email.
        await postAuth('verify/confirm').set('x-forwarded-for', clientIp).send({ ...account, token, client: 'native' }).expect(201, { verified: true });
      }
      const logins = await Promise.all(registered.map((account, index) => postAuth('login').set('x-forwarded-for', `198.51.100.${index + 1}`).send({ ...account, client: 'native' }).expect(201)));
      tokens[0] = logins[0].body.accessToken; tokens[1] = logins[1].body.accessToken;
      pairId = (await post(0, '/pairs').send({ name: 'Signup flow pair', timezone: 'UTC' }).expect(201)).body.id;
      inviteToken = (await post(0, '/pairs/invites').send({ email: registered[1].email }).expect(201)).body.token;
      await post(1, '/pairs/invites/accept').send({ token: inviteToken }).expect(201);
      const pair = await get(0, '/pairs/current').expect(200);
      expect(pair.body.members.map((member: { user: { email: string } }) => member.user.email)).toEqual(registered.map(account => account.email));

      const goal = (await post(0, '/goals').send({ title: 'Daily walk', weekdays: [1, 3, 5], requiredCount: 2, weeklyTokens: 3 }).expect(201)).body;
      await post(1, `/goals/${goal.id}/approve`).expect(201);
      expect((await get(0, '/goals').expect(200)).body[0].status).toBe('ACTIVE');

      const reward = (await post(0, '/rewards').send({ title: 'Choose a movie', fulfillmentExpectation: 'Plan a movie night together', cost: 2 }).expect(201)).body;
      await post(1, `/rewards/${reward.id}/approve`).expect(201);
      await db.ledgerEntry.create({ data: { pairId, userId: logins[1].body.user.id, amount: 2, reason: 'WEEKLY_AWARD', sourceId: randomUUID(), idempotencyKey: `test-credit:${randomUUID()}` } });
      const redemption = (await post(1, `/rewards/${reward.id}/redeem`).set('Idempotency-Key', 'verified-signup-redemption').expect(201)).body;
      await post(0, `/rewards/redemptions/${redemption.id}/fulfill`).expect(201);
      expect((await get(1, '/wallet').expect(200)).body.balance).toBe(0);
    } finally { process.env.AUTH_MODE = 'local'; }
  });
});
