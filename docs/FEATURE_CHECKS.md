# Feature and layout checks

Checked on 8 November 2026 using Node 24 and an isolated local PostgreSQL instance. All accounts, invitations, notes, and tokens used for browser testing were fictional. Production accounts and data were not changed.

## Pages and spacing

The web app now carries Solaris and Cozy through Tasks, Dailies, Goals, Shared notes, Token market, Together, Activity, Settings, account forms, dialogs, and the previous partner-habit screens.

All nine main planner sections were measured at 320px in both themes and at 768px and 1440px in Solaris. No horizontal overflow was found. Checks included wrapping titles, shared-editor controls, form fields, card padding, button wrapping, and clearance above the bottom navigation. Header and completion controls have 44px targets. Long note titles wrap and grow instead of clipping inside a single-line field.

## Functional coverage

| Flow | Verification |
| --- | --- |
| Accounts | Browser sign-in, saved appearance, session restoration, and sign-out; automated signup, verification, refresh, revocation, and failure cases |
| Tasks | Browser creation, private-note retention, editing, archive/restore, and token-request entry; automated completion/undo and ownership checks |
| Dailies | Browser weekday selection, rejection of an empty schedule, completion, and a real token award; automated local-date and duplicate-award checks |
| Goals | Browser progress and undo; automated creation, target bounds, and completed-goal protection |
| Partner linking | Browser reproduction with two waiting spaces; successful connection and preserved shared note/private task; database checks for pending habits/rewards, crossed codes, existing couples, and wallet preservation |
| Friend circles | Browser creation, goals, cheers, milestone promises, invite generation, and clearing old codes when switching circles; database checks for joining multiple groups and membership isolation |
| Notes | Browser creation, editing, manual save, automatic save, and notebook switching; database checks for membership, new members, conflicting edits, and safe version updates |
| Token markets | Browser request/offer approval, redemption, balance changes, and separate space selection; database checks for concurrent spending, stable retries, and offerer-only fulfillment |
| Activity | Browser space switching and ledger views; automated award/redemption records and isolated balances |
| Previous partner features | Browser habit proposal and return to planner; database/API coverage for invitations, approvals, check-ins, weekly settlement, and rewards |
| Failure handling | Automated blocked/failed requests, retry, duplicate-click protection, unsaved-note navigation, unavailable personal planning, clipboard fallback, and unconfirmed sign-out |

## Partner-code fix

Creating a one-person partner space no longer makes an account ineligible to accept its partner’s code. Joining carries waiting-space notes, pending legacy habits/rewards, and market offers into the joined space. Personal tasks remain private. Previously active market terms require the new partner’s approval.

Together displays the linked partner’s account email. Re-entering a code for an existing couple is safe. Established two-person connections cannot be replaced through a code. A waiting space with ledger history must invite the other person into that space; its token history is never rewritten or silently moved.

Both PAIR codes and previous email-bound invitations use the same joining rule. No additional database migration is needed for this fix; all existing migrations, including shared notes, are still required.

## Automated results

| Check | Result |
| --- | --- |
| `npm test` | 110 server tests and 26 web tests passed |
| `npm run test:integration` | 19 real PostgreSQL tests passed |
| `npm run mobile:test` | 9 native-client transport/calendar/mapping tests passed |
| `npm run mobile:typecheck` | Passed |
| `npm run build` | Passed, including TypeScript checks |
| `node --test test/vercel-routing.test.cjs` | Built-server smoke test passed, including database-outage handling |

## Remaining verification

The separate native UI was not redesigned. Physical iOS/Android layouts, home-screen installation prompts, real SMTP delivery, and production-account linking were not exercised. These changes are local and have not been deployed. The page layouts can be refined when the remaining designer references arrive.
