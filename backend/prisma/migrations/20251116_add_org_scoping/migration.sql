-- Ensure a default organization exists
INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('org-default', 'Default Organization', 'default', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- Add organization to services
ALTER TABLE "Service" ADD COLUMN "organizationId" TEXT;
UPDATE "Service" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
ALTER TABLE "Service" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';
ALTER TABLE "Service" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Service"
  ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Service_organizationId_idx" ON "Service"("organizationId");
-- Drop the existing slug uniqueness constraint so we can replace it with org-scoped uniqueness.
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Service_slug_organizationId_key" ON "Service"("slug","organizationId");

-- Add organization to incidents (prefer service org, else default)
ALTER TABLE "Incident" ADD COLUMN "organizationId" TEXT;
UPDATE "Incident" i
SET "organizationId" = s."organizationId"
FROM "Service" s
WHERE i."serviceId" = s."id";
UPDATE "Incident" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
ALTER TABLE "Incident" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';
ALTER TABLE "Incident" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Incident_organizationId_idx" ON "Incident"("organizationId");

-- Add organization to maintenance events (prefer service org)
ALTER TABLE "MaintenanceEvent" ADD COLUMN "organizationId" TEXT;
UPDATE "MaintenanceEvent" m
SET "organizationId" = COALESCE(s."organizationId", 'org-default')
FROM "Service" s
WHERE m."serviceId" = s."id";
UPDATE "MaintenanceEvent" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
ALTER TABLE "MaintenanceEvent" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';
ALTER TABLE "MaintenanceEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "MaintenanceEvent"
  ADD CONSTRAINT "MaintenanceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "MaintenanceEvent_organizationId_idx" ON "MaintenanceEvent"("organizationId");

-- Add organization to audit logs
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
UPDATE "AuditLog" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- Make integration settings org-scoped; keep existing row on default org
ALTER TABLE "IntegrationSettings" ADD COLUMN "organizationId" TEXT;
UPDATE "IntegrationSettings" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
ALTER TABLE "IntegrationSettings" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';
ALTER TABLE "IntegrationSettings" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "IntegrationSettings"
  ADD CONSTRAINT "IntegrationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationSettings_organizationId_key" ON "IntegrationSettings"("organizationId");

-- Seed memberships for existing users into the default org (id derived from user id to avoid uuid extensions)
INSERT INTO "Membership" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT 'm-' || u."id", u."id", 'org-default',
  CASE u."role"
    WHEN 'admin' THEN 'owner'
    WHEN 'operator' THEN 'editor'
    ELSE 'viewer'
  END::"MembershipRole",
  NOW(),
  NOW()
FROM "User" u
ON CONFLICT ("userId", "organizationId") DO NOTHING;
