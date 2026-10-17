# Authentication and TASK-002 frontend contract

Updated 17 October 2026. The NestJS API and Expo client implement signup, Gmail email verification, login, refresh and logout. Authenticated members create a timezone-aware pair, invite the exact partner account email, accept an invite token, and use live goal, reward, wallet and activity APIs through the existing themed screens. The separate fictional demo remains available before sign-in. There is no Supabase, phone login, automatic password recovery or purchased mail domain.

## Registration and verification

All paths below are under `/api/v1`. JSON bodies reject unknown fields. The `client` field is required for registration and verification: `"web"` or `"native"`. Browser requests send the exact `Origin` configured in `CORS_ORIGINS`; native requests may omit it. Both signup and resend return HTTP 202 with the same body, `{ "message": "If this address can be registered, check your email." }`, for existing, pending, and unknown accounts. They never return an account existence flag.

| Method and path | JSON body | Success | Relevant errors |
| --- | --- | --- | --- |
| `POST /auth/signup` | `{email,password,client}` | 202 generic body | 400 invalid body, 429 IP limit, 503 mail unavailable |
| `POST /auth/verify/resend` | `{email,client}` | 202 generic body | 400 invalid body, 429 IP limit, 503 mail unavailable |
| `POST /auth/verify/confirm` | `{email,token,password,client}` | 201 `{ "verified": true }` | 400 invalid, expired, replayed or mismatched token/password; 429 IP limit |

`email` is validated and normalized to lowercase, maximum 254 characters. Registration password is 15–128 characters. The token is a 43-character base64url string. The recipient must enter the **same password used at signup** on the confirmation screen. This prevents an attacker who registers someone else's email with an attacker-chosen password from gaining a verified account when the recipient opens the link. For a new registration, if the recipient did not initiate it or does not know that password, ignore the email and let the 30-minute pending registration expire before signing up. Existing accounts always use their current password for confirmation; signup never changes an existing user's password. If that password is forgotten, a trusted operator must reset it.

The email link is `APP_WEB_URL/verify-email#token=<token>&email=<encoded email>`. The fragment stays in the browser and is not sent on GET. The client parses it, prompts for the current account password, and calls the explicit confirmation POST. Opening or refreshing the link must not consume the token. After success, send the user through the existing login flow; confirmation does not issue a session. Keep the token out of logs and persistent client storage, and remove it from browser history after parsing. The `/verify-email` route serves the app shell.

Pending registrations store only a SHA-256 token hash and a salted scrypt password hash. Tokens expire after 30 minutes and are consumed with a conditional delete plus account creation in one serializable transaction. A resend rotates the token and invalidates the previous link. Resend has a database-backed 60-second cooldown and a maximum of five sends per pending email per hour; expired pending registrations must restart signup. Signup and resend also have 5 requests/minute/IP via Nest throttling, and confirmation has 10 requests/minute/IP. Nest's IP limiter is in-process, so configure a Vercel Firewall/edge IP limit if public abuse becomes an issue across function instances. The per-email limits remain effective across instances.

If Gmail rejects delivery, the pending token is removed and the API returns a fixed 503 message. Missing SMTP configuration prevents JWT-mode startup. SMTP errors, passwords and raw tokens are never logged. The implementation uses TLS-validated Gmail SMTP on port 465 with a Gmail App Password; `SMTP_USER` is the sender address.

The additive migration adds nullable verification state and a pending-registration table while preserving existing accounts and data. It does not mark old accounts verified. Owners of existing accounts can request a verification email through signup or resend; confirmation requires their current password and leaves it unchanged. New public users are created only after confirmation. `npm run auth:provision` remains an explicit trusted operator command: it can create/verify a user or replace an existing password and revoke sessions. Do not use it as a public signup route.

## Sessions

`POST /auth/login`: `{email,password,client:"web"|"native"}`. Returns `{accessToken,user,expiresIn:900}`; native responses also include `refreshToken`. Login gives the same 401 for missing, wrong-password and unverified accounts. Access JWTs contain the user ID and session ID and last 15 minutes. Every protected JWT request checks the verified account and active session.

`POST /auth/refresh`: `{client:"web"}` plus browser cookie, or `{client:"native",refreshToken}`. Refresh tokens are random 32-byte secrets stored only as SHA-256 hashes in PostgreSQL. Rotation uses a conditional update, so concurrent replay has one winner. Unverified users cannot refresh even if an old session exists. Sessions expire absolutely 30 days after login.

`POST /auth/logout`: same credential transport as refresh; revokes the session and clears the browser cookie. Web refresh cookies are HttpOnly, SameSite Strict, Secure in production, and scoped to `/api/v1/auth`. Browser responses never expose refresh tokens to JavaScript. The existing client keeps access tokens in memory and native refresh credentials in Expo SecureStore. Passwords are never persisted.

## Configuration

- `AUTH_MODE=jwt`: requires backend-only `JWT_SECRET` (at least 32 characters), `SMTP_USER`, `SMTP_APP_PASSWORD`, and `APP_WEB_URL` (an exact HTTPS origin in production). Defaults for `JWT_ISSUER` and `JWT_AUDIENCE` are `pair-habits` and `pair-habits-api`.
- `AUTH_MODE=local`: signed development/test tokens only; forbidden in production. Password login, signup and verification are disabled. Existing local token tooling remains available.
- `CORS_ORIGINS`: exact browser origin, such as `http://localhost:8081` locally or this Vercel project's HTTPS origin. No wildcard.
- `EXPO_PUBLIC_API_URL`: public API base ending in `/api/v1`. The one-project Vercel build sets `/api/v1`; local web can use `http://localhost:3001/api/v1`. Never put backend secrets in `EXPO_PUBLIC_*`.

Password hashes use Node scrypt with N=32768, r=8, p=1, random 16-byte salt, 64-byte output and constant-time verification. Password recovery remains an operator action after independently establishing ownership. Authenticated API data is held in memory and is not cached in AsyncStorage. AsyncStorage remains limited to the explicit fictional demo and theme preference. Web uses same-origin `/api/v1`; native builds must set `EXPO_PUBLIC_API_URL` to a reachable API base ending in `/api/v1`.
