# Deploy to Cloudflare Workers (OpenNext)

Production URL: **https://comailer.cohortix.in**

Workers URL (fallback): `https://mailer.bhavy.workers.dev`

## Quick deploy (Windows)

```bash
npm install
npm run build:cf    # patches Prisma for Workers + builds OpenNext bundle
npx wrangler deploy
```

`build:cf` runs Windows symlink patch + Prisma Cloudflare patch automatically.

## Required Wrangler secrets

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put APP_URL          # https://comailer.cohortix.in
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_EMAIL      # bootstrap admin login email
npx wrangler secret put ADMIN_PASSWORD   # seeds the first ADMIN user only
npx wrangler secret put CRON_SECRET      # random string; protects /api/drip/tick
```

Or run: `powershell -File scripts/set-cf-secrets.ps1` (skips APP_URL if still localhost in `.env`).

## Auth (multi-tenant)

- Login at `/login` with **email + password** (not the shared password alone).
- On first login, if no ADMIN user exists, one is created from `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
- After that, manage clients under **Clients** in the sidebar (admin only). Each client gets their own organization and login; they only see their SMTPs, templates, compose, drip, and analytics.
- Admins use the **Working as client** switcher to view/create data for a specific client.
- `ADMIN_PASSWORD` is unused for day-to-day login once the admin user exists — reset via the database or recreate the user if needed.

## Database (Neon PostgreSQL)

```bash
npm run db:migrate
```

## Verify

```bash
curl https://comailer.cohortix.in/api/health
# {"ok":true,"database":"connected",...}
```

Login at `/login` with your admin email and password.

## Notes

- OpenNext on Windows needs the symlink patch (`scripts/patch-opennext-win.cjs`) — included in `build:cf`.
- Prisma uses `PrismaNeonHTTP` + post-build patch (`scripts/patch-prisma-cf.cjs`) for Cloudflare Workers.
- Worker bundle is ~8–12 MB depending on deps — requires Cloudflare Workers paid plan (free tier limit is 3 MB).
- Drip campaigns run via Cloudflare cron (`* * * * *`) → worker `scheduled` → `POST /api/drip/tick` with `Authorization: Bearer $CRON_SECRET`.
- `xlsx` and `recharts` are client-only chunks (not in the Worker handler bundle).

