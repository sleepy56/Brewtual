# Next.js web/API and Expo phone deployment

The repository root is one Next.js app, deployed as one Vercel project. The website uses ordinary React/TypeScript and the API uses Next.js Node route handlers. The existing Expo phone app remains in `mobile/` and calls the same `/api/v1` endpoints. Neon data, table names, passwords, session signing settings and the Prisma migration history are preserved. This framework migration needs no database reset or new migration.

## Vercel settings

| Setting | Value |
| --- | --- |
| Root Directory | Repository root, not `mobile` or the old `backend` |
| Framework Preset | Next.js |
| Node.js | 24.x |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | Leave override disabled/default (`.next` is managed by Next.js) |
| Function region | Singapore (`sin1`), set in `vercel.json` |

For an existing Express project, change the dashboard preset to Next.js and clear any old `public` output override. Deploy the new commit. The repository no longer has an Express entrypoint or an Expo export build for the website. `/` and `/verify-email` are Next.js pages; `/api/v1/[...path]` is the dynamic Node API. The website's static shell loads even when the database is unavailable.

## Server environment

Set these in Vercel Environment Variables for Production. Keep secrets out of `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Existing pooled Neon PostgreSQL connection URL with TLS |
| `DATABASE_URL_UNPOOLED` | Existing direct Neon URL for migration commands |
| `AUTH_MODE` | `jwt` |
| `JWT_SECRET` | Existing random signing secret of at least 32 characters |
| `JWT_ISSUER` | `pair-habits` |
| `JWT_AUDIENCE` | `pair-habits-api` |
| `APP_WEB_URL` | Exact HTTPS origin, such as `https://pair-habit.vercel.app` |
| `CORS_ORIGINS` | Same exact browser origin; comma-separated if more than one is intentionally allowed |
| `DB_TRANSACTION_MAX_WAIT_MS` | `10000`, or omit for this default |
| `DB_TRANSACTION_TIMEOUT_MS` | `30000`, or omit for this default |
| `REQUIRE_EMAIL_VERIFICATION` | `false`, or omit; signup works without email |

SMTP is optional for signup and login. With `REQUIRE_EMAIL_VERIFICATION` unset or `false`, accounts are created immediately and no email is sent, even if SMTP variables exist. Once email delivery is ready, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`, then set `REQUIRE_EMAIL_VERIFICATION=true` and redeploy. Unverified accounts will then need to confirm their email before using the app. [Authentication details](AUTHENTICATION_PLAN.md).

Keep `AUTH_MODE=local`, `LOCAL_AUTH_SECRET` and `TEST_DATABASE_URL` out of production. Next.js manages `NODE_ENV` and `PORT`. Existing production migrations need not be rerun for this change; new databases use `npm run db:migrate` with the direct URL. Builds only generate the Prisma client and Next.js output.

For preview signup tests, use preview-specific `APP_WEB_URL` and `CORS_ORIGINS`. Browser refresh cookies remain HttpOnly, SameSite Strict and Secure in production; web and API share one origin.

## Verify a deployment

1. Open `/`: the sign-in page should load.
2. Open `/verify-email`: the verification page should load without consuming a token on GET.
3. Open `/api/v1/health`: expect 200 and `{"status":"ok"}`.
4. Open `/api/v1/health/ready`: expect 200 and `{"status":"ready"}`. A 503 here indicates configuration or database connectivity trouble; it should not crash the website.
5. Create an account with an email and password, then sign in immediately. Test pair access and one habit mutation. Verification is required only if explicitly enabled.

Local `npm run test:vercel` builds and starts the production server with `require(esm)` disabled, checks the pages and API, and verifies the website survives an unavailable database. `npm run test:integration` covers real local PostgreSQL transactions using isolated schemas and fake email. Neither check touches Neon or sends email.

## Expo on a phone

Set `EXPO_PUBLIC_API_URL=https://pair-habit.vercel.app/api/v1` in `mobile/.env`, then restart Expo with `npm run mobile`. Use the development QR workflow supported by your Expo SDK. Native iOS/Android release builds are separate Expo builds; Vercel hosts their API, not their installation packages. Browser Home Screen shortcuts use the responsive Next.js website instead.

For local phone development, use your computer's LAN IP on port 3000 rather than localhost. The native API contract and SecureStore refresh-token transport are unchanged. Optional `npm run mobile:web` previews the existing Expo UI in a browser, while `npm run dev` opens the Next.js website.
