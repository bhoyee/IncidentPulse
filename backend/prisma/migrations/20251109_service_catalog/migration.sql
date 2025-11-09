-- Create services table
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure a default platform service exists for legacy incidents
INSERT INTO "Service" ("id", "name", "slug", "description")
VALUES ('service-platform', 'Platform', 'platform', 'Default platform-wide service')
ON CONFLICT ("id") DO NOTHING;

-- Add serviceId column to incidents
ALTER TABLE "Incident" ADD COLUMN "serviceId" TEXT;

UPDATE "Incident"
SET "serviceId" = 'service-platform'
WHERE "serviceId" IS NULL;

ALTER TABLE "Incident"
ALTER COLUMN "serviceId" SET NOT NULL;

ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Incident_serviceId_idx" ON "Incident"("serviceId");
