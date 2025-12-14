-- Add billing status per org
CREATE TYPE "BillingStatus" AS ENUM ('active', 'past_due', 'suspended');
ALTER TABLE "Organization" ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'active';

