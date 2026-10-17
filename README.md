# Pair Habits

A private app for two adults to agree on habits and earn tokens toward shared rewards.

The React Native + Expo client runs on Android, iOS and web. Browser widths of 900px or more use desktop side navigation; phones use bottom tabs. Four themes and fictional demo state are saved locally.

Email/password sign-in now connects to the NestJS/PostgreSQL API. Accounts are individually provisioned; there is no public signup. Access tokens stay in memory, browser refresh credentials use HttpOnly cookies, and native refresh credentials use Expo SecureStore. Logout revokes the session. The signed-in account screen is real; habit, reward and activity screens remain a separate, explicitly labelled fictional demo until their API wiring is implemented.

## Run locally

Use Node 24.9 or newer and install dependencies from the repository root.

1. Configure the database using `backend/.env.example`, then run `npm run db:generate` and `npm run db:migrate`.
2. Set backend `AUTH_MODE=jwt` and a strong random `JWT_SECRET` (at least 32 characters). Set `CORS_ORIGINS=http://localhost:8081` for local web sign-in.
3. Provision each account using the secure PowerShell input below. Reprovisioning an existing email changes its password and revokes all its sessions.
4. Copy `mobile/.env.example` to `mobile/.env`; use `http://localhost:3001/api/v1` for the browser, or your computer’s LAN address for a physical phone.
5. Run `npm run dev` and, in another terminal, `npm run web` (port 8081) or `npm run mobile`. Restart Expo after environment changes.

```powershell
$accountPassword = Read-Host 'New individual password (15–128 characters)' -MaskInput
$accountPassword | npm run auth:provision -- alex@example.com
Remove-Variable accountPassword
```

`-MaskInput` requires PowerShell 7. Passwords are read through stdin, never command arguments. Do not paste a literal password into shell history.

Production browser UI and API must use HTTPS on the same site (for example `app.example.com` and `api.example.com`) for SameSite Strict refresh cookies. Set the exact browser origin in backend `CORS_ORIGINS`; native clients do not require CORS. No hosting or deployment has been performed.

## Checks

`npm test`, `npm run typecheck`, `npm run mobile:typecheck`, and `npm run web:build`. Database integration tests require `TEST_DATABASE_URL` pointing to disposable local PostgreSQL; they create and remove an isolated schema. See [authentication](docs/AUTHENTICATION_PLAN.md), [mobile client](mobile/README.md), and [backend contract](docs/BACKEND_CONTRACT.md).
