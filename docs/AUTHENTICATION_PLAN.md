# Authentication and TASK-002 frontend contract

Updated 17 October 2026. The Next.js web/API and Expo phone client implement signup, optional SMTP email verification, login, refresh and logout. Authenticated members create a timezone-aware pair, invite the exact partner account email, accept an invite token, and use live goal, reward, wallet and activity APIs. The separate fictional demo remains available in Expo before sign-in. There is no Supabase, phone login or automatic password recovery.

## Registration and verification

All paths below are under `/api/v1`. JSON bodies reject unknown fields. The `client` field is required for registration and verification: `"web"` or `"native"`. Browser requests send the exact `Origin` configured in `CORS_ORIGINS`; native requests may omit it. Signup and resend return HTTP 202 with a generic message and `verificationRequired` boolean. They never return an account existence flag.

**Default: no verification or email delivery.** With `REQUIRE_EMAIL_VERIFICATION` omitted or `false`, signup stores the salted password hash and creates the account immediately. It removes stale pending registrations for that new account in the same transaction. Signup never changes an existing account or password. Signup and resend both return `{ "message": "You can sign in with your email and password.", "verificationRequired": false }`; resend does nothing. No SMTP variables are needed and no email is sent, even if SMTP is configured. Web and Expo take the user to sign-in after signup. Password validation, origin checks, rate limits and session checks still apply. `emailVerifiedAt` remains null, so this mode does not claim ownership of the email address.

**When email delivery is ready:** configure SMTP, set `REQUIRE_EMAIL_VERIFICATION=true` and redeploy. Signup and resend then return `{ "message": "If this address can be registered, check your email.", "verificationRequired": true }` and use the verification flow below. Login, refresh and protected requests reject unverified accounts in this mode, including existing sessions. Existing unverified users can submit signup with their current password to request a link; their password and data remain unchanged.

| Method and path | JSON body | Success | Relevant errors |
| --- | --- | --- | --- |
| `POST /auth/signup` | `{email,password,client}` | 202 generic body | 400 invalid body, 429 IP limit, 503 mail unavailable when verification is enabled |
| `POST /auth/verify/resend` | `{email,client}` | 202 generic body | 400 invalid body, 429 IP limit, 503 mail unavailable when verification is enabled |
| `POST /auth/verify/confirm` | `{email,token,password,client}` | 201 `{ "verified": true }` | 400 invalid, expired, replayed or mismatched token/password; 429 IP limit |

`email` is validated and normalized to lowercase, maximum 254 characters. Registration password is 15–128 characters. When verification is enabled, the token is a 43-character base64url string. The recipient must enter the **same password used at signup** on the confirmation screen. This prevents an attacker who registers someone else's email with an attacker-chosen password from gaining a verified account when the recipient opens the link. For a new registration, if the recipient did not initiate it or does not know that password, ignore the email and let the 30-minute pending registration expire before signing up. Existing accounts always use their current password for confirmation; signup never changes an existing user's password. If that password is forgotten, a trusted operator must reset it.

The email link is `APP_WEB_URL/verify-email#token=<token>&email=<encoded email>`. The fragment stays in the browser and is not sent on GET. The client parses it, prompts for the current account password, and calls the explicit confirmation POST. Opening or refreshing the link must not consume the token. After success, send the user through the existing login flow; confirmation does not issue a session. Keep the token out of logs and persistent client storage, and remove it from browser history after parsing. The `/verify-email` route serves the app shell.

Pending registrations store only a SHA-256 token hash and a salted scrypt password hash. Tokens expire after 30 minutes and are consumed with a conditional delete plus account creation in one serializable transaction. A resend rotates the token and invalidates the previous link. Resend has a database-backed 60-second cooldown and a maximum of five sends per pending email per hour; expired pending registrations must restart signup. Signup, login and resend have 5 requests/minute/IP, confirmation has 10 and refresh has 30, with an overall 120 requests/minute/IP limit. The IP limiter is in-process, so configure a Vercel Firewall/edge IP limit if public abuse becomes an issue across function instances. The per-email limits remain effective across instances.

When verification is enabled, missing SMTP configuration or provider rejection removes the pending token and returns a fixed 503 message. SMTP errors, passwords and raw tokens are never logged. SMTP host, port, credentials and sender address are configured separately; the sender address must use a verified domain.

The verification schema and migration history are unchanged. No new migration or database reset is needed. Owners of existing accounts can request a verification email through signup or resend when enabled; confirmation requires their current password and leaves it unchanged. In verification mode, new users are created only after confirmation. `npm run auth:provision` remains an explicit trusted operator command: it can create/verify a user or replace an existing password and revoke sessions. Do not use it as a public signup route.

## Sessions

`POST /auth/login`: `{email,password,client:"web"|"native"}`. Returns `{accessToken,user,expiresIn:900}`; native responses also include `refreshToken`. Login gives the same 401 for missing accounts and wrong passwords, and for unverified accounts only when verification is required. Access JWTs contain the user ID and session ID and last 15 minutes. Every protected JWT request checks the account and active session, plus email verification when enabled.

`POST /auth/refresh`: `{client:"web"}` plus browser cookie, or `{client:"native",refreshToken}`. Refresh tokens are random 32-byte secrets stored only as SHA-256 hashes in PostgreSQL. Rotation uses a conditional update, so concurrent replay has one winner. Unverified users cannot refresh when verification is enabled, even if an old session exists. Sessions expire absolutely 30 days after login.

`POST /auth/logout`: same credential transport as refresh; revokes the session and clears the browser cookie. Web refresh cookies are HttpOnly, SameSite Strict, Secure in production, and scoped to `/api/v1/auth`. Browser responses never expose refresh tokens to JavaScript. The existing client keeps access tokens in memory and native refresh credentials in Expo SecureStore. Passwords are never persisted.

## Configuration

- `AUTH_MODE=jwt`: requires backend-only `JWT_SECRET` (at least 32 characters) and `APP_WEB_URL` (an exact HTTPS origin in production). Defaults for `JWT_ISSUER` and `JWT_AUDIENCE` are `pair-habits` and `pair-habits-api`.
- `REQUIRE_EMAIL_VERIFICATION`: defaults to `false`. Set to `true` only after configuring `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. SMTP is unused while verification is off.
- `AUTH_MODE=local`: signed development/test tokens only; forbidden in production. Password login, signup and verification are disabled. Existing local token tooling remains available.
- `CORS_ORIGINS`: exact browser origins, such as `http://localhost:3000` for Next.js, `http://localhost:8081` for optional Expo web, or this Vercel project's HTTPS origin. No wildcard.
- `EXPO_PUBLIC_API_URL`: the Expo client's public API base ending in `/api/v1`, such as `https://pair-habit.vercel.app/api/v1`. Local Expo can use `http://localhost:3000/api/v1`; a physical phone needs the computer's LAN address. The Next.js website uses `/api/v1` directly. Never put server secrets in `EXPO_PUBLIC_*`.

Password hashes use Node scrypt with N=32768, r=8, p=1, random 16-byte salt, 64-byte output and constant-time verification. Password recovery remains an operator action after independently establishing ownership. Authenticated API data is held in memory and is not cached in AsyncStorage. AsyncStorage remains limited to the explicit fictional demo and theme preference. Web uses same-origin `/api/v1`; native builds must set `EXPO_PUBLIC_API_URL` to a reachable API base ending in `/api/v1`.
