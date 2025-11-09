CREATE TYPE "AuditAction" AS ENUM (
  'user_login',
  'user_created',
  'user_updated',
  'user_deleted',
  'incident_created',
  'incident_updated',
  'incident_resolved',
  'incident_investigating',
  'incident_monitoring',
  'incident_deleted',
  'maintenance_created',
  'maintenance_updated',
  'maintenance_canceled'
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "action" "AuditAction" NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "actorName" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_target_idx" ON "AuditLog"("targetType", "targetId");
