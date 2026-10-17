# Pair Habits: provisional design preview

**Standalone design source:** [mobile/pair-habits-preview.html](../mobile/pair-habits-preview.html)  
**Design owner:** Sanket's partner  
**Purpose:** a sample mobile design and two-user walkthrough for discussion, not final visual sign-off

The starting direction is **Midnight garden**, a calm dark palette with sage accents, serif headings, and simple cards. **Dawn**, **Plum**, and **Ocean** demonstrate theme alternatives in Settings. This reflects the user's dark-first and multiple-theme request, which supersedes the earlier brief's light-first/optional-dark suggestion. Branding and final visual decisions remain open.

The source brief is [UI_REQUIREMENTS.md](UI_REQUIREMENTS.md); product mechanics come from [PRODUCT_PLAN.md](PRODUCT_PLAN.md). [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md) and the [repository README](../README.md) define the implemented API slice. The broader signed-in design includes planned personal-v1 features as well as that slice.

## Review the concept

Open or share `mobile/pair-habits-preview.html` directly in a modern browser. It contains the complete design, inline CSS, JavaScript, and SVG icons; no supporting files, installation, server, or build step are needed. Edit that same HTML file to change the design. The desktop review stage presents a phone-sized app with screen shortcuts. Narrow screens present the app itself, with prototype controls below. Four persistent destinations are Today, Goals, Rewards, and Activity; Settings is reached through profile and Approvals through prominent badges/actions.

Alex and Jamie are fictional peers. The role switch demonstrates who owns a habit, who reviews a proposal, and who offers/fulfills a reward. Local state, reset, and fictional-data export are prototype conveniences. Preview states are **normal, offline, empty, pending award, error, and loading**; these are selected simulations, not evidence of actual connectivity or backend failure.

## Screen and flow coverage

“Backend supported” below describes the API contract, not a connection from this HTML. All preview actions operate locally.

| Screen | Behavior to review in the sample | Current backend boundary |
|---|---|---|
| Landing | Private two-person promise, three-step explanation, sign-in/join entry | Public presentation only; no marketing frontend implemented |
| Sign-in | Email field, privacy copy, recovery/error presentation | API verifies managed bearer identity; HTML does not authenticate or send links |
| Pair setup | Pair names, shared timezone, invitation and waiting states | Pair creation and email-bound invite acceptance supported; invites are manually shared tokens, no email delivery |
| Today | Local date, own due habits, one-tap progress, same-day undo, partner snapshot, approvals, available tokens | Recurring check-in/undo and settlement supported; no backdating or speculative available balance |
| Goals | Owner/status filters; recurring and milestone cards, proposals and history | Recurring goals with pending/active/rejected states supported; milestones and paused/archived states are later |
| New goal | Type/owner, title, days/weekly count or milestone criteria, token amount, live human-readable terms | Initial API creates recurring goals owned by caller; count must not exceed scheduled days. Arbitrary owner selection and milestone terms need later contract work |
| Goal detail | Approved terms, start date, week grid, result history, pending edits, milestone claim, pause/archive | Approved recurring terms/check-in history supported; edit versions, claims, pause/archive are later |
| Approvals | All token-affecting terms, proposer/reviewer, effective date, approve/reject/request changes, milestone review | Recurring goal and reward approve/reject supported; changes, withdrawal, version comparisons, milestone/rule review are later |
| Rewards | Approved items, prices, offerer/fulfillment terms, visible unaffordable items, proposal entry, rule buyouts | Reward proposal/approval supported; rule/buyout catalog and retirement are later |
| Redeem review | Exact cost, remaining balance, requested fulfillment or exact rule consequence, clear spend confirmation | Reward spend is atomic and requires a retry-safe operation key; rule retirement is later |
| Activity | Signed token entries with source/reason/date, available balance, requested/fulfilled items, neutral missed-week explanation | Current member ledger, zero-award settlement history, and pair redemptions supported; compensating corrections have no client route |
| Settings | Four appearance choices, pair/invite/timezone, device notification/install choices, export, leave/delete, sign-out | Appearance is local to preview. Initial API has no timezone edit, push, export, unlink, or deletion endpoints |

## Behavioral rules for the final frontend

