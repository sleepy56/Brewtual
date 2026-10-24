# Personal planner and token markets

Brewtual opens a personal planner after sign-in. Partner onboarding no longer replaces the other pages. Tasks, Dailies, and Goals work with no partner or group membership.

## Personal planning

- **Task list:** one-time tasks, optional due dates, private notes, completion/undo, and archive/restore.
- **Dailies:** recurring tasks on selected weekdays. Their timezone is recorded at creation; each scheduled local date has one completion. A new day starts automatically from the server-calculated local date, without a background reset job.
- **Goals:** a target number of steps, optional due date, progress controls, private notes, and archive/restore. A completed Goal keeps its target; create another Goal for another milestone.
- **Today:** your due Dailies, next tasks, and links to your longer-term Goals.

Personal notes stay private. Archiving is reversible. Regular completions can be undone; completions that already earned tokens are final to prevent repeated collection or spending followed by reversal.

## Connect only when ready

Use Together to create or join a partner space or a friend circle. The market for each space unlocks when it contains at least two people. A one-person partner space or group does not block personal planning.

Partner tokens use the existing partner ledger, preserving the previous wallet balance. Every friend circle has its own ledger. Partner, Group 1, and Group 2 tokens cannot be pooled or spent across spaces.

## Ask for tokens

1. Open a personal task, Daily, or Goal and choose **Ask for tokens**.
2. Pick a connected space and propose a token amount. Dailies earn that amount per scheduled day; Tasks and Goals earn it once on completion.
3. Another member reviews the request in that space’s Token market. One other member’s approval is sufficient in a group. Owners cannot approve their own request.
4. Complete the work after approval. The server credits each approved space exactly once for that completion. Work finished before approval is not awarded retroactively.

The selected space sees the task’s title, type, target/progress, schedule, and due date. Notes remain private. Changing the title, target, schedule, or due date requires fresh approval. A task can have separate token agreements with different spaces, each backed by its own approval and balance.

## Rewards

Offer a reward with a title, a clear fulfillment expectation, and a token cost. Another member approves the offer before it becomes available. A member can spend only that space’s tokens and cannot redeem their own offer. Redemption creates a plan for the offerer to mark fulfilled.

Redemption and completion awards are transactional. Stable request keys protect redemption retries. Database uniqueness prevents duplicate awards, and serializable transactions protect competing spends.

Existing partner habits and rewards remain under **Settings > Previous partner habits & rewards**. Their records are preserved, and personal-task partner awards flow into the same partner wallet. Existing rewards remain in that previous view; new market offers are made in Token market.

## API

All endpoints require authentication under `/api/v1`.

| Method/path | Purpose |
| --- | --- |
| `GET/POST /planner/tasks` | List or create private personal tasks |
| `POST /planner/tasks/:id/edit` | Edit an owned task; material changes requeue approval |
| `POST /planner/tasks/:id/archive` | Archive or restore with `{archived}` |
| `POST /planner/tasks/:id/complete` | Explicit `{completed}` for a Task or Daily |
| `POST /planner/tasks/:id/progress` | `{delta: 1}` or `{delta: -1}` for a Goal |
| `POST /planner/tasks/:id/request-tokens` | `{scopeKind,scopeId,tokens}` |
| `GET /planner/spaces` | Member spaces, connected status, and separate balances |
| `GET /planner/market?scopeKind=PAIR|GROUP&scopeId=...` | Requests, offers, redemptions, and the caller’s ledger in one connected space |
| `POST /planner/requests/:id/decide` | Another member accepts or declines with `{approve}` |
| `POST /planner/rewards` | Offer a reward in a connected space |
| `POST /planner/rewards/:id/decide` | Another member accepts or declines an offer |
| `POST /planner/rewards/:id/redeem` | Redeem with a stable `Idempotency-Key` header |
| `POST /planner/redemptions/:id/fulfill` | Offerer marks fulfillment |

## Migration and verification

Run `npm run db:migrate` before deploying this version, including on existing databases. The additive `20261023190000_personal_planner` migration creates the new records and adds the `TASK_AWARD` ledger reason; it preserves previous partner and circle data.

Unit and API tests cover ownership, solo use, scheduled local-day completion, approvals, duplicate awards, balance separation, and redemption retry behavior. Component tests cover navigation with no partner, a waiting partner, and connected spaces. `test/integration/planner.integration.spec.ts` additionally exercises real PostgreSQL transactions, concurrent completion, competing spends, and group isolation using an isolated local test schema. It requires a running local database and `TEST_DATABASE_URL`; it never accesses a hosted database.

The responsive website and home-screen app include the new planner. The separate Expo client retains its previous partner screens and correctly labels new task awards in its existing wallet.
