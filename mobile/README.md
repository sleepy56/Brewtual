# Mobile and web client

React Native + Expo, sharing one UI across Android, iOS and browsers. Run `npm run mobile` or `npm run web` from the root. `npm run web:build` exports a static browser bundle to `mobile/dist`. Use Node 24.9 or newer.

At browser widths of 900px and above, the app uses side navigation and a wider content area. Smaller screens retain bottom tabs. Settings offers Midnight, Dawn, Plum and Ocean themes. Profile opens Settings; notifications open Approvals.

The welcome screen supports real email/password sign-in. Backend signup and verification are ready for the next client task; their exact contract is in [the authentication guide](../docs/AUTHENTICATION_PLAN.md). Configure `EXPO_PUBLIC_API_URL` in `mobile/.env` for local development; the one-project Vercel build sets it to `/api/v1`. Session restore and refresh use HttpOnly browser cookies or native Expo SecureStore. Passwords and access tokens are not persisted in AsyncStorage. Native builds must include the new SecureStore module; rebuild any custom development client.

The signed-in view shows the connected account and allows a protected `/me` check and sign-out. Habits, rewards, approvals and activity remain fictional local data behind the explicit demo entry. The demo banner always provides a return to sign-in/account. Demo-person switching is a walkthrough control, not authentication.

Use `npm run mobile:typecheck` and `npm run web:build` for client checks. Physical-device keyboard/safe-area, SecureStore and production-cookie behavior require release testing. Existing dependency audit advisories still need compatible fixes before production.