- Either partner may propose; the proposer cannot approve their own terms. Only the owner checks in, only the partner approves a milestone claim, and only the offerer records reward fulfillment.
- A recurring habit approved today becomes eligible on the first local Monday strictly after approval. Monday–Sunday weeks use one pair-wide IANA timezone. Required completions cannot exceed scheduled days.
- “Saved for today,” “week qualified; award pending,” and “tokens awarded” are distinct outcomes. Check-ins do not immediately add spendable tokens. A missed week earns zero and never creates debt.
- The frontend must call wallet settlement on app opening, following its continuation flag, before presenting a settled balance. Retried visits and actions must not duplicate an award or spend.
- Edits keep approved terms active until the proposed version is approved for the next week. Pause/archive also take effect next week and retain history. These are planned backend capabilities.
- Rewards remain visible when unaffordable, with the exact shortage. Confirming a reward deducts its snapshotted cost and creates a requested item. Fulfillment records the partner's acknowledgment.
- Rule buyouts need mutually approved terms. Review names the affected rule, immediate retirement, cost, remaining balance, and lack of in-app undo; retired rules remain historical. This flow is planned backend work.
- Offline and pending presentations retain confirmed information. A failed save restores confirmed progress and offers retry; unconfirmed spending must be prevented. Destructive actions require an explicit consequence and confirmation.

## Component and theme handoff

The theme foundation is the inline `<style>` block in [pair-habits-preview.html](../mobile/pair-habits-preview.html). CSS custom properties define background, surface, secondary surface, primary/secondary text, border, accent/on-accent, success, warning, danger, and focus, plus hero colors. Theme overrides preserve the same hierarchy. The surrounding desktop design canvas remains dark while the app palette changes.

Body, helper text, labels, and controls use **Segoe UI** with system fallbacks. Page/editorial headings use **Georgia** with serif fallbacks. Base cards use an **18px radius**; smaller controls and sheets use related sizes. Repeated spacing is approximately **4, 8, 12, 16, and 24px**, with 16–22px mobile gutters. A production component library should formalize these values and document every component state.

Reusable patterns include goal cards, weekly grids/progress counts, proposal terms, token displays linked to Activity, reward/rule cards, review dialogs, signed ledger rows, and feedback blocks. Status must combine readable text/icons with color. Use encouraging adult language; fictional rewards should be shared outings, chosen activities, or hobby support.

The review targets are **320, 390, 768, and 1440px**, with no horizontal page scrolling at 320px and useful overview space on desktop. Review 200% zoom, comfortable 44px action targets, visible keyboard focus, dialog focus containment/return, persistent labels and specific validation, polite save announcements, reduced motion, and contrast in all four themes. The final app targets the accessibility criteria in the source brief; a preview is not a certification.

## Preview verification

The finished standalone HTML was opened in the app browser. The main screens were checked at 320, 390, 768, and 1440px; the inspected narrow layouts had no horizontal overflow. A tablet overlap between screen shortcuts and review controls was corrected. All four theme selections were checked in Settings.

The walkthrough verified daily check-in and undo without changing available tokens, recurring-target validation, proposal review from the other person's account, next-Monday activation, an exact 24 → 16 token reward review, offerer-only fulfillment, offline mutation prevention, and a closed-week award that remains single after retry. Browser inspection reported no script errors for the portable preview. Source scripts passed syntax checks.

These are checks of the fictional local prototype. Real API integration, comprehensive accessibility testing, 200% browser zoom, screen readers, installation, and push delivery still need separate verification.

## Remaining gaps

- Visual identity, illustrations, final strings, color/spacing decisions, and theme selection remain for the designer to refine.
- State controls are representative presentations, not an exhaustive test of expired/wrong-account invites, stale approvals, retries, permission denial, unsupported devices, or every server error.
- The HTML does not exercise real identity, authorization, concurrent actions, durable ledger writes, notification delivery, installation, deletion, or hosting. Production persistence and synchronization remain separate work.
- Planned personal-v1 flows need new backend endpoints and a connected frontend. Export/unlink/delete policies must explain shared-history effects before public release.
- Actual-device accessibility review, screen-reader/zoom checks, and backend integration remain outstanding. The preview checks above do not certify production readiness.

Design sign-off should use the source brief's two-user checklist: both people understand the agreement, when tokens become available, what a redemption changes, and what remains pending after each action.
