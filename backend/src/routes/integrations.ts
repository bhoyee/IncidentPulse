import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getIntegrationSettings, saveIntegrationSettings } from "../lib/integration-settings";
import { getRequestOrgId } from "../lib/org";
import { env } from "../env";

const updateSchema = z.object({
  slackWebhookUrl: z
    .string()
    .url("Slack webhook must be a valid URL")
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
  discordWebhookUrl: z
    .string()
    .url("Discord webhook must be a valid URL")
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
  teamsWebhookUrl: z
    .string()
    .url("Teams webhook must be a valid URL")
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
  telegramBotToken: z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal("")),
  telegramChatId: z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal("")),
  autoIncidentEnabled: z.boolean().optional(),
  autoIncidentErrorThreshold: z.coerce.number().int().positive().optional(),
  autoIncidentWindowSeconds: z.coerce.number().int().positive().optional(),
  autoIncidentCooldownSeconds: z.coerce.number().int().positive().optional()
});

const sanitizeInput = (value: string | undefined | ""): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/settings",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const settings = (await getIntegrationSettings(orgId)) as any;

      return reply.send({
        error: false,
        data: {
          slackWebhookUrl: settings?.slackWebhookUrl ?? "",
          discordWebhookUrl: settings?.discordWebhookUrl ?? "",
          teamsWebhookUrl: settings?.teamsWebhookUrl ?? "",
          telegramBotToken: settings?.telegramBotToken ?? "",
          telegramChatId: settings?.telegramChatId ?? "",
          stripePortalUrl: env.STRIPE_PORTAL_RETURN_URL ?? "",
          autoIncidentEnabled: settings?.autoIncidentEnabled ?? false,
          autoIncidentErrorThreshold: settings?.autoIncidentErrorThreshold ?? null,
          autoIncidentWindowSeconds: settings?.autoIncidentWindowSeconds ?? null,
          autoIncidentCooldownSeconds: settings?.autoIncidentCooldownSeconds ?? null
        }
      });
    }
  );

  fastify.put(
    "/settings",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid integration settings"
        });
      }

      const payload = parsed.data;

      const updated: any = await saveIntegrationSettings(
        {
          slackWebhookUrl: sanitizeInput(payload.slackWebhookUrl),
          discordWebhookUrl: sanitizeInput(payload.discordWebhookUrl),
          teamsWebhookUrl: sanitizeInput(payload.teamsWebhookUrl),
          telegramBotToken: sanitizeInput(payload.telegramBotToken),
          telegramChatId: sanitizeInput(payload.telegramChatId),
          autoIncidentEnabled: payload.autoIncidentEnabled ?? undefined,
          autoIncidentErrorThreshold: payload.autoIncidentErrorThreshold ?? undefined,
          autoIncidentWindowSeconds: payload.autoIncidentWindowSeconds ?? undefined,
          autoIncidentCooldownSeconds: payload.autoIncidentCooldownSeconds ?? undefined
        },
        orgId
      );

      return reply.send({
        error: false,
        data: {
          slackWebhookUrl: updated.slackWebhookUrl ?? "",
          discordWebhookUrl: updated.discordWebhookUrl ?? "",
          teamsWebhookUrl: updated.teamsWebhookUrl ?? "",
          telegramBotToken: updated.telegramBotToken ?? "",
          telegramChatId: updated.telegramChatId ?? "",
          autoIncidentEnabled: updated.autoIncidentEnabled ?? false,
          autoIncidentErrorThreshold: updated.autoIncidentErrorThreshold ?? null,
          autoIncidentWindowSeconds: updated.autoIncidentWindowSeconds ?? null,
          autoIncidentCooldownSeconds: updated.autoIncidentCooldownSeconds ?? null
        }
      });
    }
  );
};

export default integrationsRoutes;
