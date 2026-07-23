# ZeptoMail Mailer System

A self-hosted Next.js admin dashboard to manage ZeptoMail SMTP and API configurations, registered sender addresses, build and manage text & HTML email templates, compose tracked email campaigns, and view per-SMTP analytics (opens, clicks, unique engagement, and recent activity logs).

---

## Features

- **ZeptoMail Connections (SMTP & API Modes)**: Supports both SMTP Relay (`smtp.zeptomail.com`) and ZeptoMail Send API (`Zoho-enczapikey`). Includes AES-256 encrypted credential storage and a built-in "Test Connection" action.
- **Sender Address Management**: Bind verified domain sender addresses (e.g., `support@domain.com`) to each SMTP configuration.
- **Template Builder**: Create TEXT and HTML email templates with subject lines, variable interpolation (`{{name}}`, `{{email}}`), and an embedded HTML live-preview iframe.
- **Unified Send Engine**: Automatically personalizes subject and body content, rewrites `<a href>` links for click tracking, and injects a 1x1 transparent GIF tracking pixel for open tracking.
- **Custom Tracking**: Built-in `/api/track/open/[id]` and `/api/track/click/[id]` endpoints log IP addresses and user agents while executing seamless 302 redirects to destination URLs.
- **Per-SMTP Analytics**: View total emails sent, unique open rates, click rates, campaign performance tables, activity charts (via Recharts), and real-time event logs.
- **Single-Admin Authentication**: Protected dashboard routes via HMAC signed session cookies.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: Tailwind CSS, Lucide Icons
- **Database**: Prisma + SQLite (`dev.db`)
- **Email Delivery**: Nodemailer (SMTP mode) & Fetch (ZeptoMail API mode)
- **Analytics Charts**: Recharts

---

## Setup & Running Locally

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure `.env` contains:
- `DATABASE_URL`: `"file:./dev.db"`
- `APP_URL`: **Must be a public HTTPS URL** for open/click tracking to work (Gmail and other clients cannot reach `localhost`). Examples: `https://mailer.yourdomain.com` or a tunnel like `https://xxxx.ngrok-free.app`. Localhost only works for dashboard UI — not for real tracking.
- `ENCRYPTION_KEY`: A 64-character hex string (32 bytes) for AES-256 credential encryption.
- `SESSION_SECRET`: Secret key for HMAC cookie signing.
- `ADMIN_PASSWORD`: Password required to sign into the dashboard (default: `changeme`).

### Tracking notes

- HTML bodies: every `http(s)` link is rewritten through `/api/track/click/[id]`, and a 1×1 GIF pixel is injected for opens.
- TEXT bodies: only click tracking (no pixel / no opens).
- ZeptoMail’s own `track_opens` / `track_clicks` are disabled so metrics stay in this app.
- Analytics charts use the last 7 days of events per SMTP config.

### 2. Database Migration

Generate the Prisma client and push the SQLite schema:

```bash
npx prisma generate
npx prisma db push
```

### 3. Build & Run

To verify compilation and build the Next.js application:

```bash
npx tsc --noEmit
npm run build
```

To run the local development server:

```bash
npm run dev
```

Visit `http://localhost:3000/login` and log in with your `ADMIN_PASSWORD`.
