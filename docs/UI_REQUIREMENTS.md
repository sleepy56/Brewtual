# UI and UX requirements: two-person habit and rewards app

> **Client decision, 14 October 2026:** The primary UI is now planned as React Native + Expo for Android and iOS, backed by the existing NestJS API and Neon PostgreSQL. The product flows and states below remain useful; web layout/PWA installation details describe a future optional browser client. Mobile notifications and app installation will use native/Expo workflows. Flutter is excluded for now. See [the current hosting and mobile plan](DEPLOYMENT_AND_MOBILE_PLAN.md).

**Status:** design brief for the first private web app  
**Companion:** [product and technical plan](PRODUCT_PLAN.md)  
**Design owner:** Sanket's partner; this brief defines behavior and handoff, while leaving visual identity open

## 1. Experience goal

Two people should be able to agree on a manageable goal, track it in seconds each day, understand exactly when tokens are earned, and spend them on an agreed experience without arguing about what the app recorded. The interface should feel like a shared encouragement tool for adults: warm, calm, and a little playful, with clarity taking precedence over animations or scores.

### Jobs the interface must support

1. **Set an agreement:** “I want to go to the gym three times a week. What do we both agree counts, and what is it worth?”
2. **Record progress:** “I did it today; I want to mark it in one tap and know it was saved.”
3. **Understand an award:** “Why did I receive two tokens this week, or why did I receive none?”
4. **Choose a reward:** “What can I redeem now, who is offering it, and what will happen next?”
5. **Change an agreement:** “We no longer want this rule. What exactly happens if I buy it out?”

The other partner's experience matters equally: proposals and milestone claims need clear review, and a redeemed favor needs a clear “requested → fulfilled” path. Neither member is an administrator over the other.

## 2. Information architecture

### Primary navigation

| Destination | Content | Persistent cue |
|---|---|---|
| Today | Due habits, recent check-ins, weekly progress, partner's summary, pending approvals | Due count and approval badge |
| Goals | Recurring and milestone goals, owner/status filters, goal details | Pending proposals count |
| Rewards | Approved reward catalog and approved rule buyouts | Affordable items may be highlighted, never hidden items |
| Activity | Balance, ledger, redemption/fulfillment timeline | Available balance |
| Settings | Pair identity/timezone, notification choices, account actions | Accessible through profile control |

Keep **Approvals** as its own route, reachable from Today, Goals, Rewards, and the badge. Do not bury it under Settings. The public landing and sign-in/setup screens sit outside the signed-in navigation.

### Screen inventory and minimum content

| Screen | Required content | Main action | Essential states |
|---|---|---|---|
| Landing | One-sentence promise, three-step explanation, privacy-first invitation CTA | Sign in / join | Signed out, already signed in |
| Sign in | Email-based access, recovery, plain privacy note | Continue | Sending, invalid/expired link, network error |
| Pair setup | Pair name or nicknames, invite status, pair timezone | Create/accept invite | Awaiting partner, expired invite, pair full |
| Today | Date, token balance, today's due habits, weekly target progress, partner snapshot, approvals entry | Check in | No goals, all done, offline, pending award |
| New goal | Recurring/milestone selection, owner, title, schedule or done criteria, token amount, live summary | Send proposal | Unsaved draft, invalid target, pending approval |
| Goal detail | Active approved terms, current week grid/progress, history, changes and status | Check in or claim milestone | Proposed, active, paused, archived, pending edit |
| Approvals | Proposal type, before/after terms, who proposed, effective date | Approve or request changes | Empty, changed since opened, action failed |
| Rewards | Balance, catalog price, offerer, fulfillment expectation, rule buyouts | Redeem / propose | Unaffordable, pending approval, sold/retired |
| Redeem review | Exact item/rule, token cost, balance after spend, effect and next step | Confirm spend | Processing, duplicate tap, insufficient balance |
| Activity | Available balance, chronological signed ledger entries, redemption status | Inspect item | No entries, pending fulfillment, corrected entry |
| Settings | Pair details, timezone, notification/device choices, export, leave/delete, sign out | Save settings | Permission denied, unsupported device, confirmation and error states |

The first private release may use a simple landing page or bypass it entirely after sign-in. The rest of the signed-in screens are required for the full personal v1 described in the companion plan.

## 3. Detailed flows

### Flow A — agree on a recurring habit

1. From Today or Goals, select **New goal** and **Recurring habit**.
2. Enter a specific title, optional explanation, scheduled days, weekly required count, and token amount.
3. Show a human-readable preview before submission, for example: “Gym • Mon, Wed, Fri • complete 2 of 3 scheduled days • earn 2 tokens per qualifying week.”
4. Sender sees **Waiting for partner** and can withdraw the proposal. Partner sees a badge and an approval card with all terms, including when the terms start.
5. Approve activates the goal on the agreed start date. Request changes returns it to the sender with an optional short note. Reject removes it from the active list but keeps a basic activity record.

