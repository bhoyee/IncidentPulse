-- Add AI summary toggle for log-based auto incidents
ALTER TABLE "IntegrationSettings"
ADD COLUMN IF NOT EXISTS "autoIncidentAiEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "autoIncidentSummaryLines" INTEGER;
