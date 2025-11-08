-- CreateTable
CREATE TABLE "IntegrationSettings" (
    "id" TEXT NOT NULL DEFAULT 'global-integrations',
    "slackWebhookUrl" TEXT,
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSettings_pkey" PRIMARY KEY ("id")
);
