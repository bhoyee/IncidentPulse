CREATE TABLE "InviteToken" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "consumedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "InviteToken_email_idx" ON "InviteToken"("email");
CREATE INDEX "InviteToken_organizationId_idx" ON "InviteToken"("organizationId");
