import { createApi } from './api';
import type { Services } from './services';
import { UnauthorizedError } from './http/errors';

describe('Next API contract', () => {
  let api: ReturnType<typeof createApi>;
  let services: any;
  const env = { ...process.env };
  const request = (
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
    method = data === undefined ? 'GET' : 'POST',
  ) =>
    api(
      new Request(`https://app.example.com/api/v1${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://app.example.com',
          ...headers,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      }),
    );
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    services = {
      db: { $queryRaw: jest.fn().mockResolvedValue([]) },
      identity: {
        authenticate: jest.fn().mockRejectedValue(new UnauthorizedError('Bearer token required')),
      },
      auth: {
        signup: jest.fn().mockResolvedValue({ message: 'Check email' }),
        resendVerification: jest.fn(),
        confirmVerification: jest.fn().mockResolvedValue({ verified: true }),
        login: jest
          .fn()
          .mockResolvedValue({
            accessToken: 'access',
            refreshToken: 'r'.repeat(43),
            user: { id: 'account', email: 'person@example.com' },
          }),
        refresh: jest.fn(),
        logout: jest.fn(),
      },
      goals: { list: jest.fn().mockResolvedValue([]), checkIn: jest.fn() },
      pairs: { createPair: jest.fn() },
    };
    api = createApi(services as Services);
  });
  afterAll(() => {
    process.env = env;
  });
  it('serves health independently of authentication and reports database unavailability', async () => {
    expect(await (await request('/health')).json()).toEqual({ status: 'ok' });
    expect((await request('/health/ready')).status).toBe(200);
    services.db.$queryRaw.mockRejectedValue(new Error('private connection credentials'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request('/health/ready');
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private connection');
    log.mockRestore();
    expect(services.identity.authenticate).not.toHaveBeenCalled();
  });
  it('protects habit data, checks UUIDs, rejects unknown body fields and validates timezones', async () => {
    expect((await request('/goals')).status).toBe(401);
    services.identity.authenticate.mockResolvedValue({ id: 'user', email: 'person@example.com' });
    expect((await request('/goals/not-a-uuid/check-ins', {})).status).toBe(400);
    expect(
      (await request('/pairs', { name: 'Our pair', timezone: 'Invalid/Timezone' })).status,
    ).toBe(400);
    expect(
      (await request('/pairs', { name: 'Our pair', timezone: 'UTC', admin: true })).status,
    ).toBe(400);
    expect(
      (
        await request('/goals/11111111-1111-4111-8111-111111111111/check-ins', {
          localDate: '2020-01-01',
        })
      ).status,
    ).toBe(400);
    expect(services.goals.checkIn).not.toHaveBeenCalled();
  });
  it('validates auth bodies and confirms verification only by explicit POST', async () => {
    expect(
      (
        await request('/auth/signup', {
          email: 'person@example.com',
          password: 'long registration password',
          client: 'web',
        })
      ).status,
    ).toBe(202);
    expect(
      (await request('/auth/login', { email: 'bad', password: '', client: 'web' })).status,
    ).toBe(400);
    expect(
      (
        await request('/auth/signup', {
          email: 'person@example.com',
          password: 'long registration password',
          client: 'web',
          role: 'admin',
        })
      ).status,
    ).toBe(400);
    expect((await request('/auth/verify/confirm')).status).toBe(404);
    expect(services.auth.confirmVerification).not.toHaveBeenCalled();
    expect(
      (
        await request('/auth/verify/confirm', {
          email: 'person@example.com',
          token: 'a'.repeat(43),
          password: 'long registration password',
          client: 'web',
        })
      ).status,
    ).toBe(201);
    expect(services.auth.confirmVerification).toHaveBeenCalledTimes(1);
  });
  it('uses secure HttpOnly cookies for web sessions and returns refresh credentials only to native clients', async () => {
    const login = {
      email: 'person@example.com',
      password: 'long registration password',
      client: 'web',
    };
    const web = await request('/auth/login', login);
    expect(web.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
    expect(web.headers.get('set-cookie')).toContain('; Secure');
    expect(await web.json()).not.toHaveProperty('refreshToken');
    const native = await request('/auth/login', { ...login, client: 'native' });
    expect(await native.json()).toHaveProperty('refreshToken', 'r'.repeat(43));
    expect((await request('/auth/logout', { client: 'web' })).headers.get('set-cookie')).toContain(
      'Max-Age=0',
    );
  });
  it('rejects forged browser origins even for native-labelled requests and rejects cookied requests without an origin', async () => {
    const login = {
      email: 'person@example.com',
      password: 'long registration password',
      client: 'native',
    };
    expect(
      (await request('/auth/login', login, { Origin: 'https://evil.example.com' })).status,
    ).toBe(403);
    expect(
      (
        await request(
          '/auth/refresh',
          { client: 'native' },
          { Origin: '', Cookie: 'pair_refresh=secret' },
        )
      ).status,
    ).toBe(403);
    expect(services.auth.login).not.toHaveBeenCalled();
  });
  it('limits login attempts and keeps preflight responses scoped to the allowed origin', async () => {
    for (let i = 0; i < 5; i++) await request('/auth/login', {});
    expect((await request('/auth/login', {})).status).toBe(429);
    const preflight = await request('/auth/login', undefined, {}, 'OPTIONS');
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
  });
  it('validates circle routes before invoking storage and authenticates connection codes', async () => {
    expect((await request('/circles')).status).toBe(401);
    expect((await request('/connections/join', { code: 'GROUP-example' })).status).toBe(401);
    services.identity.authenticate.mockResolvedValue({ id: 'alice', email: 'alice@example.com' });
    services.circles = { list: jest.fn().mockResolvedValue([]), goal: jest.fn(), join: jest.fn().mockResolvedValue({ kind: 'group' }) };
    expect((await request('/circles')).status).toBe(200);
    expect(services.circles.list).toHaveBeenCalledWith('alice');
    expect((await request('/connections/codes', { kind: 'group', targetId: 'forged' })).status).toBe(400);
    expect((await request('/circles/11111111-1111-4111-8111-111111111111/goals', { title: 'Read', target: -1 })).status).toBe(400);
    expect(services.circles.goal).not.toHaveBeenCalled();
    expect((await request('/connections/join', { code: ' GROUP-example ' })).status).toBe(201);
    expect(services.circles.join).toHaveBeenCalledWith('alice', 'GROUP-example');
  });

  it('keeps personal tasks independent of pair membership and validates planner inputs', async () => {
    expect((await request('/planner/tasks')).status).toBe(401);
    services.identity.authenticate.mockResolvedValue({id:'alice',email:'alice@example.test'});
    services.planner={ tasks:jest.fn().mockResolvedValue([]), createTask:jest.fn().mockResolvedValue({id:'task'}), completeTask:jest.fn() };
    expect((await request('/planner/tasks')).status).toBe(200);
    expect(services.planner.tasks).toHaveBeenCalledWith('alice');
    expect(services.pairs.createPair).not.toHaveBeenCalled();
    const valid={title:'Read',kind:'DAILY',timezone:'Asia/Kolkata',weekdays:[1,3,5],target:1};
    expect((await request('/planner/tasks',valid)).status).toBe(201);
    expect((await request('/planner/tasks',{...valid,userId:'bob'})).status).toBe(400);
    expect((await request('/planner/tasks',{...valid,weekdays:[1,1]})).status).toBe(400);
    expect((await request('/planner/tasks',{...valid,target:10})).status).toBe(400);
    expect((await request('/planner/tasks',{...valid,dueOn:'2026-02-31'})).status).toBe(400);
    expect((await request('/planner/tasks/not-an-id/complete',{completed:true})).status).toBe(400);
    expect((await request('/planner/market?scopeKind=GROUP&scopeId=invalid')).status).toBe(400);
  });

});
