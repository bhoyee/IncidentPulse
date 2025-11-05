import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { env } from "../env";
import {
  incidentNotificationInclude,
  loadActiveAdmins,
  notifyAdminsOfIncident,
  notifyAssigneeOfResolution,
  type AdminRecipient
} from "../lib/incident-notifier";
import { incrementWebhookMetric } from "../lib/webhook-metrics";

type Severity = "low" | "medium" | "high" | "critical";

type NormalizedWebhookPayload = {
  service: string;
  environment: string;
  eventType: string;
  message: string;
  severity: Severity;
  occurredAt: Date;
  fingerprint: string;
  meta: Record<string, unknown>;
};

type WebhookAction =
  | "created"
  | "appended_update"
  | "recovered"
  | "noop";

type IdempotencyRecord = {
  timestamp: number;
  response: {
    incidentId: string | null;
    action: WebhookAction;
  };
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const SKEW_WINDOW_MS = 10 * 60 * 1000;

const SIGNATURE_HEADER = "x-signature";
const TOKEN_HEADER = "x-webhook-token";
const IDEMPOTENCY_HEADER = "x-idempotency-key";

const severityOrder: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
const idempotencyStore = new Map<string, IdempotencyRecord>();

const webhookPayloadSchema = z.object({
  service: z.string().min(1).max(100),
  environment: z.string().min(1).max(100),
  eventType: z.string().min(1).max(100),
  message: z.string().min(1).max(5000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  occurredAt: z.string().datetime(),
  fingerprint: z.string().min(1).max(200).optional(),
  meta: z.record(z.unknown()).optional()
});

const recoveryPayloadSchema = z.object({
  service: z.string().min(1).max(100).optional(),
  environment: z.string().min(1).max(100).optional(),
  eventType: z.string().min(1).max(100).optional(),
  fingerprint: z.string().min(1).max(200),
  occurredAt: z.string().datetime().optional(),
  meta: z.record(z.unknown()).optional()
});

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/incidents",
    { config: { rawBody: true } },
    async (request, reply) => {
      incrementWebhookMetric("totalReceived");

      const authResult = authenticateRequest(request);
      if (!authResult.ok) {
        incrementWebhookMetric("rejected");
        return reply.status(authResult.statusCode).send({
          error: true,
          message: authResult.message
        });
      }

      if (isRateLimited(authResult.identity)) {
        incrementWebhookMetric("rateLimited");
        return reply.status(429).send({
          error: true,
          message: "Too many webhook requests. Try again shortly."
        });
      }

      const idempotencyKey = getIdempotencyKey(request);
      const existingIdempotentResponse = getIdempotentResponse(idempotencyKey);
      if (existingIdempotentResponse) {
        incrementWebhookMetric("idempotentReplay");
        return reply.status(200).send({
          error: false,
          data: existingIdempotentResponse,
          idempotent: true
        });
      }

      const parseResult = webhookPayloadSchema.safeParse(request.body);
      if (!parseResult.success) {
        incrementWebhookMetric("rejected");
        return reply.status(400).send({
          error: true,
          message:
            parseResult.error.flatten().formErrors.join(", ") || "Invalid webhook payload"
        });
      }

      const normalized = normalizePayload(parseResult.data);

      if (!isWithinSkewWindow(normalized.occurredAt)) {
        incrementWebhookMetric("rejected");
        return reply.status(400).send({
          error: true,
          message: "occurredAt timestamp is outside the allowed window"
        });
      }

      const admins = await loadActiveAdmins();
      const automationActorId = await resolveAutomationActor(admins);
      if (!automationActorId) {
        incrementWebhookMetric("rejected");
        fastify.log.error(
          { incident: normalized },
          "Unable to resolve automation actor for webhook incident"
        );
        return reply.status(500).send({
          error: true,
          message: "Automation user unavailable to attribute incident"
        });
      }

      const fingerprintCategory = fingerprintCategoryLabel(normalized.fingerprint);
      const dedupeWindowStart = new Date(
        normalized.occurredAt.getTime() - DEDUPE_WINDOW_MS
      );

      const existingIncident = await prisma.incident.findFirst({
        where: {
          status: {
            in: ["open", "investigating", "monitoring"]
          },
          categories: {
            has: fingerprintCategory
          },
          createdAt: {
            gte: dedupeWindowStart
          }
        }
      });

      if (existingIncident) {
        const shouldUpgradeSeverity =
          severityOrder[normalized.severity] > severityOrder[existingIncident.severity];

        if (shouldUpgradeSeverity) {
          await prisma.incident.update({
            where: { id: existingIncident.id },
            data: {
              severity: normalized.severity,
              status: existingIncident.status === "open" ? "investigating" : existingIncident.status
            }
          });
        }

        await prisma.incidentUpdate.create({
          data: {
            incidentId: existingIncident.id,
            authorId: automationActorId,
            message: buildUpdateMessage("repeat", normalized)
          }
        });

        incrementWebhookMetric("deduped");
        const response = {
          incidentId: existingIncident.id,
          action: "appended_update" as const
        };
        storeIdempotencyRecord(idempotencyKey, response);

        return reply.status(202).send({
          error: false,
          data: response
        });
      }

      const categories = buildIncidentCategories(normalized);
      const initialStatus: "open" | "investigating" =
        normalized.severity === "high" || normalized.severity === "critical"
          ? "investigating"
          : "open";

      const incident = await prisma.incident.create({
        data: {
          title: buildIncidentTitle(normalized),
          severity: normalized.severity,
          status: initialStatus,
          description: normalized.message,
          categories,
          impactScope: normalized.environment,
          createdById: automationActorId
        },
        include: incidentNotificationInclude
      });

      await prisma.incidentUpdate.create({
        data: {
          incidentId: incident.id,
          authorId: automationActorId,
          message: buildUpdateMessage("create", normalized)
        }
      });

      incrementWebhookMetric("created");
      await notifyAdminsOfIncident(fastify.log, incident, admins);

      const response = {
        incidentId: incident.id,
        action: "created" as const
      };
      storeIdempotencyRecord(idempotencyKey, response);

      return reply.status(201).send({
        error: false,
        data: response
      });
    }
  );

  fastify.post(
    "/incidents/recovery",
    { config: { rawBody: true } },
    async (request, reply) => {
      incrementWebhookMetric("totalReceived");

      const authResult = authenticateRequest(request);
      if (!authResult.ok) {
        incrementWebhookMetric("rejected");
        return reply.status(authResult.statusCode).send({
          error: true,
          message: authResult.message
        });
      }

      if (isRateLimited(`${authResult.identity}:recovery`)) {
        incrementWebhookMetric("rateLimited");
        return reply.status(429).send({
          error: true,
          message: "Too many webhook requests. Try again shortly."
        });
      }

      const idempotencyKey = getIdempotencyKey(request);
      const existingIdempotentResponse = getIdempotentResponse(idempotencyKey);
      if (existingIdempotentResponse) {
        incrementWebhookMetric("idempotentReplay");
        return reply.status(200).send({
          error: false,
          data: existingIdempotentResponse,
          idempotent: true
        });
      }

      const parseResult = recoveryPayloadSchema.safeParse(request.body);
      if (!parseResult.success) {
        incrementWebhookMetric("rejected");
        return reply.status(400).send({
          error: true,
          message:
            parseResult.error.flatten().formErrors.join(", ") || "Invalid recovery payload"
        });
      }

      const payload = parseResult.data;
      const normalizedFingerprint = payload.fingerprint.trim().toLowerCase();
      const fingerprintCategory = fingerprintCategoryLabel(normalizedFingerprint);

      const incident = await prisma.incident.findFirst({
        where: {
          status: {
            not: "resolved"
          },
          categories: {
            has: fingerprintCategory
          }
        },
        include: incidentNotificationInclude
      });

      if (!incident) {
        incrementWebhookMetric("recoveryMiss");
        storeIdempotencyRecord(idempotencyKey, {
          incidentId: null,
          action: "noop"
        });

        return reply.status(202).send({
          error: false,
          data: {
            incidentId: null,
            action: "noop" as const
          }
        });
      }

      const resolutionTime = payload.occurredAt
        ? new Date(payload.occurredAt)
        : new Date();

      const updatedIncident = await prisma.incident.update({
        where: { id: incident.id },
        data: {
          status: "resolved",
          resolvedAt: resolutionTime
        },
        include: incidentNotificationInclude
      });

      await prisma.incidentUpdate.create({
        data: {
          incidentId: incident.id,
          authorId: updatedIncident.createdBy.id,
          message: buildRecoveryMessage(payload)
        }
      });

      incrementWebhookMetric("recovered");
      await notifyAssigneeOfResolution(fastify.log, updatedIncident, resolutionTime);

      const response = {
        incidentId: incident.id,
        action: "recovered" as const
      };
      storeIdempotencyRecord(idempotencyKey, response);

      return reply.status(202).send({
        error: false,
        data: response
      });
    }
  );
};

