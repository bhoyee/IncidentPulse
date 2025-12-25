-- Ensure StatusSubscriber has a cascading FK to Organization
ALTER TABLE "StatusSubscriber" DROP CONSTRAINT IF EXISTS "StatusSubscriber_organizationId_fkey";
ALTER TABLE "StatusSubscriber"
  ADD CONSTRAINT "StatusSubscriber_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
