export type Account = { id: string; email: string };
type SignupResult = { message: string; verificationRequired: boolean };
type Session = { accessToken: string; user: Account };
let accessToken: string | null = null;
let pendingRefresh: Promise<Account> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
  ) {
    super(message);
  }
}

async function send<T>(path: string, method = 'GET', data?: object, key?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new ApiError('Cannot reach brewtual. Check your connection and try again.');
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ApiError('The server returned an unreadable response.', response.status);
  }
  if (!response.ok) {
    const message =
      result &&
      typeof result === 'object' &&
      'message' in result &&
      typeof result.message === 'string'
        ? result.message
        : 'The request failed. Please try again.';
    throw new ApiError(
      response.status === 429 ? 'Too many attempts. Wait a minute and try again.' : message,
      response.status,
    );
  }
  return result as T;
}

export function refreshSession(): Promise<Account> {
  pendingRefresh ??= send<Session>('/auth/refresh', 'POST', { client: 'web' })
    .then((session) => {
      accessToken = session.accessToken;
      return session.user;
    })
    .catch((error) => {
      accessToken = null;
      throw error;
    })
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}
export async function signIn(email: string, password: string): Promise<Account> {
  const session = await send<Session>('/auth/login', 'POST', {
    email: email.trim().toLowerCase(),
    password,
    client: 'web',
  });
  accessToken = session.accessToken;
  return session.user;
}
export async function signOut() {
  if (pendingRefresh) await pendingRefresh.catch(() => {});
  try {
    await send('/auth/logout', 'POST', { client: 'web' });
  } finally {
    accessToken = null;
  }
}
export const signup = (email: string, password: string) =>
  send<SignupResult>('/auth/signup', 'POST', { email: email.trim().toLowerCase(), password, client: 'web' });
export const resend = (email: string) =>
  send<SignupResult>('/auth/verify/resend', 'POST', { email: email.trim().toLowerCase(), client: 'web' });
export const confirm = (email: string, token: string, password: string) =>
  send('/auth/verify/confirm', 'POST', {
    email: email.trim().toLowerCase(),
    token,
    password,
    client: 'web',
  });
export async function api<T>(
  path: string,
  method = 'GET',
  data?: object,
  key?: string,
): Promise<T> {
  try {
    return await send<T>(path, method, data, key);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refreshSession();
    return send<T>(path, method, data, key);
  }
}
