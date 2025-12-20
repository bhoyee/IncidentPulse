-- Add status embed branding fields to integration settings
ALTER TABLE "IntegrationSettings"
  ADD COLUMN "statusEmbedEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "statusLogoUrl" TEXT,
  ADD COLUMN "statusPrimaryColor" TEXT,
  ADD COLUMN "statusTextColor" TEXT,
  ADD COLUMN "statusBackgroundColor" TEXT;
