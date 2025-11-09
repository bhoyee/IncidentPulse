CREATE TYPE "MaintenanceStatus" AS ENUM ('scheduled','in_progress','completed','canceled');

CREATE TABLE "MaintenanceEvent" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'scheduled',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "appliesToAll" BOOLEAN NOT NULL DEFAULT true,
  "serviceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MaintenanceEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MaintenanceEvent_startsAt_idx" ON "MaintenanceEvent"("startsAt");
CREATE INDEX "MaintenanceEvent_endsAt_idx" ON "MaintenanceEvent"("endsAt");
CREATE INDEX "MaintenanceEvent_status_idx" ON "MaintenanceEvent"("status");