**Acceptance:** neither person's goal can silently change from proposed to active. The reviewer can see every term that affects tokens without opening a second screen.

### Flow B — check in and earn

1. Today lists scheduled habits for the signed-in person, with a single **Mark done** control on each card.
2. A successful tap updates the card immediately and announces “Saved for today.” An undo remains available until the end of that local day.
3. A weekly progress line shows “2 of 3 needed this week,” plus individual scheduled days. It never implies a token was already earned before the week closes.
4. When the week is settled, Activity shows one dated award, its goal, the qualifying count, and the agreed amount. For a nonqualifying week, goal history explains the result in neutral language.

**Acceptance:** refreshing, revisiting, or retrying a tap cannot award twice. The interface can distinguish **progress recorded**, **week qualified but not yet settled**, and **tokens awarded**.

### Flow C — complete a milestone

1. Owner opens an active milestone, reads the approved “done” criteria, and selects **Claim complete**.
2. Partner sees the criteria and claim in Approvals and chooses **Approve completion** or **Request changes**.
3. Approval displays the token award and archives/completes the milestone; request for changes returns it to active without an award.

**Acceptance:** a milestone award appears once and names the partner approval that caused it.

### Flow D — redeem a favor or experience

1. Rewards lists approved items with cost, offerer, and a short fulfillment description. Unaffordable items stay visible with the amount still needed.
2. A review sheet shows the exact cost and new balance. Confirmation spends the tokens and creates a pending request.
3. The offering partner sees the request and can mark it fulfilled. Both members can view status in Activity.

**Acceptance:** a failed payment-like action never reduces the balance, and a fast second tap never creates a second redemption. “Fulfilled” refers to the partner's recorded acknowledgment, not an app guarantee about the real-world event.

### Flow E — retire an agreed rule

1. Rules appear under Rewards with plain-language terms, who is affected, and the pre-agreed buyout cost.
2. Before spending, show **which rule will stop**, **when it stops**, **token cost**, and **balance after spend**. Use an explicit confirmation label such as **Spend 20 tokens and retire this rule**.
3. After confirmation, show a dated “Rule retired” record, remove the rule from active rules, and preserve it in history.

**Acceptance:** a rule cannot be purchased before both members have approved the buyout terms. A retired rule never appears active again unless both propose and approve a new rule.

### Flow F — install and receive notifications

1. Offer an optional **Install app** explanation after sign-in, tailored to the current device. On Android, use the browser's installation path when available; on iPhone, explain how to add the site to the Home Screen.
2. Ask for notification permission only after a person selects **Enable notifications**. Explain that approval requests and reward requests can appear on the lock screen. Keep notification body text discreet by default.
3. Store a subscription per device so either person can enable or disable notifications on each phone independently. Settings must show whether this device is enabled, denied, or unsupported.
4. Tapping a notification opens the relevant approval or reward request after sign-in. The in-app inbox remains the source of truth if a notification is missed.

**Acceptance:** the installed app has its own icon and standalone display; event-based push is tested on the actual Android and iPhone versions used by the pair. iPhone Web Push requires a Home Screen web app on iOS 16.4 or later. Timed habit reminders are a separate scheduling feature and must state their delivery limits before being promised.

## 4. Component and state requirements

### Required reusable components

- App shell: responsive navigation, page title, profile menu, approval badge.
- Goal card: owner, type, status, schedule/criteria, current progress, primary action.
- Week progress: local date labels, check-in states, required count and remaining count; no color-only meaning.
- Proposal comparison: current terms vs proposed terms, effective date, approve/request-changes controls.
- Token display: available amount with a link to the ledger; label “tokens,” not “money” or “cash.”
- Reward card and rule card: cost, who offers/is affected, approval state, affordability, details.
- Confirmation sheet/dialog: action, consequence, cost, remaining balance, cancel and confirm.
- Activity row: date, reason, signed amount, status, link to source goal/redemption.
- Empty, loading, saving, success, error, and offline blocks with useful next actions.

### State behavior

| Situation | Required feedback |
|---|---|
| No goals yet | Explain the first step and offer **Propose a goal** |
| Partner has not joined | Show invite state and a safe resend/copy action |
| Goal awaits approval | Show who needs to act and prevent check-ins against unapproved terms |
| A check-in is saving | Disable repeated submission; keep the previous confirmed state visible |
| Save fails | Restore previous state, explain what failed, offer retry |
| Week has ended but settlement is pending | Label award as pending; do not add it to available balance |
| Insufficient tokens | Keep item visible; show “You need X more tokens” |
| Reward request is outstanding | Show request and fulfillment status to both members |
| Rule is retired | Mark as historical with date and show no active redemption action |
| Network is unavailable | Show last confirmed data with its sync state; prevent unconfirmed spending |

