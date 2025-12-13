-- Add internal flag to support comments
ALTER TABLE "SupportComment" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;
