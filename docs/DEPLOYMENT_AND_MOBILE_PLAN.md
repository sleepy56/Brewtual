# Brewtual deployment and phone installation

The repository root is one Next.js app, deployed as one Vercel project. The website uses ordinary React/TypeScript and the API uses Next.js Node route handlers. The existing Expo phone app remains in `mobile/` and calls the same `/api/v1` endpoints. Neon data, table names, passwords, session signing settings and the Prisma migration history are preserved. The framework migration itself did not require a database reset. The current friend-circle features add a new migration; apply it to existing databases before using Together.

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
| `APP_WEB_URL` | Exact HTTPS origin, such as `https://brewtual.vercel.app` |
| `CORS_ORIGINS` | Same exact browser origin; comma-separated if more than one is intentionally allowed |
| `DB_TRANSACTION_MAX_WAIT_MS` | `10000`, or omit for this default |
| `DB_TRANSACTION_TIMEOUT_MS` | `30000`, or omit for this default |
| `REQUIRE_EMAIL_VERIFICATION` | `false`, or omit; signup works without email |

SMTP is optional for signup and login. With `REQUIRE_EMAIL_VERIFICATION` unset or `false`, accounts are created immediately and no email is sent, even if SMTP variables exist. Once email delivery is ready, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`, then set `REQUIRE_EMAIL_VERIFICATION=true` and redeploy. Unverified accounts will then need to confirm their email before using the app. [Authentication details](AUTHENTICATION_PLAN.md).

Keep `AUTH_MODE=local`, `LOCAL_AUTH_SECRET` and `TEST_DATABASE_URL` out of production. Next.js manages `NODE_ENV` and `PORT`. Run `npm run db:migrate` with the configured direct database URL before releasing schema changes, including the additive `20261023170000_friend_circles` and `20261023190000_personal_planner` migrations. Apply it to existing databases as well as new ones; it preserves partner records. Builds only generate the Prisma client and Next.js output; they do not apply migrations or send email.

For preview signup tests, use preview-specific `APP_WEB_URL` and `CORS_ORIGINS`. Browser refresh cookies remain HttpOnly, SameSite Strict and Secure in production; web and API share one origin.

## Fix sign-in after changing the domain

A response of `403` with `Untrusted sign-in origin` comes from the API’s browser-origin guard, before credentials are checked. Renaming the project or attaching a domain does not update the project’s saved environment variables.

For the Brewtual production domain, open **Vercel project > Settings > Environment Variables** and set these values for **Production**:

```dotenv
APP_WEB_URL=https://brewtual.vercel.app
CORS_ORIGINS=https://brewtual.vercel.app
```

Use the exact origin, including `https://`, with no trailing slash or path. `APP_WEB_URL` controls verification links; `CORS_ORIGINS` controls which browser origins can sign in and refresh sessions. If another browser client is intentionally supported, add its exact origin to the comma-separated `CORS_ORIGINS` list. Never use `*` or trust every `vercel.app` subdomain.

Save the values and **redeploy the production deployment**. Environment changes apply only to new deployments, not the deployment already serving requests. Updating `.env.vercel.example` alone has no effect on Vercel. See [Vercel’s environment variable documentation](https://vercel.com/docs/environment-variables).

Then open the stable production domain and retry sign-in. A visitor with no session may receive `401` from `/api/v1/auth/refresh`; `403 Untrusted sign-in origin` should be gone for the configured domain. Preview and generated deployment URLs are separate origins; configure each intended preview origin explicitly rather than using a wildcard.

A separate `404` needs its full request URL to diagnose. It does not explain an authentication response whose JSON explicitly reports an untrusted origin.

## Verify a deployment

1. Open `/`: the public Brewtual landing page should load. Use Log in to open the account screen.
2. Open `/verify-email`: the verification page should load without consuming a token on GET.
3. Open `/api/v1/health`: expect 200 and `{"status":"ok"}`.
4. Open `/api/v1/health/ready`: expect 200 and `{"status":"ready"}`. A 503 here indicates configuration, database connectivity, or missing planner/circle schema trouble; it should not crash the website.
5. Create an account with an email and password, then sign in immediately. Confirm that Tasks, Dailies, and Goals work with no partner; token markets should require at least two members. Test pair access and one habit mutation. Also test a partner code and a group code with separate accounts, circle goal ownership, cheering, and voluntary milestone pledges. Verification is required only if explicitly enabled.

Local `npm run test:vercel` builds and starts the production server with `require(esm)` disabled, checks the pages and API, and verifies the website survives an unavailable database. `npm run test:integration` covers real local PostgreSQL transactions using isolated schemas and fake email. Neither check touches Neon or sends email.

## Expo on a phone

Set `EXPO_PUBLIC_API_URL=https://brewtual.vercel.app/api/v1` in `mobile/.env`, then restart Expo with `npm run mobile`. Use the development QR workflow supported by your Expo SDK. Native iOS/Android release builds are separate Expo builds; Vercel hosts their API, not their installation packages. The installable responsive website uses the Next.js app instead; see the home-screen instructions below.

For local phone development, use your computer's LAN IP on port 3000 rather than localhost. The native API contract and SecureStore refresh-token transport are unchanged. Optional `npm run mobile:web` previews the existing Expo UI in a browser, while `npm run dev` opens the Next.js website.

## Install the website on a phone

Deploy the website to HTTPS, then open its address on the phone and use **Get the phone app** for platform-specific instructions.

- **Android / Chrome:** choose Install app when offered, or use the browser menu’s Install app / Add to Home screen option.
- **iPhone / Safari:** tap Share, choose Add to Home Screen, and enable Open as Web App when offered.

The website includes an app manifest, icons, and a service worker. Shared account data requires an internet connection. The service worker caches only a generic offline reconnect page and an icon; it never caches authenticated pages or API responses. This installation does not create an Expo native release package.

Physical-device installation, safe areas, and platform-specific behavior still require testing on the deployed HTTPS origin. Friend circles are currently part of the website; the separate Expo client retains its existing partner flow.

## Related guides

- [Development and troubleshooting](DEVELOPMENT.md)
- [Friend circles and invites](FRIEND_CIRCLES.md)
- [Account and session administration](AUTHENTICATION_PLAN.md)
- [Expo client setup](../mobile/README.md)
