# First mobile UI slice

> **TASK-002 update, 17 October 2026:** Signup, email verification and authenticated live pair, habit, reward, wallet and activity flows are connected to the API through the existing themed screens. The separate fictional demo remains available before sign-in. Earlier statements below calling verification future work describe the older UI slice.

React Native + Expo application in `mobile/`, using `mobile/pair-habits-preview.html` as the design reference. No embedded WebView. Authenticated screens call the API; the separate demo uses fictional local data. Desktop web uses side navigation at 900px and above. Four bottom destinations: Today, Goals, Rewards, Activity. Profile opens Settings; notification badge opens Approvals.

## Shared interfaces

- Root owns `mobile/package.json`, Expo config, `App.tsx`, `index.ts`, navigation/app shell, verification, and backend auth cleanup.
- Design-system agent owns `mobile/src/theme/**` and `mobile/src/components/**`.
- Screen/state agent owns `mobile/src/screens/**`, `mobile/src/demo/**`, `mobile/src/types.ts`.
- Notes agent owns `docs/AUTHENTICATION_PLAN.md`, `mobile/README.md`, and updates to current deployment/product/UI docs and README only.
- Keep `mobile/pair-habits-preview.html` as the single, self-contained design reference. Edit its inline CSS, JavaScript, and markup directly; no supporting files or build step are needed.

`mobile/src/theme/index.ts` exports `ThemeProvider`, `useTheme`, `themes`, `ThemeName` and `Theme`. `useTheme()` returns `{theme, themeName, setTheme, ready}`. Themes: `midnight` default, `dawn`, `plum`, `ocean`. Theme tokens use prototype CSS names converted to camelCase: `bg,surface,surface2,text,muted,border,accent,accentText,accentSoft,heroBg,heroText,heroMuted,success,warning,danger,focus,purple` plus `isDark`, `name` and `description`. Preference persists through AsyncStorage, with invalid/stale values falling back to midnight.

`mobile/src/components/index.ts` exports:

- `AppText`: React Native Text props plus `variant?: 'body'|'heading'|'eyebrow'|'caption'`, `color?: string`.
- `Card`: children, optional ViewStyle style.
- `Button`: `label,onPress,variant?: 'primary'|'secondary'|'ghost'|'danger',disabled?,icon?: IconName,style?`.
- `Chip`: `label`, optional `tone: 'accent'|'muted'|'warning'|'danger'`.
- `Icon`: `name: IconName,size?,color?,strokeWidth?`; names `home,target,gift,activity,bell,arrow,back,check,plus,close,token,gym,book,leaf,coffee,film,mountain,settings,clock,logout,download,link,shield,edit,heart`.
- `IconButton`: `name,label,onPress,badgeCount?,disabled?`.
- `Avatar`: `person: 'alex'|'jamie',size?`.
- `SectionHeading`: `title,actionLabel?,onAction?`.
- `PlantArt`: optional size; port the existing SVG to react-native-svg.
- `Screen`: `children`, `scroll?: boolean` default true, `style?`; no header/nav duplicated inside it. Use comfortable gutters and theme background, scroll content padding.

`mobile/src/types.ts` exports `PersonId`, `TabName = 'today'|'goals'|'rewards'|'activity'`, and `Route = {name:TabName|'settings'|'approvals'|'new-goal'|'goal-detail';id?:string}`. Each screen accepts `ScreenProps = {navigate:(route:Route)=>void; goBack:()=>void; route:Route}`. Shared app header and bottom navigation belong to root. Screen components default export from `<today|goals|rewards|activity|settings|approvals|new-goal|goal-detail>.tsx`. `SettingsScreen` can import useTheme to render theme selectors and use demo context to change demo person/reset state.

`mobile/src/demo/index.ts` exports `DemoProvider,useDemo`. The provider owns local fictional state/actions (check-in/undo, recurring goal proposal and partner review, redemption review/request/fulfillment, person switching/reset). Persist with AsyncStorage if feasible; version and validate stored state, serialize writes to prevent stale persistence. Same-day check-ins don't grant immediate tokens. No real/auth passwords stored. Expose `person,goals,rewards,ledger,requests,balance,pendingCount,partnerName` plus actions; screen agent chooses types consistently within its owned boundary. Use seed Alex/Jamie and 24/18 token balances from prototype.

## Scope and review

Faithfully carry midnight garden, sage hero, serif editorial titles, thin borders, 18px cards, the growing plant, week chips and clear signed ledger across native screens. Avoid emoji substitutes for icons. Four themes change every screen, shell, dialogs and status bar. Small-phone layouts should fit without horizontal scrolling, keyboard controls should remain reachable, and controls need accessible labels/selected states. Show a discreet local-demo indication in Settings/header; do not clutter the main design with implementation notes.

Email/password sign-in is now connected through `src/auth/gate.tsx` and `src/auth/client.ts`. Phone sign-in and habit API integration remain later work. Password login does not require sending mail; an unverified phone number is not proof of ownership. Document optional verification/reset email services and secure JWT/session/password work for later.
