-- Repair missing unique/index on StatusSubscriber for (organizationId, email)
CREATE INDEX IF NOT EXISTS "StatusSubscriber_org_email_idx"
  ON "StatusSubscriber" ("organizationId", "email");
