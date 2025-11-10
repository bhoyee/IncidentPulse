import type { IntegrationSettings } from "@prisma/client";
import { prisma } from "./db";

const SETTINGS_ID = "global-integrations";
const CACHE_TTL_MS = 30 * 1000;

type CachedSettings = {
  value: IntegrationSettings | null;
  expiresAt: number;
};

let cache: CachedSettings = {
  value: null,
  expiresAt: 0
};

export async function getIntegrationSettings(force = false): Promise<IntegrationSettings | null> {
  if (!force && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const value = await prisma.integrationSettings.findUnique({
    where: { id: SETTINGS_ID }
  });

  cache = {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return value;
}

type IntegrationSettingsInput = {
  slackWebhookUrl?: string | null | undefined;
  discordWebhookUrl?: string | null | undefined;
  teamsWebhookUrl?: string | null | undefined;
  telegramBotToken?: string | null | undefined;
  telegramChatId?: string | null | undefined;
};

export async function saveIntegrationSettings(
  data: IntegrationSettingsInput
): Promise<IntegrationSettings> {
  const updated = await prisma.integrationSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      ...data
    },
    update: {
      ...data
    }
  });

  cache = {
    value: updated,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return updated;
}
