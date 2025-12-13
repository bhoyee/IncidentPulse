# Multi-tenant Setup (how-to)

## Enable multi-tenant
1) Set `MULTI_TENANT_ENABLED=true` in the backend environment.
2) Run migrations (`npx prisma migrate deploy`) and seed if needed (`npx prisma db seed`).
3) Start backend/frontend; login creates/uses the default org or an org provided at signup.

## Plans & limits (defaults)
- Free: 2 services, 3 members, 50 incidents.
- Pro: 20 services, 25 members, 1000 incidents.
- Enterprise: uncapped.

## Org switching
- UI has an org dropdown (header + dashboard tab). Switching updates the session/JWT with `orgId`.
- Last org is remembered in localStorage.

## Invites
- Admin/owner can create invites in the Organizations tab; copy the `/accept-invite?code=...` link.
- Accept page creates/joins the org with the specified membership role.

## Public status pages
- Share per-tenant URLs: `/status/[slug]` (preferred) or `/status?orgId=...`/`?orgSlug=...`.
- Status page remembers the last org selection and streams updates via SSE scoped to that org.

## Single-tenant (default)
- Leave `MULTI_TENANT_ENABLED` unset/false. A default org is seeded and all data attaches to it; org switcher and limits are effectively disabled.
