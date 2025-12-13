# Multi-tenant Overview (M0–M3)

This doc explains how to run IncidentPulse in single-tenant or multi-tenant mode, the data model, limits, and how to link public status pages per tenant.

## Modes
- **Single-tenant (default):** `MULTI_TENANT_ENABLED=false` (or unset). A default org is seeded; org switching is hidden; plan limits are not enforced.
- **Multi-tenant:** `MULTI_TENANT_ENABLED=true`. Auth/session carry `orgId` + `membershipRole`; every query is org-scoped; plan limits enforced.

## Data model
- **Organization:** id, name, slug, plan.
- **Membership:** userId + organizationId + role (`owner`, `admin`, `editor`, `viewer`), unique per user/org.
- Core tables carry `organizationId`: incidents, services, maintenance, audit logs, status cache, integration settings, webhooks/API keys, incident updates/attachments.

## Auth & scoping
- JWT/session includes `orgId`, `membershipRole`.
- All queries filter by `organizationId`; writes check membership role.
- Org switcher (UI + header) lets a member switch among orgs they belong to.

## Plan & limits (current defaults)
- Free: 2 services, 3 members, 50 incidents (soft cap).
- Pro: 20 services, 25 members, 1000 incidents.
- Enterprise: uncapped.
- Enforcement: 402 responses for over-limit operations (services, incidents); UI shows upgrade prompts.

## Public status pages
- Per-org slug route: `/status/[slug]` (e.g. `/status/acme-co`) and query-based `/status?orgId=...`/`?orgSlug=...`.
- SSE stream also accepts `orgSlug`.
- Status page remembers last selection in localStorage.

## Feature flag
- `MULTI_TENANT_ENABLED` (boolean). Off = single-tenant defaults; On = org scoping + plan enforcement.

## Branching & releases
- Multi-tenant work lives on a feature branch; main can remain single-tenant if desired.
- Tag tenant builds separately (e.g., `tenant-v0.x`).

## Next steps (remaining hardening)
- Add org isolation smoke tests (cannot read/write across orgs).
- Polish billing hooks (Stripe) and 402 upgrade surfaces across all mutations.
- Extend docs/landing to show clear “Self-host” vs “Multi-tenant cloud” paths.
