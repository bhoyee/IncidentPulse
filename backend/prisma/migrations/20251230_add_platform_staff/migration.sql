-- Add platform staff roles
CREATE TYPE "PlatformRole" AS ENUM ('none','support','sales','hr','operations');
ALTER TABLE "User" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'none';
