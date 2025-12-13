# Administrator Onboarding (First-Time Setup)

This guide walks a new admin through configuring IncidentPulse from a fresh install to a usable workspace.

## 1) Sign up / log in
- Create your admin account (or use the seeded demo admin if provided).

## 2) Choose or create your organization
- Open the org switcher (header) or the Organizations tab.
- Create your first org if allowed by your plan; otherwise use the default org.

## 3) Configure services (what you monitor)
- Go to Automation/Services.
- Add each service with a clear name/slug and description.
- (Optional) Configure webhooks/automation endpoints for incident create/recover.

## 4) Invite your team (plan limits apply)
- Go to Team Management.
- Send invites with roles (admin/operator/viewer).
- Teammates accept via email or invite link at `/accept-invite?code=...`.

## 5) Set incident policies and notifications
- Define severities/labels and messaging style (if configurable).
- Review notification channels (email/webhooks/Slack/Discord/Teams/Telegram) and set HMAC/shared secrets.

## 6) Test incidents
- From Dashboard or Automation, create a test incident tied to a service.
- Add a timeline note and (optionally) upload evidence.
- Resolve/close it to verify lifecycle events.

## 7) Schedule maintenance
- In Maintenance, create a test window for a service.
- Confirm it appears on the status page timeline.

## 8) Public status (per org)
- Click Status in the header; per-org public URLs use `/status/[slug]`.
- For multi-org setups, switch orgs and confirm the status page updates for that org.
- Share the per-org status link with stakeholders.

## 9) Billing (if enabled)
- Open the Billing tab; start checkout or portal to pick a plan.
- After upgrade, plan limits (services/members/incidents) should reflect the new plan.

## 10) API keys and automation
- Go to Automation/API Keys; generate a key and copy it from the modal.
- Use it in monitoring scripts/webhooks to create/resolve incidents.

## 11) Audit and security
- Check System Audit to confirm recent actions.
- Rotate keys/secrets as needed; ensure JWT/COOKIE settings match your domain.

## 12) Go live
- Point uptime monitors to your services, and configure external systems to hit your webhooks.
- Share the status page link, and keep the org switcher handy for multi-client setups.
