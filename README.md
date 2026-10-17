# Pair Habits

A private app for two adults to agree on habits and earn tokens toward shared rewards.

The React Native + Expo client runs on Android, iOS and web. Browser widths of 900px or more use desktop side navigation; phones use bottom tabs. Four themes and fictional demo state are saved locally.

Email/password sign-in connects to the NestJS/PostgreSQL API. The backend now accepts signup and email verification; the current client still has only the sign-in screen. Access tokens stay in memory, browser refresh credentials use HttpOnly cookies, and native refresh credentials use Expo SecureStore. Habit, reward and activity screens remain a separate fictional demo until their API wiring is implemented.

## Run locally

Use Node 24.9 or newer and install dependencies from the repository root.

1. Configure the database using `backend/.env.example`, then run `npm run db:generate` and `npm run db:migrate`.
2. For signup, set backend `AUTH_MODE=jwt`, a random `JWT_SECRET` (at least 32 characters), `APP_WEB_URL=http://localhost:8081`, `SMTP_USER` and `SMTP_APP_PASSWORD` for a Gmail account with an App Password. Set `CORS_ORIGINS=http://localhost:8081`. `AUTH_MODE=local` remains available only in development/test and needs no mail provider.
3. Optionally provision a trusted account using the secure PowerShell input below. This operator command changes an existing password and revokes sessions; public signup never overwrites accounts.
4. Copy `mobile/.env.example` to `mobile/.env`; use `http://localhost:3001/api/v1` for the browser, or your computer’s LAN address for a physical phone.
5. Run `npm run dev` and, in another terminal, `npm run web` (port 8081) or `npm run mobile`. Restart Expo after environment changes.

```powershell
$accountPassword = Read-Host 'New individual password (15–128 characters)' -MaskInput
$accountPassword | npm run auth:provision -- alex@example.com
Remove-Variable accountPassword
```

`-MaskInput` requires PowerShell 7. Passwords are read through stdin, never command arguments. Do not paste a literal password into shell history.

## One Vercel project

Import the **repository root** as one Vercel project. Use Node 24, Framework Preset **Express**, Build Command `npm run build:vercel`, Output Directory `public`, and region `sin1` (the checked-in `vercel.json` sets the last four). The build compiles the existing NestJS backend, exports Expo static web to `public`, and embeds the same-origin public API URL `/api/v1`. The root server entrypoint runs NestJS with its existing `/api/v1` prefix; Vercel serves static assets and the Express function in one deployment. `/verify-email` serves the static app shell, but only an explicit `POST` can confirm a token. No frontend verification screen is included in this task.

Set backend-only `DATABASE_URL` (Neon pooled), `DATABASE_URL_UNPOOLED` (Neon direct, for migration tooling), `AUTH_MODE=jwt`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `APP_WEB_URL` (the project's exact HTTPS origin), and `CORS_ORIGINS` (the same origin). Use a Gmail address as `SMTP_USER` and its App Password; no purchased domain is needed. Keep secrets out of `EXPO_PUBLIC_*`. Apply the additive migration once with `npm run db:migrate` from your own deployment workflow; the build does not migrate the database. Existing users are marked verified by the migration, preserving their passwords and sessions. Configure preview deployments with matching `APP_WEB_URL` and `CORS_ORIGINS` if you intend to test signup on preview URLs. No deployment or external service setup was performed here.

See [authentication and TASK-002 API contract](docs/AUTHENTICATION_PLAN.md) for request bodies, responses, limits and the verification link format.

## Checks

`npm test`, `npm run typecheck`, `npm run mobile:typecheck`, and `npm run test:vercel` (build plus static/routing check). Database integration tests require `TEST_DATABASE_URL` pointing to disposable local PostgreSQL; they create and remove an isolated schema. See [authentication](docs/AUTHENTICATION_PLAN.md), [mobile client](mobile/README.md), and [backend contract](docs/BACKEND_CONTRACT.md).
