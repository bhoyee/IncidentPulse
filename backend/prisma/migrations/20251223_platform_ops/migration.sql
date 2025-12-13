-- Add org status and soft-delete fields
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended');

ALTER TABLE "Organization"
  ADD COLUMN "status" "OrgStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Extend audit actions for platform operations
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'platform_org_status_updated';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'platform_org_plan_updated';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'platform_org_deleted';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'platform_user_suspended';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'platform_user_password_reset';
