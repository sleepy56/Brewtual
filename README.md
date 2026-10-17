# Pair Habits

A private app for two adults to agree on habits and earn tokens toward shared rewards.

**Next.js + TypeScript** hosts the website and `/api/v1` API in one Vercel project. **React Native + Expo** remains the Android/iOS client. Both use the same Neon PostgreSQL database through Prisma. There is no NestJS runtime, dependency injection container, or custom Express server.

The website supports signup, email verification, login, pair invitations, habit proposals and approvals, daily check-ins, weekly token awards, reward redemption and fulfillment. Midnight, Dawn, Plum and Ocean themes work on desktop and phone layouts. Expo retains its existing live screens and separate fictional demo.

## Run locally

Use Node 24.9 or newer within Node 24, and install from the repository root with `npm ci`.

1. Run `npm run local:setup` to create a root `.env` from [.env.example](.env.example) with a random signing key, or configure that file yourself. Existing environment files under the old `backend/` directory are preserved but are no longer loaded; move the values you need into the root `.env`. Never commit that file.
2. Configure `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. For local PostgreSQL, `docker compose up -d` uses the example connection on port 5433. Run `npm run db:generate` and `npm run db:migrate` for a new local database. The Next.js migration does not change the schema or require a new Neon migration if the existing migrations were already applied.
3. Use `AUTH_MODE=jwt`, a strong `JWT_SECRET`, `APP_WEB_URL=http://localhost:3000` and `CORS_ORIGINS=http://localhost:3000,http://localhost:8081`. SMTP is optional for startup and existing-account login. Public signup and resend require SMTP and return 503 until it is configured; email verification remains mandatory.
4. Run `npm run dev`, then open `http://localhost:3000`. This starts both web and API. Production checks use `npm run build` followed by `npm start`.
5. For Expo, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `http://YOUR-COMPUTER-LAN-IP:3000/api/v1` or the deployed HTTPS API. Run `npm run mobile` separately and restart Expo after environment changes. `npm run mobile:web` is the optional Expo browser preview.

To provision your own trusted account while SMTP is unavailable:

```powershell
$accountPassword = Read-Host 'New individual password (15–128 characters)' -MaskInput
$accountPassword | npm run auth:provision -- your-email@example.com
Remove-Variable accountPassword
```

`-MaskInput` requires PowerShell 7. The command reads passwords from stdin. It creates/verifies the account, or replaces an existing password and revokes its sessions. Public signup never overwrites an account.

## Vercel

Import the **repository root**. Set Framework Preset to **Next.js**, Node to **24.x**, Install Command to `npm ci --include=dev`, Build Command to `npm run build`, and leave the Output Directory override disabled/default. If this project previously used Express or `public`, reset those dashboard overrides before redeploying. The checked-in `vercel.json` selects Next.js and Singapore (`sin1`).

Keep the existing Neon URLs, signing secret and auth settings. `APP_WEB_URL` and `CORS_ORIGINS` must match the exact site origin, such as `https://pair-habit.vercel.app`, without a trailing slash. [.env.vercel.example](.env.vercel.example) lists server variables. SMTP can remain unset. Builds generate Prisma and Next.js output; they never apply migrations or send email.

After deployment, `/api/v1/health` should return `{"status":"ok"}` and `/api/v1/health/ready` should return `{"status":"ready"}`. Readiness returns 503 if PostgreSQL is unavailable. The website loads independently of database availability.

## Where to debug

- `app/page.tsx`, `app/verify-email/page.tsx`: website pages.
- `src/web/pair-habits.tsx`, `src/web/client.ts`: React screens and browser session/API transport.
- `app/api/v1/[...path]/route.ts`: Next.js Node route entrypoint.
- `src/server/api.ts`, `src/server/schemas.ts`: HTTP routing, validation, origin checks, cookies, rate limits and safe errors.
- `src/server/auth`, `pairs`, `goals`, `rewards`, `wallet`: ordinary TypeScript business logic, with explicit constructor dependencies in `src/server/services.ts`.
- `prisma/`: unchanged schema and migration history.
- `mobile/`: Expo phone client, using the same `/api/v1` contract.

## Checks

Run `npm test`, `npm run typecheck`, `npm run mobile:test`, and `npm run mobile:typecheck`. `npm run test:vercel` builds Next.js and starts the actual production server with Lambda-style module restrictions, then checks website pages, API health, auth validation and behavior during a database outage.

`npm run test:integration` requires `TEST_DATABASE_URL` pointing to local PostgreSQL. It creates/removes an isolated schema and uses fake email for signup, verification and two-person habit/reward flows; it rejects remote database URLs. See [deployment and phones](docs/DEPLOYMENT_AND_MOBILE_PLAN.md), [authentication](docs/AUTHENTICATION_PLAN.md), [API contract](docs/BACKEND_CONTRACT.md), and [Expo instructions](mobile/README.md).
