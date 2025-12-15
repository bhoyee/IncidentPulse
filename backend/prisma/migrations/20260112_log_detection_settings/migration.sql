-- Add log-based auto incident settings to integration settings
ALTER TABLE "IntegrationSettings"
ADD COLUMN IF NOT EXISTS "autoIncidentEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "autoIncidentErrorThreshold" INTEGER,
ADD COLUMN IF NOT EXISTS "autoIncidentWindowSeconds" INTEGER,
ADD COLUMN IF NOT EXISTS "autoIncidentCooldownSeconds" INTEGER;
