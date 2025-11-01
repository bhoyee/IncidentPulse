# IncidentPulse

Modern incident response platform that combines an authenticated operations dashboard with a polished public status page so teams can triage outages fast and keep customers in the loop.

## Feature Highlights
- **Real-time operations console** – assign incidents, update statuses, and share progress notes in a collaborative drawer experience.
- **Role-aware access control** – admins, operators, and viewers each get the right capabilities backed by signed JWT cookies.
- **Public status page** – cached SLA metrics and active incident summaries keep customers informed without exposing internal tooling.
- **Insightful metrics** – track MTTR, first-response time, and 24h uptime with automated cache recomputation jobs.
- **End-to-end testing** – Playwright smoke tests and Jest suites guard critical flows in CI.

## Tech Stack
| Layer      | Tools |
|------------|-------|
| Backend    | Fastify (Node.js 20), TypeScript, Prisma ORM, PostgreSQL |
| Frontend   | Next.js 14 App Router, React 18, Tailwind CSS, Headless UI, TanStack Query |
| Auth & API | JWT (http-only cookies), Zod validation, Axios client with interceptors |
| Tooling    | Docker Compose, ESLint, Playwright, Jest, GitHub Actions |

## Monorepo Layout
`
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/b82fc23d-1911-442c-a1ef-648197a60722" />


## Getting Started
### Prerequisites
- Node.js 20+
- npm 10+
- Docker (for Postgres in development)

### 1. Bootstrap environment variables
`
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
`
Update the generated files with secrets:
- **backend/.env** – DATABASE_URL, JWT_SECRET (32+ chars), COOKIE_DOMAIN, FRONTEND_URL
- **frontend/.env.local** – NEXT_PUBLIC_API_BASE

### 2. Install dependencies
`
cd backend && npm install
cd ../frontend && npm install
`

### 3. Start Postgres and run migrations
`
docker compose up postgres -d
cd backend
npm run prisma:migrate	npm run prisma:generate
npm run prisma:seed      # seeds admin@incidentpulse.com / admin123 by default
`
Override credentials via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD if needed.

### 4. Run the development servers
`
# Backend API (http://localhost:4000)
cd backend
npm run dev

# Frontend (http://localhost:3000)
cd ../frontend
npm run dev
`
Visit http://localhost:3000/dashboard for the internal console and http://localhost:3000/status for the public page.

## Useful npm Scripts
| Scope     | Command                 | Description |
|-----------|-------------------------|-------------|
| backend   | 
pm run dev           | Fastify dev server with hot reload |
| backend   | 
pm test              | Jest unit/integration suite |
| backend   | 
pm run lint          | ESLint checks |
| frontend  | 
pm run dev           | Next.js dev server |
| frontend  | 
pm run build         | Production build |
| frontend  | 
pm run lint          | ESLint via 
ext lint |
| frontend  | 
pm run test:e2e      | Playwright smoke tests |

## Continuous Integration
GitHub Actions pipelines enforce quality on every push:
- **frontend-ci** – type check, lint, Playwright smoke tests, trigger Vercel deploy hook on main.
- **backend-ci** – type check, lint, Jest suite, run prisma migrate deploy, ping Render deploy hook.

## Deployment Notes
- **Frontend (Vercel)** – set NEXT_PUBLIC_API_BASE to your deployed backend.
- **Backend (Render or similar)** – supply DATABASE_URL, JWT_SECRET, FRONTEND_URL, COOKIE_DOMAIN. Schedule a job to hit /metrics/recompute for SLA cache refreshes.
- **Database (Render Postgres or RDS)** – mirror the connection string locally and in CI secrets.

## Roadmap Ideas
- Incident analytics dashboards (Charts for MTTA/MTTR trends)
- Webhooks or Slack notifications for new incidents
- Status page subscriptions (email/webhook)
- Service dependency mapping

---
Built for teams who need calm, informative incident comms without sacrificing operational velocity.
