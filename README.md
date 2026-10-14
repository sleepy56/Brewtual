# Pair Habits

A private app for two adults to agree on habits and earn tokens toward shared rewards. The first backend slice is a separate NestJS API with PostgreSQL and Prisma, built by three `gpt-6-luna` subagents and integrated in this workspace.

**Current direction (14 October 2026):** NestJS API on Vercel, Neon PostgreSQL, and a separate React Native + Expo mobile app. The actual Neon URLs are configured in ignored `backend/.env`; deployment and mobile configuration templates are in place. The mobile UI is still pending. See [hosting and mobile setup](docs/DEPLOYMENT_AND_MOBILE_PLAN.md).

Verification on 14 October 2026: the Neon runtime and migration connections passed, and the initial schema was applied. Production build, typecheck, 36 unit tests and 8 local PostgreSQL integration tests passed after the configuration changes. Vercel deployment and production sign-in are still pending.

## Implemented

- Verified Supabase bearer tokens, with signed local development tokens for testing.
- One pair per person, two membership slots, an IANA timezone, and email-bound, hashed, expiring invitations.
- Recurring habit proposals, partner approval/rejection, scheduled same-day check-ins and undo.
- Monday–Sunday awards beginning the first local Monday after approval. Settlement records both qualifying and missed weeks and is safe to retry.
- An immutable token ledger, partner-approved rewards, atomic redemption with an idempotency key, and offerer-recorded fulfillment.
- Strict input validation, pair authorization, request IDs, rate limiting, health/readiness checks, and development API documentation.

This is the initial private vertical slice from [the product plan](docs/PRODUCT_PLAN.md). Milestone goals, versioned terms, pause/archive, rule buyouts, notifications, export, account deletion, and the frontend are still pending. Invite creation returns a token to share manually; it does not send email. The future frontend should call `POST /api/v1/wallet/settle` when opening the app, repeating while `hasMore` is true, before displaying settled balances.

## Run locally

Prerequisites: Node **24.9 or newer**, npm, and Docker Desktop with its Linux engine running. The default database is isolated to localhost port 5433. This project's older machine-wide Node 18 is not supported; local verification used the desktop app's bundled Node 24.19. The test launcher enables VM modules to load NestJS 12's ESM dependencies through Jest.

From the repository root:

```powershell
npm install
npm run local:setup
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev
```

`local:setup` creates `backend/.env` with a random development signing key and preserves an existing file. The template is [backend/.env.example](backend/.env.example). PostgreSQL defaults are intended for local use. This checkout's existing `.env` now points at Neon; Docker remains the integration-test database. `npm run db:check` verifies both pooled and unpooled app database connections without logging credentials. Prisma migrations use `DATABASE_URL_UNPOOLED`.

API: `http://localhost:3001/api/v1`. Interactive endpoint documentation: `http://localhost:3001/api/docs` in development. `GET /api/v1/health` checks the process; `GET /api/v1/health/ready` checks PostgreSQL. The application requires its database at startup.

Create two local credentials, using fictional accounts:

```powershell
npm run local:token -- alice@example.com
npm run local:token -- bob@example.com
```

The output includes the user UUID and a bearer token that expires in one hour. Supply the **same UUID** as the second argument when renewing that person's token. Local signing is available only with `AUTH_MODE=local` and `NODE_ENV=development` or `test`. The application refuses this mode in production.

For managed authentication, set `AUTH_MODE=supabase` and `SUPABASE_URL` to your project origin. Sign users in with Supabase Auth in the future client, then send their access token to the API. Verification requires asymmetric ES256/RS256 signing keys exposed through the project's JWKS; legacy HS256 Supabase projects must migrate their signing key before using this adapter. Disable the Supabase Data API for these application tables or use a database outside Supabase; access to app data belongs to the API. Tokens need a UUID subject, an email, the `authenticated` audience, and expiry. No Supabase account or deployment was created by this implementation.

## Two-user walkthrough

All application requests require `Authorization: Bearer <token>` and JSON request bodies where shown.

1. Alice creates a pair with `POST /pairs` and `{ "name": "Our pair", "timezone": "Asia/Calcutta" }`.
2. Alice creates an invite with `POST /pairs/invites` and `{ "email": "bob@example.com" }`. Bob accepts it with `POST /pairs/invites/accept` and `{ "token": "<returned token>" }`.
3. Alice proposes a habit with `POST /goals` and `{ "title": "Walk", "weekdays": [1, 3, 5], "requiredCount": 2, "weeklyTokens": 10 }`. Weekdays use Monday=1 through Sunday=7. Bob approves using `POST /goals/<id>/approve`.
4. Starting the next local Monday, Alice records progress with `POST /goals/<id>/check-ins` on a scheduled day. `DELETE /goals/<id>/check-ins/today` undoes the current day's record. Dates come from the server and pair timezone.
5. After the week closes, either member calls `POST /wallet/settle`. `GET /wallet` returns the caller's balance and `GET /wallet/ledger` explains each award and spend.
6. Bob proposes a reward with `POST /rewards` and `{ "title": "Choose our weekend activity", "fulfillmentExpectation": "Plan it together", "cost": 7 }`. Alice approves with `POST /rewards/<id>/approve`.
7. Alice redeems with `POST /rewards/<id>/redeem`, supplying a unique `Idempotency-Key` header of 8–128 characters. Reuse that key on network retries; a distinct intentional redemption uses a new key. An insufficient balance returns 409 without changing any rows.
8. Bob marks fulfillment with `POST /rewards/redemptions/<id>/fulfill`. Both see requests through `GET /rewards/redemptions`.

All routes above are relative to `/api/v1`. Full initial endpoints and boundaries are in [the backend contract](docs/BACKEND_CONTRACT.md).

## Checks

```powershell
npm run typecheck
npm test
npm run build
$env:TEST_DATABASE_URL = 'postgresql://pair_app:pair_app_local@localhost:5433/pair_habits?schema=public'
npm run test:integration
```

The PostgreSQL suite creates a randomly named test schema, applies the real migration, runs authenticated HTTP requests through the application, and drops only that generated schema. It checks pairing and scope, goal approval, date boundaries, duplicate check-ins, concurrent awards and spending, insufficient funds, fulfillment, and database-enforced ledger immutability. It fails clearly if `TEST_DATABASE_URL` is missing. Unit tests cover signed-token rejection, membership rules, configuration, local calendar calculations, approval and settlement logic.

`PrismaService` uses Serializable transactions and bounded retries for database write conflicts. Unique goal/week keys prevent duplicate awards, while redemption keys are scoped to a spender and reject reuse for a different reward. SQL composite foreign keys keep actors in the object's pair; membership slots cap pairs at two. Application commands are the only way to award or spend tokens. The ledger has a trigger blocking row updates and deletes. Account deletion needs a deliberate retention policy before it is implemented.

The root dependency override pins a patched `deepmerge-ts` used by Prisma's CLI; Prisma and its generated client remain on the same version. CI repeats typechecking, tests, PostgreSQL integration tests and the production build. Repository source is organized by domain under `backend/src` and migrations under `backend/prisma`.

Verification on 11 October 2026: production build and typecheck passed; 30 unit tests and 8 PostgreSQL integration tests passed. The runtime dependency audit (`npm audit --omit=dev`) reported zero vulnerabilities. The full audit reported 20 moderate advisories in the development dependency graph; those remain to be addressed without forcing incompatible package downgrades.
