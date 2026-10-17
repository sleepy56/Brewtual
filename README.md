# Pair Habits

A private app for two adults to agree on habits and earn tokens toward shared rewards.

The React Native + Expo client runs on Android, iOS and web. Browser widths of 900px or more use desktop side navigation; phones use bottom tabs. Four themes and fictional demo state are saved locally.

Email/password signup, verification and sign-in connect to the NestJS/PostgreSQL API. Authenticated members create or join a pair and use its live habits, approvals, rewards, wallet and activity. The fictional demo is a separate entry from the signed-out screen. Access tokens stay in memory, browser refresh credentials use HttpOnly cookies, and native refresh credentials use Expo SecureStore. Only fictional demo state and theme preference use AsyncStorage.

## Run locally

Use Node 24.9 or newer and install dependencies from the repository root.

1. Configure the database using `backend/.env.example`, then run `npm run db:generate` and `npm run db:migrate`.
2. For signup, set backend `AUTH_MODE=jwt`, a random `JWT_SECRET` (at least 32 characters), `APP_WEB_URL=http://localhost:8081`, and provider SMTP settings. For Resend, use `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, your Resend API key as `SMTP_PASSWORD`, and a sender on your verified domain as `SMTP_FROM`. Set `CORS_ORIGINS=http://localhost:8081`. `AUTH_MODE=local` remains available only in development/test and needs no mail provider.
3. Optionally provision a trusted account using the secure PowerShell input below. This operator command changes an existing password and revokes sessions; public signup never overwrites accounts.
4. The deployed web app uses same-origin `/api/v1` by default. For local Expo web, set `EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1`; for a native phone, use your computer’s LAN address instead.
5. Run `npm run dev` and, in another terminal, `npm run web` (port 8081) or `npm run mobile`. Restart Expo after environment changes.

```powershell
$accountPassword = Read-Host 'New individual password (15–128 characters)' -MaskInput
$accountPassword | npm run auth:provision -- alex@example.com
Remove-Variable accountPassword
```

`-MaskInput` requires PowerShell 7. Passwords are read through stdin, never command arguments. Do not paste a literal password into shell history.

## One Vercel project

Import the **repository root** as one Vercel project. Use Node 24, Framework Preset **Express**, Build Command `npm run build:vercel`, Output Directory `public`, and region `sin1` (the checked-in `vercel.json` sets the last four). The build compiles the existing NestJS backend, exports Expo static web to `public`, and embeds the same-origin public API URL `/api/v1`. The root server entrypoint runs NestJS with its existing `/api/v1` prefix; Vercel serves static assets and the Express function in one deployment. `/verify-email` serves the app shell; the client reads the email-link fragment, removes it from browser history and confirms only through the explicit API `POST`.

Set backend-only `DATABASE_URL` (Neon pooled), `AUTH_MODE=jwt`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `APP_WEB_URL` (the project's exact HTTPS origin), and `CORS_ORIGINS` (the same origin). SMTP settings are optional until you are ready to send signup emails. To enable them with Resend, set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, the Resend API key as `SMTP_PASSWORD`, and a sender on your verified domain as `SMTP_FROM`. Without SMTP, the API still starts but signup and resend return 503. Keep secrets out of `EXPO_PUBLIC_*`. Apply the additive migration once with `npm run db:migrate` from your own deployment workflow; the build does not migrate the database. The migration preserves existing accounts and data but does not mark old accounts verified. Existing account owners must request a verification email and confirm with their current password before signing in. Configure preview deployments with matching `APP_WEB_URL` and `CORS_ORIGINS` if you intend to test signup on preview URLs. No deployment or external service setup was performed here.

See [authentication and TASK-002 API contract](docs/AUTHENTICATION_PLAN.md) for request bodies, responses, limits, pair setup and the verification link format. Add the deployed site to a phone Home Screen for an installable browser shortcut; a native iOS/Android app is a separate Expo build and needs a reachable native API URL. Neither changes the one Vercel web deployment.

## Checks

`npm test`, `npm run typecheck`, `npm run mobile:typecheck`, and `npm run test:vercel` (build plus static/routing check). Database integration tests require `TEST_DATABASE_URL` pointing to disposable local PostgreSQL; they create and remove an isolated schema, and replace verification mail with a fake service that captures tokens without sending email. See [authentication](docs/AUTHENTICATION_PLAN.md), [mobile client](mobile/README.md), and [backend contract](docs/BACKEND_CONTRACT.md).