## 5. Content and visual direction

### Tone

Use direct, encouraging language. Prefer **“2 of 3 completed this week”** and **“No tokens earned for this goal this week”** over guilt-oriented streak language. Avoid “failed,” “punishment,” and romantic obligation copy. Success feedback can be delightful but should not interrupt the next task.

For rewards, use examples such as a shared outing, choosing a weekend activity, or help with a hobby. Do not preload affection or intimacy as priced rewards. Let the pair write their own terms, while keeping all proposed commitments visible and mutually approved.

### Visual system for the designer to define

- Create a small semantic token set: page/background/surface, primary text, secondary text, border, accent, success, warning, danger, and focus. Verify contrast in actual component contexts.
- Define typography for page title, section title, body, label, helper text, numeric balance. Numbers in ledger and progress should be easy to scan.
- Define spacing, radii, elevation, and icon rules. Favor simple cards and timelines over dense dashboard charts.
- Define light mode first; dark mode is optional after the core screens are stable.
- Motion, if used, should reinforce saved, earned, or redeemed events and respect reduced-motion settings.
- A distinctive brand can be added without changing the information hierarchy. Avoid visuals that make the app resemble a children's chore chart or a financial wallet.

## 6. Responsive and accessibility requirements

Design and inspect at **320 px**, **390 px**, **768 px**, and **1440 px** widths. The mobile layout is the primary design. On phones, check-in and proposal approval controls must be reachable without precision tapping; aim for a comfortable **44 × 44 px** target even where a smaller target could technically pass a standard. No horizontal page scrolling at 320 px. Desktop should use the wider space for overview and side-by-side comparison, not stretch mobile cards across the full viewport.

Target **WCAG 2.2 AA** for the web app. In particular:

- Normal text contrast at least **4.5:1**; important component boundaries and state icons at least **3:1** where applicable.
- Keyboard access and visible focus for every actionable element; dialogs trap focus appropriately and return it after closing.
- Focus must remain visible above sticky mobile navigation and sheets.
- Every input has a persistent label, instructions, and specific error text. Never convey status with color alone.
- Screen readers receive clear action names, progress counts, and a polite announcement after a check-in or award.
- At 200% zoom, content remains usable with no clipped controls; reduced-motion preferences suppress nonessential animation.

The contrast, target-size, and focus criteria are grounded in the [W3C WCAG 2.2 recommendation](https://www.w3.org/TR/WCAG22/) and its [target-size explanation](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). The 44 px target is a product comfort goal, not the WCAG minimum.

## 7. Trust, privacy, and safety in the interface

- Show only the pair's shared goal data to the two members. Never use private real data in public screenshots or a demo account.
- Make all token-affecting terms visible before approval and all ledger entries inspectable afterward.
- Pair members can pause or archive goals without losing history. Display the effective date when a change affects future weeks.
- Export, unlink, and account deletion entry points belong in Settings before public release; destructive actions require clear confirmation and explain effects on shared history.
- If an action cannot be undone in-app, say so at the confirmation point. This matters especially for rule retirement and deletion.
- The interface does not claim to verify health outcomes, weight loss, or that a partner actually delivered a reward.

## 8. Design handoff and sign-off

### Designer deliverables

1. A simple journey map for proposal → approval → check-in → award → redemption, plus the milestone and rule-buyout branches.
2. Mobile wireframes for every signed-in screen in Section 2, then high-fidelity versions for Today, New Goal, Approvals, Goal Detail, Rewards, Redeem Review, and Activity.
3. One desktop adaptation for Today, Approvals, and Rewards; responsive rules for the remaining screens.
4. A component library with semantic color/type/spacing tokens and every state in Section 4.
5. A clickable two-user prototype. It must show which person is acting and what the other person sees afterward.
6. Handoff notes for strings, validation, loading/error behavior, and motion; a fictional demo dataset for portfolio screenshots.

### Review checklist

- Can each person explain when tokens are earned without reading documentation?
- Can the reviewer see all terms affecting a goal or reward on the approval screen?
- Can a user distinguish recorded progress from available tokens?
- Does a redemption clearly show its effect on balance and partner action?
- Does rule retirement state its exact scope and outcome before confirmation?
- Does every key flow work with keyboard, screen reader labels, and 320 px width?
- Do empty and error states offer a next step rather than a dead end?
- Does the design feel encouraging to both people after an imperfect week?

**Ready for implementation** when the two-user prototype passes this checklist and the five flow acceptance criteria above. Visual polish alone is not sign-off.
