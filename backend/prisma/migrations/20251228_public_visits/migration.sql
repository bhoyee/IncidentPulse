CREATE TABLE IF NOT EXISTS "PublicVisit" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  ip text,
  "userAgent" text,
  country text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PublicVisit_createdAt_idx" ON "PublicVisit"("createdAt");
CREATE INDEX IF NOT EXISTS "PublicVisit_path_idx" ON "PublicVisit"(path);
