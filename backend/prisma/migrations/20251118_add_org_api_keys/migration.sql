-- Add API key table scoped to organizations
CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hashedKey" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
CREATE UNIQUE INDEX "ApiKey_org_name_unique" ON "ApiKey"("organizationId", "name");
