-- CreateTable
CREATE TABLE "IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "updateId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentAttachment_incidentId_idx" ON "IncidentAttachment"("incidentId");
CREATE INDEX "IncidentAttachment_updateId_idx" ON "IncidentAttachment"("updateId");

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "IncidentUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
