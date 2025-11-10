-- Add Discord and Microsoft Teams webhook URLs to integration settings
ALTER TABLE "IntegrationSettings"
ADD COLUMN "discordWebhookUrl" TEXT,
ADD COLUMN "teamsWebhookUrl" TEXT;
