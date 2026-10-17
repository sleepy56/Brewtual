# One-project Vercel deployment

The repository keeps the NestJS API in `backend/` and Expo in `mobile/`. One Vercel project imports the **repository root**, builds the API and static web together, and serves both on the same HTTPS origin. The checked-in `vercel.json` chooses the Express preset, root `src/index.ts` as the server entrypoint, `public` as the static output, and Singapore (`sin1`) for the function. The Nest application retains its `/api/v1` prefix. Static `/verify-email` loads the app shell; the email token is consumed only by a POST. The app code is ready for deployment; Vercel, Neon, and email provider setup remain for the owner.

## Vercel project settings

| Setting | Value |
| --- | --- |
| Repository Root Directory | Repository root, not `backend` or `mobile` |
| Framework Preset | Express |
| Node.js Version | 24 |
| Install Command | `npm ci --include=dev` (root workspace lockfile; backend TypeScript and Expo build tools are required during build) |
| Build Command | `npm run build:vercel` |
| Output Directory | `public` |
| Function region | `sin1` |

`npm run build:vercel` runs Prisma generation and TypeScript compilation in the existing backend, then exports Expo web to `public` with `EXPO_PUBLIC_API_URL=/api/v1`. The bundle contains only this public same-origin path, never the database, JWT or SMTP credentials. The `/api/v1` routes are handled by the root NestJS entrypoint through Vercel's Express support. The build does **not** apply migrations. Deploy reviewed migrations once per target database using `npm run db:migrate` with the direct Neon URL before serving the new API.

| Environment variable | Value and location |
| --- | --- |
| `NODE_ENV`, `AUTH_MODE` | `production`, `jwt`; backend only |
| `DATABASE_URL` | Pooled Neon PostgreSQL URL for runtime; backend only |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL for Prisma migration tooling; backend only |
| `JWT_SECRET` | Random secret of at least 32 characters; backend only |
| `JWT_ISSUER`, `JWT_AUDIENCE` | `pair-habits`, `pair-habits-api`; backend only |
| `SMTP_HOST`, `SMTP_PORT` | Provider SMTP endpoint; backend only (Resend: `smtp.resend.com`, `465`) |
| `SMTP_USER`, `SMTP_PASSWORD` | Provider SMTP credentials; backend only (Resend: `resend` and API key) |
| `SMTP_FROM` | Sender email on the verified sending domain; backend only |
| `APP_WEB_URL` | Exact HTTPS origin of this Vercel project, no path or trailing slash; backend only |
| `CORS_ORIGINS` | The same exact HTTPS origin for browser auth; backend only |
| `DB_TRANSACTION_MAX_WAIT_MS`, `DB_TRANSACTION_TIMEOUT_MS` | Defaults 10000 and 30000; backend only |

Vercel supplies `PORT`. A custom domain is optional for hosting the web app and API, but a sending provider such as Resend requires a verified domain for production sender addresses. Keep `LOCAL_AUTH_SECRET`, `TEST_DATABASE_URL` and local auth mode out of production. For preview deployments, set `APP_WEB_URL` and `CORS_ORIGINS` to the exact preview origin when testing signup; a production-only value will not authorize browser POSTs on a different preview origin. Same-origin hosting lets the existing SameSite Strict, Secure, HttpOnly refresh cookie work without a second domain or cross-site cookie policy.

## Checks and scope

Run `npm test`, `npm run typecheck`, `npm run mobile:typecheck`, and `npm run test:vercel` (build plus static/routing check). Database integration tests require `TEST_DATABASE_URL` for disposable local PostgreSQL schemas; do not point them at Neon. Verify the deployment's static `/`, static assets, `/verify-email`, `/api/v1/health`, `/api/v1/health/ready` and auth routes after you deploy. See [authentication and TASK-002 client contract](AUTHENTICATION_PLAN.md) for the verification flow.

The web export is static, while the app remains dynamic: authenticated screens load and mutate pair, habit, reward, wallet, and activity data through the Nest API and Neon. SMTP settings are optional for deployment; signup and resend return 503 until a mail provider is configured. Once enabled, signup creates an unverified pending account; the user follows the emailed link and confirms using the signup password before login. Existing accounts and data are preserved by the migration; existing account owners verify using their current password. The fictional local demo is separate from authenticated live data. Local `AUTH_MODE=local` token tooling is retained for development/test only. Native apps can use the same HTTPS API origin, with refresh credentials in SecureStore. A Vercel web deployment can be added to the phone Home Screen; native iOS/Android packages are separate Expo builds.
