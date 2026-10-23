import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError, BadRequestError, ForbiddenError, NotFoundError } from './http/errors';
import type { Services } from './services';
import * as schemas from './schemas';

const COOKIE = 'pair_refresh';
const allowedOrigins = () =>
  (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 65536) {
          await reader.cancel();
          throw new HttpError(413, 'Request body is too large');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (
    text &&
    request.headers.has('content-type') &&
    !request.headers.get('content-type')!.toLowerCase().startsWith('application/json')
  )
    throw new HttpError(415, 'Use application/json');
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    throw new BadRequestError('Invalid JSON');
  }
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestError(
      result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; '),
    );
  return result.data;
}

function checkOrigin(request: Request, client?: string) {
  const origin = request.headers.get('origin');
  if (
    (origin && !allowedOrigins().includes(origin)) ||
    (client !== 'native' && !origin) ||
    (request.headers.get('cookie')?.includes(`${COOKIE}=`) && !origin)
  )
    throw new ForbiddenError('Untrusted sign-in origin');
}
function refreshToken(request: Request, data: z.infer<typeof schemas.sessionSchema>) {
  return data.client === 'native'
    ? (data.refreshToken ?? '')
    : (request.headers
        .get('cookie')
        ?.split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1) ?? '');
}
function cookie(token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function createApi(services: Services) {
  // shortcut: IP limits are per function instance; add Vercel Firewall limits if public abuse grows.
  const attempts = new Map<string, { count: number; until: number }>();
  return async function handle(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const endpoint = path.replace(/^\/api\/v1(?=\/|$)/, '') || '/';
    const method = request.method;
    const supplied = request.headers.get('x-request-id');
    const requestId = supplied && /^[a-zA-Z0-9_-]{1,64}$/.test(supplied) ? supplied : randomUUID();
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
      Vary: 'Origin',
    });
    const origin = request.headers.get('origin');
    if (origin && allowedOrigins().includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, Idempotency-Key, X-Request-Id',
      );
    }
    const json = (value: unknown, status = method === 'POST' ? 201 : 200) =>
      Response.json(value, { status, headers });
    try {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers });
      const now = Date.now();
      for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      const limit = /^\/auth\/(signup|login|verify\/resend)$/.test(endpoint)
        ? 5
        : endpoint === '/auth/verify/confirm'
          ? 10
          : endpoint === '/auth/refresh'
            ? 30
            : 120;
      const buckets: [string, number][] = [[`${ip}:all`, 120]];
      if (endpoint.startsWith('/auth/')) buckets.push([`${ip}:${endpoint}`, limit]);
      for (const [key, maximum] of buckets) {
        const attempt = attempts.get(key) ?? { count: 0, until: now + 60000 };
        if (attempts.size >= 10000 && !attempts.has(key))
          throw new HttpError(429, 'Too many requests');
        attempts.set(key, attempt);
        if (++attempt.count > maximum) {
          headers.set('Retry-After', String(Math.ceil((attempt.until - now) / 1000)));
          throw new HttpError(429, 'Too many requests');
        }
      }

      if (method === 'GET' && endpoint === '/health') return json({ status: 'ok' });
      if (method === 'GET' && endpoint === '/health/ready') {
        try {
          await services.db.$queryRaw`SELECT 1`;
        } catch {
          throw new HttpError(503, 'Database is unavailable');
        }
        return json({ status: 'ready' });
      }
      if (method === 'POST' && endpoint.startsWith('/auth/')) {
        if (endpoint === '/auth/signup' || endpoint === '/auth/login') {
          const data = await body(
            request,
            endpoint.endsWith('signup') ? schemas.signupSchema : schemas.loginSchema,
          );
          checkOrigin(request, data.client);
          if (endpoint.endsWith('signup'))
            return json(await services.auth.signup(data.email, data.password), 202);
          const session = await services.auth.login(data.email, data.password);
          if (data.client === 'native') return json({ ...session, expiresIn: 900 });
          headers.set('Set-Cookie', cookie(session.refreshToken, 30 * 86400));
          return json({ accessToken: session.accessToken, user: session.user, expiresIn: 900 });
        }
        if (endpoint === '/auth/verify/resend') {
          const data = await body(request, schemas.resendSchema);
          checkOrigin(request, data.client);
          return json(await services.auth.resendVerification(data.email), 202);
        }
        if (endpoint === '/auth/verify/confirm') {
          const data = await body(request, schemas.confirmSchema);
          checkOrigin(request, data.client);
          return json(
            await services.auth.confirmVerification(data.email, data.token, data.password),
          );
        }
        if (endpoint === '/auth/refresh' || endpoint === '/auth/logout') {
          const data = await body(request, schemas.sessionSchema);
          checkOrigin(request, data.client);
          const token = refreshToken(request, data);
          if (endpoint.endsWith('logout')) {
            await services.auth.logout(token);
            headers.set('Set-Cookie', cookie('', 0));
            return json({ ok: true });
          }
          const session = await services.auth.refresh(token);
          if (data.client === 'native') return json({ ...session, expiresIn: 900 });
          headers.set('Set-Cookie', cookie(session.refreshToken, 30 * 86400));
          return json({ accessToken: session.accessToken, user: session.user, expiresIn: 900 });
        }
      }

      if (endpoint.startsWith('/auth/')) throw new NotFoundError('Route not found');
      const user = await services.identity.authenticate(request.headers.get('authorization'));
      if (endpoint === '/circles' && method === 'GET') return json(await services.circles.list(user.id));
      if (endpoint === '/circles' && method === 'POST') {
        const data = await body(request, z.strictObject({ name: z.string().trim().min(1).max(80) }));
        return json(await services.circles.create(user.id, data.name));
      }
      if (endpoint === '/connections/codes' && method === 'POST') {
        const data = await body(request, z.strictObject({ kind: z.enum(['partner', 'group']), targetId: z.uuid() }));
        return json(await services.circles.code(user.id, data.kind, data.targetId));
      }
      if (endpoint === '/connections/join' && method === 'POST') {
        const data = await body(request, z.strictObject({ code: z.string().trim().min(1).max(100) }));
        return json(await services.circles.join(user.id, data.code));
      }
      const circleRoute = /^\/circles\/([^/]+)\/(goals|offers)(?:\/([^/]+)\/(progress|cheer|pledge))?$/.exec(endpoint);
      if (circleRoute && method === 'POST') {
        const [, circleId, resource, id, action] = circleRoute;
        if (!z.uuid().safeParse(circleId).success || (id && !z.uuid().safeParse(id).success)) throw new BadRequestError('Invalid ID');
        if (!id && resource === 'goals') {
          const data = await body(request, z.strictObject({ title: z.string().trim().min(1).max(160), target: z.number().int().min(1).max(10000) }));
          return json(await services.circles.goal(user.id, circleId, data.title, data.target));
        }
        if (!id && resource === 'offers') {
          const data = await body(request, z.strictObject({ title: z.string().trim().min(1).max(500), goalId: z.uuid() }));
          return json(await services.circles.offer(user.id, circleId, data.goalId, data.title));
        }
        if (resource === 'goals' && action === 'progress') {
          const data = await body(request, z.strictObject({ progress: z.number().int().min(0).max(10000) }));
          return json(await services.circles.progress(user.id, circleId, id, data.progress));
        }
        if (resource === 'goals' && action === 'cheer') {
          await body(request, schemas.emptySchema);
          return json(await services.circles.cheer(user.id, circleId, id));
        }
        if (resource === 'offers' && action === 'pledge') {
          await body(request, schemas.emptySchema);
          return json(await services.circles.pledge(user.id, circleId, id));
        }
      }
      if (method === 'GET') {
        switch (endpoint) {
          case '/me':
            return json(user);
          case '/pairs/current':
            return json(await services.pairs.current(user.id));
          case '/goals':
            return json(await services.goals.list(user.id));
          case '/rewards':
            return json(await services.rewards.list(user.id));
          case '/rewards/redemptions':
            return json(await services.rewards.redemptions(user.id));
          case '/wallet':
            return json(await services.wallet.balance(user.id));
          case '/wallet/ledger':
            return json(await services.wallet.ledger(user.id));
        }
      }
      if (method === 'POST') {
        switch (endpoint) {
          case '/pairs': {
            const data = await body(request, schemas.pairSchema);
            return json(await services.pairs.createPair(user, data.name, data.timezone));
          }
          case '/pairs/invites': {
            const data = await body(request, schemas.inviteSchema);
            return json(await services.pairs.createInvite(user, data.email));
          }
          case '/pairs/invites/accept': {
            const data = await body(request, schemas.acceptSchema);
            return json(await services.pairs.acceptInvite(user, data.token));
          }
          case '/goals':
            return json(
              await services.goals.create(user.id, await body(request, schemas.goalSchema)),
            );
          case '/rewards':
            return json(
              await services.rewards.create(user.id, await body(request, schemas.rewardSchema)),
            );
          case '/wallet/settle':
            await body(request, schemas.emptySchema);
            return json(await services.wallet.settle(user.id));
        }
      }
      const match =
        /^\/(goals|rewards)\/([^/]+)\/(approve|reject|redeem|check-ins)(\/today)?$/.exec(endpoint);
      if (match) {
        const [, resource, id, action, today] = match;
        if (!z.uuid().safeParse(id).success) throw new BadRequestError('Invalid ID');
        if (resource === 'goals' && action === 'check-ins' && today && method === 'DELETE')
          return json(await services.goals.undoToday(user.id, id));
        if (method === 'POST' && !today) {
          await body(request, schemas.emptySchema);
          if (action === 'approve' || action === 'reject') {
            const service = resource === 'goals' ? services.goals : services.rewards;
            return json(await service[action](user.id, id));
          }
          if (resource === 'goals' && action === 'check-ins')
            return json(await services.goals.checkIn(user.id, id));
          if (resource === 'rewards' && action === 'redeem')
            return json(
              await services.rewards.redeem(
                user.id,
                id,
                request.headers.get('idempotency-key') ?? '',
              ),
            );
        }
      }
      const fulfillment = /^\/rewards\/redemptions\/([^/]+)\/fulfill$/.exec(endpoint);
      if (method === 'POST' && fulfillment) {
        if (!z.uuid().safeParse(fulfillment[1]).success) throw new BadRequestError('Invalid ID');
        await body(request, schemas.emptySchema);
        return json(await services.rewards.fulfill(user.id, fulfillment[1]));
      }
      throw new NotFoundError('Route not found');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) console.error('API request failed', { requestId, path, status });
      return json(
        {
          statusCode: status,
          message: error instanceof HttpError ? error.message : 'An unexpected error occurred',
          path,
          requestId,
        },
        status,
      );
    }
  };
}
