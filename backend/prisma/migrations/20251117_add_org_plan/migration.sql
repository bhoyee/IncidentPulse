-- Create plan enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Plan') THEN
        CREATE TYPE "Plan" AS ENUM ('free','pro','enterprise');
    END IF;
END$$;

-- Add plan column
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan" "Plan" NOT NULL DEFAULT 'free';
