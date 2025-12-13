-- Add Stripe customer id to organizations for per-tenant billing
ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT UNIQUE;
