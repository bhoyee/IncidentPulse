# IncidentPulse

A modern incident-response stack that pairs an authenticated operations console with a polished public status page. IncidentPulse is built for small teams and solo operators who want enterprise-style workflows—incident intake, assignments, evidence, automation, and communications—without the enterprise price tag.

![IncidentPulse dashboard](https://github.com/user-attachments/assets/b82fc23d-1911-442c-a1ef-648197a60722)

> **Live Docs:** https://incident-pulse.vercel.app/docs

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Screenshots & Demo](#screenshots--demo)
4. [Quick Start](#quick-start)
5. [Environment Variables](#environment-variables)
6. [Automation & Webhooks](#automation--webhooks)
7. [Testing & Tooling](#testing--tooling)
8. [Deployment Checklist](#deployment-checklist)
9. [Roadmap](#roadmap)
10. [Community & Feedback](#community--feedback)
11. [Contributing](#contributing)
12. [Security](#security)
13. [License](#license)

---

## Features

- **Operations dashboard** – prioritize incidents, assign responders, add timeline updates with evidence attachments, and capture mandatory root-cause + resolution notes before closure.
- **Service-aware status page** – customers see per-service health, uptime badges, and scheduled maintenance windows pulled directly from the incident data.
- **Automation-ready webhooks** – secure HMAC endpoint for auto-creating incidents from GitHub Actions, UptimeRobot, Datadog, etc., with dedupe + recovery flows.
- **Multi-channel notifications** – email plus Slack, Discord, Microsoft Teams, and Telegram webhooks keep every stakeholder informed on create, assign, and resolve.
- **Analytics** – MTTR/MTTA snapshots, severity breakdown, and weekly trends for leadership-ready reporting.
- **Audit log** – every admin/user/incident action is captured with filters + pagination for compliance reviews.
- **Realtime streams (SSE)** – dashboards and the public status page subscribe to incident + status updates without manual refreshes.

## Architecture

| Layer        | Stack                                                                 |
|--------------|-----------------------------------------------------------------------|
| Frontend     | Next.js 14 App Router, React 18, Tailwind CSS, TanStack Query         |
| Backend      | Fastify (Node 20), TypeScript, Prisma ORM, PostgreSQL                 |
| Auth         | Signed JWT cookies, role-based guards (admin/operator/viewer)         |
| Tooling      | Docker Compose, Playwright, ESLint, GitHub Actions CI                 |

Directory map:

```
.
├── backend/      # Fastify API, Prisma schema, mailer, automations
├── frontend/     # Next.js app, dashboard, public pages
├── .github/      # CI workflows
└── docs/         # Product documentation (content served via /docs)
```

## Screenshots & Demo

- Operations dashboard: `/dashboard`
- Public status page: `/status`
- Documentation hub: `/docs`

> Deploy the repo to Vercel + Render (or Docker) and drop those URLs into the README when you have a public demo.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/bhoyee/IncidentPulse.git
cd IncidentPulse
npm install                # installs root tooling
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Fill the variables described below (JWT secret, database URL, etc.).

### 3. Run database + migrations

```bash
docker compose up postgres -d             # or point DATABASE_URL at your own DB
cd backend
npx prisma migrate deploy
npx prisma db seed                        # seeds admin@incidentpulse.com / admin123
```

### 4. Start dev servers

```bash
# Backend API
cd backend
npm run dev            # http://localhost:4000

# Frontend
cd ../frontend
npm run dev            # http://localhost:3000
```

Log in at `/login` with the seeded admin account, then explore the dashboard and public status page.

## Run with Docker

Prefer containers? Build both services with a single command:

```bash
docker compose up --build
```

The stack exposes:

- API on `http://localhost:4000`
- Frontend on `http://localhost:3000`
- PostgreSQL on `localhost:5432` (credentials defined in `docker-compose.yml`)

Environment variables (JWT secret, email settings, webhook secrets, etc.) are configured inside `docker-compose.yml`. Adjust them before pushing to production.

## Environment Variables

### Backend (`backend/.env`)

| Variable                | Description                                                                                |
|-------------------------|--------------------------------------------------------------------------------------------|
| `DATABASE_URL`          | PostgreSQL connection string                                                               |
| `JWT_SECRET`            | 32+ char secret for signing auth cookies                                                   |
| `FRONTEND_URL`          | Origin of the frontend (e.g. `http://localhost:3000`)                                      |
| `COOKIE_DOMAIN`         | Domain for auth cookies (`localhost` in dev)                                               |
| `RESEND_API_KEY`        | (Optional) Resend email API key for transactional emails                                   |
| `SMTP_FROM_NAME/EMAIL`  | Friendly name and email used in notifications                                              |
| `WEBHOOK_HMAC_SECRET`   | Hex secret used to sign inbound automation payloads                                        |
| `WEBHOOK_SHARED_TOKEN`  | Optional fallback token when partners cannot compute HMAC                                  |
| `WEBHOOK_SYSTEM_USER_ID`| Optional UUID of the “Automation” user that owns webhook-created incidents                 |
| `UPLOAD_DIR`            | Directory for evidence attachments (default `uploads/`)                                    |
| `DEMO_USER_EMAILS`      | Optional comma-separated list of emails that should be treated as read-only demo accounts |
| `RESEND_API_KEY`        | Resend API key for transactional emails (used for password resets)                        |

### Frontend (`frontend/.env.local`)

| Variable                 | Description                                       |
|--------------------------|---------------------------------------------------|
| `NEXT_PUBLIC_API_BASE`   | Base URL of the backend (e.g. `http://localhost:4000`) |

## Automation & Webhooks

- `POST /webhooks/incidents` – create or dedupe incidents. Requires `X-Signature` (HMAC SHA-256 over raw body) or `X-Webhook-Token`.
- `POST /webhooks/incidents/recovery` – resolve an incident once service health is restored.
- GitHub Actions example and UptimeRobot payload templates live in the dashboard Integrations tab (`/dashboard` → Automation) and in [`frontend/app/docs/page.tsx`](frontend/app/docs/page.tsx).
- Notifications fan out to Email, Slack, Discord, Teams, and Telegram via integration settings stored per tenant.

## Testing & Tooling

| Scope     | Command           | Description                               |
|-----------|-------------------|-------------------------------------------|
| backend   | `npm run dev`     | Fastify dev server                        |
| backend   | `npm run build`   | TypeScript build                          |
| backend   | `npm test`        | Jest unit/integration tests               |
| backend   | `npm run lint`    | ESLint                                    |
| frontend  | `npm run dev`     | Next.js dev server                        |
| frontend  | `npm run build`   | Production build                          |
| frontend  | `npm run lint`    | ESLint                                    |
| frontend  | `npm run test:e2e`| Playwright smoke tests                    |

CI (`.github/workflows/*.yml`) runs lint, type-check, build, and Playwright suites before auto-deploying via Vercel/Render hooks.

## Deployment Checklist

- Backend (Render, Fly.io, Railway, etc.)
  - Set all backend env vars (DB, JWT, webhook secrets, mail provider).
  - Run `npx prisma migrate deploy` on boot/shell.
  - Ensure `UPLOAD_DIR` points to persistent storage.
- Frontend (Vercel or Netlify)
  - Configure `NEXT_PUBLIC_API_BASE` to the deployed API.
  - Update environment for preview/prod deployments.
- Demo data
  - Run `npx prisma db seed` (or custom seed) for sample services / incidents.
- Status page cron
  - Schedule the SLA recompute task (hit `/metrics/recompute` or invoke the internal job) to refresh uptime snapshots.

## Roadmap

- [ ] Per-tenant architecture for hosted SaaS
- [ ] Email/webhook subscriptions for status updates
- [ ] Custom branding on the public status page
- [ ] Incident templates + runbooks
- [ ] PagerDuty / Opsgenie style on-call escalation

Add your ideas under GitHub Issues with the `enhancement` label.

## Community & Feedback

- **Issues** – bug reports or feature requests go to [GitHub Issues](https://github.com/bhoyee/IncidentPulse/issues). Use labels (`bug`, `feature request`, `good first issue`) to help triage.
- **Discussions** – open questions, integrations, and showcases belong in [GitHub Discussions](https://github.com/bhoyee/IncidentPulse/discussions).
- **In-app feedback** – the footer links to Discussions so self-hosters can leave notes without hunting down the repo.
- **Updates** – share release highlights (e.g., `v0.2.0 – audit log + webhook templates`) on LinkedIn/Twitter, Indie Hackers, or relevant subreddits to grow awareness.
- **Analytics** – if you host a live demo, consider adding privacy-friendly analytics (Umami, Plausible) to learn which docs/routes visitors care about.

## Contributing

1. Fork the repo and create a topic branch (`git checkout -b feat/my-improvement`).
2. Install deps and run the tests/lints listed above.
3. Open a PR referencing any related issue. Describe the change, screenshots, and test evidence.
4. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for coding standards, commit style, and review expectations.

We welcome bug fixes, docs clarifications, and community integrations (new webhook templates, notification channels, etc.).

## Security

- Never commit secrets. Rotate `WEBHOOK_HMAC_SECRET`, API keys, and JWT secrets when sharing the repo publicly.
- Report security issues privately via `security@incidentpulse.io` (or open a “Privately disclose” security advisory on GitHub).
- Use separate Render/Vercel projects for staging vs production to limit blast radius.

## License

IncidentPulse is released under the [MIT License](LICENSE). Use it freely in personal and commercial projects—just attribute the project and share improvements with the community when you can.

---

Built with care for responders who want calm incident comms without enterprise bloat. Enjoy!
