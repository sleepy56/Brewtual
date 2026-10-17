# Expo phone client

React Native + Expo for Android and iOS. The website and API now run in Next.js at the repository root. Run `npm run dev` for Next.js and `npm run mobile` for Expo. Optional `npm run mobile:web` previews the Expo UI in a browser; `npm run mobile:export` exports that preview to `mobile/dist`. Use Node 24.9 or newer.

At browser widths of 900px and above, the app uses side navigation and a wider content area. Smaller screens retain bottom tabs. Settings offers Midnight, Dawn, Plum and Ocean themes. Profile opens Settings; notifications open Approvals.

The welcome screen supports email/password signup, verification and sign-in. Authenticated accounts enter live pair, habit, reward, wallet and activity screens. The fictional demo is a separate signed-out entry. Deployed web uses same-origin `/api/v1`; local Expo web and native development need `EXPO_PUBLIC_API_URL` in `mobile/.env` (phones need a reachable LAN/public URL). Session restore and refresh use HttpOnly browser cookies or native Expo SecureStore. Passwords, access tokens and live API data are not persisted in AsyncStorage.

On first sign-in, create a pair with its timezone or accept an invite addressed to the signed-in email. After creating a pair, share its invite token with the partner; the app shows a waiting state until they join. Settings shows the account and pair and provides sign-out. Demo-person switching and reset exist only inside the explicit demo.

Adding the deployed site to a phone Home Screen creates a browser shortcut and uses the Next.js website; it does not build a native app. Native iOS/Android builds remain separate Expo builds. Set `EXPO_PUBLIC_API_URL=https://pair-habit.vercel.app/api/v1` in `mobile/.env` before starting Expo or creating a native build. For local development, substitute your computer's LAN address on port 3000; localhost is not reachable from a phone. Restart Expo after changing its environment. Use `npm run mobile:typecheck`, `npm run mobile:test`, and `npm run mobile:export` for client checks. Physical-device keyboard/safe-area, SecureStore and production-cookie behavior require release testing.
