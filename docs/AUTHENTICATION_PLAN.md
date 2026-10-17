# Authentication

Updated 17 October 2026. App-owned email/password authentication is implemented in the NestJS API and Expo client. No Supabase, public signup, shared PIN, phone login, email delivery or automatic recovery is configured.

## Accounts and passwords

Provision individual accounts with `npm run auth:provision -- user@example.com`, supplying a unique 15–128 character password over stdin (see the masked PowerShell example in the root README). This creates an account or changes its password and revokes its sessions. Existing user records and pair data are retained by the additive migration. Existing accounts have no password until provisioned. Back up production data before applying migrations.

Passwords use Node scrypt, N=32768, r=8, p=1, a random 16-byte salt and 64-byte output, with constant-time verification. Login errors do not distinguish missing accounts from wrong passwords. Login is limited to 5 requests/minute/IP by the installed Nest throttler. Its default storage is in-process: use shared throttling or an edge rate limiter before scaling to multiple API instances/serverless production.

## Sessions

`POST /api/v1/auth/login`: `{email,password,client:"web"|"native"}`. Returns `{accessToken,user,expiresIn:900}`; native responses also include `refreshToken`. Access JWTs contain the user ID and session ID, with a 15-minute lifetime. Every protected request checks that both the account and unexpired, unrevoked session exist. Account/session revocation takes effect immediately.

`POST /api/v1/auth/refresh`: `{client:"web"}` plus browser cookie, or `{client:"native",refreshToken}`. Refresh tokens are random 32-byte secrets stored only as SHA-256 hashes in PostgreSQL, rotated with a conditional database update so concurrent replay has only one winner. Sessions expire absolutely 30 days after login; rotation does not extend them. Old tokens are rejected. Consumed-token reuse does not revoke the current session automatically.

`POST /api/v1/auth/logout`: same credential transport as refresh; revokes the session and clears the browser cookie. Reprovisioning a password revokes all sessions for that account. No background session cleanup is implemented; expired/revoked rows can be periodically removed by an operator.

Web refresh cookies are HttpOnly, SameSite Strict, Secure in production, and scoped to `/api/v1/auth`. Browser responses never expose refresh tokens to JavaScript. Auth POSTs validate the exact allowed Origin, even for native-labelled requests with an Origin header. Native requests can omit Origin but must supply their refresh credential explicitly. Credentialed CORS permits only configured origins. Host web and API on the same HTTPS site; unrelated hosting domains will block Strict cookies.

The client stores access tokens only in memory and native refresh credentials in Expo SecureStore. It restores sessions at startup, refreshes while open every 14 minutes, and retries `/me` once after a 401. Network failures leave the saved refresh credential available for retry. Logout reports network failures instead of claiming successful server revocation. Passwords are never persisted. API secrets must never appear in `EXPO_PUBLIC_*` variables. Use HTTPS for all non-local builds.

## Runtime configuration

- `AUTH_MODE=jwt`: enables password login and requires backend-only `JWT_SECRET` (strong random value, at least 32 characters), `JWT_ISSUER=pair-habits`, `JWT_AUDIENCE=pair-habits-api`.
- `AUTH_MODE=local`: signed development/test tokens only, forbidden in production. Password login is disabled. Existing local token tooling remains available.
- `CORS_ORIGINS`: exact web origin, such as `http://localhost:8081`; no wildcard. Browser auth requires Origin. Native-only deployments may leave this empty.
- `EXPO_PUBLIC_API_URL`: API URL ending in `/api/v1`; localhost for local web, LAN IP for a development phone, same-site HTTPS API for deployed web.

The auth gate has a real account view and a deliberately separate fictional demo. Pair/goal/reward API screens are still pending. Demo-person switching never grants real account access. Password recovery is currently operator reprovisioning after independently establishing ownership; unverified email/phone cannot establish recovery ownership. Automated recovery, verification, MFA and phone OTP remain later work.
