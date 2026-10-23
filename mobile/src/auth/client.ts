import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Account = { id: string; email: string };
type SignupResult = { message: string; verificationRequired: boolean };
type Session = { accessToken: string; user: Account };
const native = Platform.OS !== 'web';
const KEY = 'pair-habits-refresh';
const API = (process.env.EXPO_PUBLIC_API_URL || (native ? '' : '/api/v1')).replace(/\/$/, '');
let accessToken: string | null = null;
let refreshPending: Promise<Account> | null = null;

export class AuthError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
}

async function request(path: string, body: object) {
  if (!API) throw new AuthError('Set EXPO_PUBLIC_API_URL to connect your account.');
  let response: Response;
  try {
    response = await fetch(`${API}/auth/${path}`, {
      method: 'POST', credentials: native ? 'omit' : 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new AuthError('Cannot reach brewtual. Check your connection and try again.'); }
  if (!response.ok) throw new AuthError(response.status === 429 ? 'Too many attempts. Wait a minute and try again.' : response.status === 401 ? 'Sign-in failed or your session expired. Please try again.' : 'Sign-in is unavailable. Please try again later.', response.status);
  return response.json();
}

export const signup = (email: string, password: string): Promise<SignupResult> => request('signup', { email: email.trim().toLowerCase(), password, client: native ? 'native' : 'web' });
export const resendVerification = (email: string): Promise<SignupResult> => request('verify/resend', { email: email.trim().toLowerCase(), client: native ? 'native' : 'web' });
export const confirmVerification = (email: string, token: string, password: string) => request('verify/confirm', { email: email.trim().toLowerCase(), token, password, client: native ? 'native' : 'web' });

export async function apiRequest<T>(path: string, method = 'GET', body?: object, key?: string): Promise<T> {
  if (!API) throw new AuthError('Set EXPO_PUBLIC_API_URL for native builds.');
  async function send() {
    try { return await fetch(`${API}${path}`, { method, credentials: native ? 'omit' : 'include',
      headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) }); }
    catch { throw new AuthError('Cannot reach brewtual. Check your connection and try again.'); }
  }
  let response = await send();
  if (response.status === 401) { await refreshSession(); response = await send(); }
  if (!response.ok) {
    let message = 'The request failed. Please try again.';
    try { const data = await response.json(); if (typeof data.message === 'string') message = data.message; } catch { /* Keep the safe fallback. */ }
    throw new AuthError(message, response.status);
  }
  return response.json() as Promise<T>;
}

async function remember(session: Session & { refreshToken?: string }): Promise<Account> {
  if (native) {
    if (!session.refreshToken) throw new AuthError('The server did not return a session.');
    try { await SecureStore.setItemAsync(KEY, session.refreshToken); }
    catch {
      await request('logout', { client: 'native', refreshToken: session.refreshToken }).catch(() => {});
      throw new AuthError('Secure storage is unavailable. Your sign-in could not be saved.');
    }
  }
  accessToken = session.accessToken;
  return session.user;
}

async function refreshBody() {
  return native ? { client: 'native', refreshToken: await SecureStore.getItemAsync(KEY) ?? '' } : { client: 'web' };
}

export async function signIn(email: string, password: string) {
  const session = await request('login', { email: email.trim().toLowerCase(), password, client: native ? 'native' : 'web' });
  return remember(session);
}

export function refreshSession(): Promise<Account> {
  if (!refreshPending) {
    refreshPending = (async () => {
      const body = await refreshBody();
      if (native && !body.refreshToken) throw new AuthError('Please sign in.', 401);
      try { return await remember(await request('refresh', body)); }
      catch (error) {
        accessToken = null;
        if (native && error instanceof AuthError && error.status === 401) await SecureStore.deleteItemAsync(KEY);
        throw error;
      }
    })().finally(() => { refreshPending = null; });
  }
  return refreshPending;
}

export async function signOut() {
  // Finish any in-flight rotation before revoking its replacement credential.
  if (refreshPending) await refreshPending.catch(() => {});
  try { await request('logout', await refreshBody()); }
  finally { accessToken = null; if (native) await SecureStore.deleteItemAsync(KEY); }
}

export async function loadAccount(): Promise<Account> {
  if (!API) throw new AuthError('The API URL is missing.');
  if (!accessToken) await refreshSession();
  const fetchMe = () => fetch(`${API}/me`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
  let response = await fetchMe();
  if (response.status === 401) { await refreshSession(); response = await fetchMe(); }
  if (!response.ok) throw new AuthError('Could not load your account.', response.status);
  return response.json();
}
