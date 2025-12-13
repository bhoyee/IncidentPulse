# Scaling Guidance (Optional)

Most teams can launch without heavy infra. Add these pieces as usage grows.

## When to add each piece
- PgBouncer: add when you run multiple API instances or see connection churn. Keep Prisma pool small per pod when using PgBouncer.
- Redis + queue (BullMQ) + pub/sub: add when you need background jobs (email/webhooks/escalations) or cross-node SSE fan-out. Keep it feature-flagged so the app still runs without Redis.
- Caching: add Redis cache for read-mostly status/metrics; cache-bust on writes.
- Locks/consistency: add optimistic locking/version columns on incidents and short advisory locks around escalation monitor when you see double-processing.
- Indexes: add covering indexes for hot queries (incidents by org/status/severity, services by org/slug, audit logs by org/time). Consider partitioning only at very high volume.
- Observability: add structured logs/metrics/traces and alerts on queue depth, DB latency, and error rate once you have a staging/prod footprint.

## Baseline tuning
- API runs stateless; scale horizontally behind a load balancer.
- Keep Prisma pool conservative if PgBouncer is present (e.g., 2–5 per worker).
- Set Fastify keep-alive limits and body size caps based on your ingress limits.
- Use rate limiting (already present) to protect hot endpoints.

## Deployment notes
- Separate API and worker processes if you add queues; workers handle email/webhooks/escalations.
- Run Postgres with backups/HA if you need higher availability; point `DATABASE_URL` through PgBouncer when available.
- For SSE across multiple nodes, add Redis pub/sub and broadcast status/incident events through it so all nodes see the same stream.
