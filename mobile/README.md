# Mobile and web client

React Native + Expo, sharing one UI across Android, iOS and browsers. Run `npm run mobile` or `npm run web` from the root. `npm run web:build` exports a static browser bundle to `mobile/dist`. Use Node 24.9 or newer.

At browser widths of 900px and above, the app uses side navigation and a wider content area. Smaller screens retain bottom tabs. Settings offers Midnight, Dawn, Plum and Ocean themes. Profile opens Settings; notifications open Approvals.

The welcome screen supports email/password signup, verification and sign-in. Authenticated accounts enter live pair, habit, reward, wallet and activity screens. The fictional demo is a separate signed-out entry. Deployed web uses same-origin `/api/v1`; local Expo web and native development need `EXPO_PUBLIC_API_URL` in `mobile/.env` (phones need a reachable LAN/public URL). Session restore and refresh use HttpOnly browser cookies or native Expo SecureStore. Passwords, access tokens and live API data are not persisted in AsyncStorage.

On first sign-in, create a pair with its timezone or accept an invite addressed to the signed-in email. After creating a pair, share its invite token with the partner; the app shows a waiting state until they join. Settings shows the account and pair and provides sign-out. Demo-person switching and reset exist only inside the explicit demo.

Adding the deployed site to a phone Home Screen creates a browser shortcut and uses the Vercel web app; it does not build a native app. Native iOS/Android builds are a separate Expo build and require a reachable API URL in `EXPO_PUBLIC_API_URL` (localhost is not reachable from a phone). Use `npm run mobile:typecheck` and `npm run web:build` for client checks. Physical-device keyboard/safe-area, SecureStore and production-cookie behavior require release testing.
