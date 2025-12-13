CREATE TABLE IF NOT EXISTS "TrafficStat" (
  id serial PRIMARY KEY,
  "orgId" text,
  route text NOT NULL,
  bucket timestamp with time zone NOT NULL,
  count integer NOT NULL DEFAULT 0,
  "errorCount" integer NOT NULL DEFAULT 0,
  "totalMs" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrafficStat_org_route_bucket_key" ON "TrafficStat"("orgId", route, bucket);
CREATE INDEX IF NOT EXISTS "TrafficStat_bucket_idx" ON "TrafficStat"(bucket);
CREATE INDEX IF NOT EXISTS "TrafficStat_orgId_idx" ON "TrafficStat"("orgId");
