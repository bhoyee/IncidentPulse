-- Support ticketing models
CREATE TYPE "SupportStatus" AS ENUM ('open', 'pending', 'closed');
CREATE TYPE "SupportPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE "SupportTicket" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "SupportStatus" NOT NULL DEFAULT 'open',
  "priority" "SupportPriority" NOT NULL DEFAULT 'medium',
  "category" TEXT,
  "assigneeId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "SupportComment" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "SupportAttachment" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FKs
ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "SupportTicket_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "SupportTicket_assignee_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "SupportComment"
  ADD CONSTRAINT "SupportComment_ticket_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "SupportComment_author_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "SupportAttachment"
  ADD CONSTRAINT "SupportAttachment_ticket_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "SupportAttachment_user_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX "SupportTicket_org_idx" ON "SupportTicket"("organizationId");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");
CREATE INDEX "SupportTicket_assignee_idx" ON "SupportTicket"("assigneeId");

CREATE INDEX "SupportComment_ticket_idx" ON "SupportComment"("ticketId");
CREATE INDEX "SupportComment_author_idx" ON "SupportComment"("authorId");

CREATE INDEX "SupportAttachment_ticket_idx" ON "SupportAttachment"("ticketId");
CREATE INDEX "SupportAttachment_uploaded_idx" ON "SupportAttachment"("uploadedById");
