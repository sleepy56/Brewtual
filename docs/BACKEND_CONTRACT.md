# Backend implementation contract

Existing slice: a NestJS TypeScript API, PostgreSQL, Prisma 6, and app-owned authentication. This implements pairing, recurring goals, partner approval, same-day check-ins, closed-week awards, and reward approval/redemption/fulfillment. The Expo client connects signup, email verification, sessions, pairing, goals, rewards, wallet and activity; the fictional demo remains separate. JWT sessions, password provisioning, refresh rotation and revocation are implemented; Supabase is not used. Milestones, versioned goal edits, pause/archive, rule buyouts, push, export and account deletion are later slices.

Hosting/client update (17 October 2026): one root Vercel project builds the existing API and Expo static web on the same origin. See [deployment and mobile configuration](DEPLOYMENT_AND_MOBILE_PLAN.md). Prisma runtime uses `DATABASE_URL`; migration commands use `DATABASE_URL_UNPOOLED`. Transaction wait/duration limits are validated environment values.

## Shared boundaries

- Source lives in `backend/src`; CommonJS application code, decorators enabled, strict TypeScript. NestJS 12 with Prisma/client pinned together to 6.19.3. Minimum Node 24.9 to support Jest's synchronous loading of ESM dependencies; the bundled Node 24 runtime is used for local checks. Older initial scaffold packages were replaced after the dependency audit.
- `DatabaseModule` globally exports `PrismaService` extending `PrismaClient`. Its `runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` uses Serializable isolation with bounded retries for Prisma P2034.
- Auth contract: app-owned signed JWT, backend-only `JWT_SECRET`, `JWT_ISSUER=pair-habits`, and `JWT_AUDIENCE=pair-habits-api`. The guard must resolve the subject to an existing database user; it must not auto-provision from a token. Keep `AUTH_MODE=local` signed tokens for development/test only. Production JWTs require an active database session (`sid`) as well as an existing account. Login, refresh and logout are public POST routes with strict DTOs, rate limits and browser Origin validation. See [authentication plan](AUTHENTICATION_PLAN.md).
- Email/password signup and confirmation use a pending registration record and require the registration password on confirmation. Existing accounts are backfilled as verified. Login, refresh and JWT authorization reject unverified accounts. See [the exact auth API contract](AUTHENTICATION_PLAN.md). Phone login remains future work.
- `PairsModule` exports `PairAccessService`. `requirePair(userId)` returns membership with its `pair` relation and throws when absent; callers use `membership.pairId` and `membership.pair.timezone`. `GET /pairs/current` also returns both member slots, IDs and emails. Pair creation/acceptance is limited to one pair per user and exactly two slots; timezone edits are not available in this slice.
- All protected reads and writes scope by pair membership. Transactions recheck mutable state. Proposers cannot self-approve; goal owners alone check in; only the reward offerer marks fulfillment.

## Prisma model fields (relation names may be chosen by database agent)

All IDs are UUID strings; all timestamps are UTC. Use matching enums and names below.

- `User`: `id`, `email` (unique), `createdAt`.
- `Pair`: `id`, `name`, `timezone`, `createdAt`.
- `Membership`: `id`, `pairId`, `userId` (unique), `slot` (1 or 2), `createdAt`, relation `pair`; unique `(pairId,slot)`.
- `Invite`: `id`, `pairId`, `createdById`, `email`, `tokenHash` (unique), `expiresAt`, `acceptedAt?`, `createdAt`.
- `Goal`: `id`, `pairId`, `ownerId`, `proposedById`, `title`, `description?`, `weekdays` (Int array; ISO Monday=1 to Sunday=7), `requiredCount`, `weeklyTokens`, `status` (`PENDING`, `ACTIVE`, `REJECTED`), `approvedById?`, `approvedAt?`, `startsOn?` (YYYY-MM-DD string), `createdAt`.
- `CheckIn`: `id`, `goalId`, `userId`, `localDate` (YYYY-MM-DD), `createdAt`; unique `(goalId,localDate)`.
- `WeeklySettlement`: `id`, `goalId`, `weekStart` (YYYY-MM-DD), `completedCount`, `requiredCount`, `awardedTokens`, `createdAt`; unique `(goalId,weekStart)`. Record zero-token outcomes too.
- `Reward`: `id`, `pairId`, `offeredById`, `title`, `description?`, `fulfillmentExpectation`, `cost`, `status` (`PENDING`, `ACTIVE`, `REJECTED`), `approvedById?`, `approvedAt?`, `createdAt`.
- `Redemption`: `id`, `pairId`, `rewardId`, `spenderId`, `cost`, `idempotencyKey`, `status` (`REQUESTED`, `FULFILLED`), `createdAt`, `fulfilledAt?`; unique `(spenderId,idempotencyKey)`.
- `LedgerEntry`: `id`, `pairId`, `userId`, `amount` (signed integer), `reason` (`WEEKLY_AWARD`, `REWARD_REDEMPTION`), `sourceId`, `idempotencyKey` (globally unique), `createdAt`. Append-only SQL trigger disallows UPDATE/DELETE. No client route can write arbitrary entries.

SQL constraints enforce positive targets/prices, nonzero ledger amounts, weekdays 1–7, requiredCount <= schedule length, slots, and pair consistency wherever practical. Every spend sums ledger inside a serializable transaction; unique operation keys prevent duplicated awards and retry spends. Reusing a redemption key for another reward returns conflict.

## Initial HTTP contract

Prefix `/api/v1`. JSON request bodies use strict class-validator DTOs. All protected routes use bearer JWTs.

- `GET /health` public; `GET /health/ready` public database check.
- `GET /me`; `POST /pairs` `{name,timezone}`; `GET /pairs/current`.
- `POST /pairs/invites` `{email}` returns one-time invite token; no email is sent. A new invite invalidates an older outstanding invite for that pair. `POST /pairs/invites/accept` `{token}` verifies recipient email, expiry, empty slot atomically.
- `GET /goals`; `POST /goals` `{title,description?,weekdays,requiredCount,weeklyTokens}`; `POST /goals/:id/approve`; `POST /goals/:id/reject`; `POST /goals/:id/check-ins`; `DELETE /goals/:id/check-ins/today`.
- `POST /wallet/settle` settles every closed eligible week for the pair; `GET /wallet` returns current member balance; `GET /wallet/ledger` pair-scoped current member history. Settlement is explicit for this API slice; the future frontend calls it on opening the app. Bound settlement work per request with a clear continuation flag.
- `GET /rewards`; `POST /rewards` `{title,description?,fulfillmentExpectation,cost}`; `POST /rewards/:id/approve`; `POST /rewards/:id/reject`; `POST /rewards/:id/redeem` requires `Idempotency-Key` header (8–128 characters); `GET /rewards/redemptions`; `POST /rewards/redemptions/:id/fulfill`.

Application clock injectable for deterministic timezone/week tests. Recurring approval starts first local Monday strictly after approval. Check-ins never backdate. Settlement only after week ends; undo only current local day. No token debt. No deployment or external account creation in this implementation.
