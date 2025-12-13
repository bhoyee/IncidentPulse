import type { IntegrationSettings } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_ORG_ID } from "./org";

const CACHE_TTL_MS = 30 * 1000;

type CachedSettings = {
  value: IntegrationSettings | null;
  expiresAt: number;
};

const cache: Record<string, CachedSettings> = {};

function getCache(orgId: string): CachedSettings {
  if (!cache[orgId]) {
    cache[orgId] = { value: null, expiresAt: 0 };
  }
  return cache[orgId];
}

export async function getIntegrationSettings(
  organizationId = DEFAULT_ORG_ID,
  force = false
): Promise<IntegrationSettings | null> {
  const bucket = getCache(organizationId);

  if (!force && bucket.expiresAt > Date.now()) {
    return bucket.value;
  }

  const value = await prisma.integrationSettings.findUnique({
    where: { organizationId }
  });

  cache[organizationId] = {
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
  data: IntegrationSettingsInput,
  organizationId = DEFAULT_ORG_ID
): Promise<IntegrationSettings> {
  const updated = await prisma.integrationSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      ...data
    },
    update: {
      ...data
    }
  });

  cache[organizationId] = {
    value: updated,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return updated;
}
