-- Add subscription id to organizations for Stripe lifecycle management
ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

-- Optional index to speed lookups by subscription id
CREATE INDEX IF NOT EXISTS "Organization_stripeSubscriptionId_idx"
  ON "Organization" ("stripeSubscriptionId");
