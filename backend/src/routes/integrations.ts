import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getIntegrationSettings, saveIntegrationSettings } from "../lib/integration-settings";

const updateSchema = z.object({
  slackWebhookUrl: z
    .string()
    .url("Slack webhook must be a valid URL")
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
    .or(z.literal(""))
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
    async (_request, reply) => {
      const settings = await getIntegrationSettings();

      return reply.send({
        error: false,
        data: {
          slackWebhookUrl: settings?.slackWebhookUrl ?? "",
          telegramBotToken: settings?.telegramBotToken ?? "",
          telegramChatId: settings?.telegramChatId ?? ""
        }
      });
    }
  );

  fastify.put(
    "/settings",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid integration settings"
        });
      }

      const payload = parsed.data;

      const updated = await saveIntegrationSettings({
        slackWebhookUrl: sanitizeInput(payload.slackWebhookUrl),
        telegramBotToken: sanitizeInput(payload.telegramBotToken),
        telegramChatId: sanitizeInput(payload.telegramChatId)
      });

      return reply.send({
        error: false,
        data: {
          slackWebhookUrl: updated.slackWebhookUrl ?? "",
          telegramBotToken: updated.telegramBotToken ?? "",
          telegramChatId: updated.telegramChatId ?? ""
        }
      });
    }
  );
};

export default integrationsRoutes;
