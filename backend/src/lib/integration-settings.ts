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
  autoIncidentEnabled?: boolean;
  autoIncidentErrorThreshold?: number | null;
  autoIncidentWindowSeconds?: number | null;
  autoIncidentCooldownSeconds?: number | null;
  autoIncidentAiEnabled?: boolean;
  autoIncidentSummaryLines?: number | null;
  statusEmbedEnabled?: boolean;
  statusLogoUrl?: string | null;
  statusPrimaryColor?: string | null;
  statusTextColor?: string | null;
  statusBackgroundColor?: string | null;
};

export async function saveIntegrationSettings(
  data: IntegrationSettingsInput,
  organizationId = DEFAULT_ORG_ID
): Promise<IntegrationSettings> {
  const normalized: IntegrationSettingsInput = {
    ...data,
    autoIncidentErrorThreshold: data.autoIncidentErrorThreshold ?? null,
    autoIncidentWindowSeconds: data.autoIncidentWindowSeconds ?? null,
    autoIncidentCooldownSeconds: data.autoIncidentCooldownSeconds ?? null,
    autoIncidentSummaryLines: data.autoIncidentSummaryLines ?? null
  };

  const updated = await prisma.integrationSettings.upsert({
    where: { organizationId },
    create: {
      organization: { connect: { id: organizationId } },
      ...normalized
    },
    update: {
      ...normalized
    }
  });

  cache[organizationId] = {
    value: updated,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return updated;
}
