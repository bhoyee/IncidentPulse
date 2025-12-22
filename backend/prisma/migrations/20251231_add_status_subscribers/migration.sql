-- Status subscribers for public status notifications
CREATE TABLE "StatusSubscriber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "serviceIds" JSONB,
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "StatusSubscriber" ADD CONSTRAINT "StatusSubscriber_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "StatusSubscriber_verificationToken_key" ON "StatusSubscriber"("verificationToken");
CREATE UNIQUE INDEX "StatusSubscriber_org_email_key" ON "StatusSubscriber"("organizationId", "email");

CREATE INDEX "StatusSubscriber_org_verified_idx" ON "StatusSubscriber"("organizationId", "verifiedAt");
