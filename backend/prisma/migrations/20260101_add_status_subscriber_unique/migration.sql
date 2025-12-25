-- Add unique constraint on (organizationId, email) for status subscribers, guarded to avoid duplicate creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'StatusSubscriber_org_email_key'
  ) THEN
    CREATE UNIQUE INDEX "StatusSubscriber_org_email_key" ON "StatusSubscriber"("organizationId", "email");
  END IF;
END$$;