function authenticateRequest(
  request: FastifyRequest
):
  | { ok: true; identity: string }
  | { ok: false; statusCode: number; message: string } {
  const signatureHeader = headerValue(request, SIGNATURE_HEADER);
  const tokenHeader = headerValue(request, TOKEN_HEADER);

  if (signatureHeader) {
    const rawBody = request.rawBody;
    if (verifySignature(rawBody, signatureHeader)) {
      return { ok: true, identity: "hmac" };
    }
    return {
      ok: false,
      statusCode: 401,
      message: "Invalid webhook signature"
    };
  }

  if (env.WEBHOOK_SHARED_TOKEN && tokenHeader) {
    if (tokenHeader === env.WEBHOOK_SHARED_TOKEN) {
      return { ok: true, identity: `token:${tokenHeader}` };
    }
    return {
      ok: false,
      statusCode: 401,
      message: "Invalid webhook token"
    };
  }

  return {
    ok: false,
    statusCode: 401,
    message: "Missing webhook signature"
  };
}

function verifySignature(rawBody: Buffer | undefined, signature: string): boolean {
  if (!rawBody) {
    return false;
  }
  try {
    const expected = crypto
      .createHmac("sha256", env.WEBHOOK_HMAC_SECRET)
      .update(rawBody)
      .digest("hex");

    const providedBuffer = Buffer.from(signature.toLowerCase(), "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function isRateLimited(identity: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(identity);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(identity, { count: 1, windowStart: now });
    return false;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return true;
  }

  bucket.count += 1;
  return false;
}

function getIdempotencyKey(request: FastifyRequest): string | undefined {
  return headerValue(request, IDEMPOTENCY_HEADER);
}

function getIdempotentResponse(
  key?: string
): { incidentId: string | null; action: WebhookAction } | undefined {
  if (!key) {
    return undefined;
  }
  const record = idempotencyStore.get(key);
  if (!record) {
    return undefined;
  }

  if (Date.now() - record.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(key);
    return undefined;
  }

  return record.response;
}

function storeIdempotencyRecord(
  key: string | undefined,
  response: { incidentId: string | null; action: WebhookAction }
) {
  if (!key) {
    return;
  }
  idempotencyStore.set(key, {
    timestamp: Date.now(),
    response
  });
}

function normalizePayload(payload: z.infer<typeof webhookPayloadSchema>): NormalizedWebhookPayload {
  const service = payload.service.trim().toLowerCase();
  const environment = payload.environment.trim().toLowerCase();
  const eventType = payload.eventType.trim();
  const message = payload.message.trim();
  const occurredAt = new Date(payload.occurredAt);

  const fingerprint = (payload.fingerprint ?? `${service}|${environment}|${eventType}`).trim().toLowerCase();

  return {
    service,
    environment,
    eventType,
    message,
    severity: payload.severity,
    occurredAt,
    fingerprint,
    meta: payload.meta ?? {}
  };
}

function isWithinSkewWindow(date: Date): boolean {
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return Math.abs(Date.now() - date.getTime()) <= SKEW_WINDOW_MS;
}

async function resolveAutomationActor(admins: AdminRecipient[]): Promise<string | null> {
  if (env.WEBHOOK_SYSTEM_USER_ID) {
    const systemUser = await prisma.user.findFirst({
      where: {
        id: env.WEBHOOK_SYSTEM_USER_ID,
        isActive: true
      },
      select: {
        id: true
      }
    });
    if (systemUser) {
      return systemUser.id;
    }
  }

  return admins[0]?.id ?? null;
}

function fingerprintCategoryLabel(fingerprint: string): string {
  return `fingerprint:${fingerprint}`;
}

function buildIncidentCategories(payload: NormalizedWebhookPayload): string[] {
  return [
    "auto:webhook",
    `service:${payload.service}`,
    `env:${payload.environment}`,
    `event:${payload.eventType}`,
    fingerprintCategoryLabel(payload.fingerprint)
  ];
}

function buildIncidentTitle(payload: NormalizedWebhookPayload): string {
  const serviceLabel = payload.service.replace(/[-_]/g, " ");
  return `[${payload.environment}] ${capitalizeWords(serviceLabel)} ${payload.eventType}`;
}

function buildUpdateMessage(
  kind: "create" | "repeat",
  payload: NormalizedWebhookPayload
): string {
  const lines = [
    kind === "create"
      ? `Automated incident created from ${payload.service} (${payload.eventType}).`
      : `Repeat alert received for ${payload.service} (${payload.eventType}).`,
    `Severity: ${payload.severity}`,
    `Environment: ${payload.environment}`,
    `Occurred at: ${payload.occurredAt.toISOString()}`,
    "",
    payload.message
  ];

  if (Object.keys(payload.meta).length > 0) {
    lines.push("", `Meta: ${JSON.stringify(payload.meta)}`);
  }

  return lines.join("\n");
}

function buildRecoveryMessage(payload: z.infer<typeof recoveryPayloadSchema>): string {
  const occurredText = payload.occurredAt
    ? ` at ${new Date(payload.occurredAt).toISOString()}`
    : "";
  const parts = [`Automated recovery received${occurredText}.`];
  if (Object.keys(payload.meta ?? {}).length > 0) {
    parts.push(`Meta: ${JSON.stringify(payload.meta)}`);
  }
  return parts.join("\n");
}

function headerValue(request: FastifyRequest, header: string): string | undefined {
  const value = request.headers[header] ?? request.headers[header.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ? String(value) : undefined;
}

function capitalizeWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default webhookRoutes;
