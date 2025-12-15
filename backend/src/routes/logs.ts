import type { FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { env } from "../env";
import { summarizeLogsWithAi } from "../lib/log-ai";
import { getPlanLimits } from "../lib/org-limits";

type LogEntry = {
  ts: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
};

const ingestSchema = z.object({
  service: z.string().min(1).max(120),
  level: z.enum(["debug", "info", "warn", "error"]),
  timestamp: z.string().datetime().optional(),
  message: z.string().min(1).max(5000),
  context: z.record(z.any()).optional()
});

const BUFFER_TTL_MS = env.LOG_BUFFER_TTL_MS ?? 10 * 60 * 1000; // keep up to 10 minutes
const TRIGGER_WINDOW_MS = env.LOG_TRIGGER_WINDOW_MS ?? 60 * 1000; // look back 60s
const ERROR_THRESHOLD = env.LOG_TRIGGER_ERROR_THRESHOLD ?? 20; // default threshold in window
const TRIGGER_COOLDOWN_MS = env.LOG_TRIGGER_COOLDOWN_MS ?? 5 * 60 * 1000; // prevent rapid repeat incidents

const logBuffers = new Map<string, LogEntry[]>(); // key: orgId:serviceId
const lastTriggers = new Map<string, number>(); // key: orgId:serviceId

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function pruneBuffer(key: string, now: number) {
  const buf = logBuffers.get(key);
  if (!buf) return;
  const fresh = buf.filter((entry) => now - entry.ts <= BUFFER_TTL_MS);
  logBuffers.set(key, fresh);
}

const logsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/ingest", async (request, reply) => {
    // API key auth
    const authHeader = request.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token.startsWith("ipk_")) {
      return reply.status(401).send({ error: true, message: "Invalid API key" });
    }

    const hashed = hashKey(token);
    const apiKey = await prisma.apiKey.findFirst({
      where: { hashedKey: hashed },
      select: { organizationId: true, id: true }
    });
    if (!apiKey) {
      return reply.status(401).send({ error: true, message: "Unauthorized" });
    }
    await prisma.apiKey
      .updateMany({
        where: { hashedKey: hashed },
        data: { lastUsedAt: new Date() }
      })
      .catch(() => {});

    const parsed = ingestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: true, message: "Invalid payload" });
    }
    const payload = parsed.data;
    const orgId = apiKey.organizationId;

    // Find service by slug or name
    const service = await prisma.service.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ slug: payload.service }, { name: payload.service }]
      }
    });
    if (!service) {
      return reply.status(400).send({ error: true, message: "Service not found for org" });
    }

    // respect plan limits on log-based auto incidents (reuse incident monthly cap)
    const [org, integrationSettings] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true }
      }),
      prisma.integrationSettings.findUnique({
        where: { organizationId: orgId }
      }) as any
    ]);
    const limits = getPlanLimits(org?.plan ?? "free");

    const now = Date.now();
    const key = `${orgId}:${service.id}`;
    const entry: LogEntry = {
      ts: payload.timestamp ? Date.parse(payload.timestamp) || now : now,
      level: payload.level,
      message: payload.message,
      context: payload.context
    };

    pruneBuffer(key, now);
    const buf = logBuffers.get(key) ?? [];
    buf.push(entry);
    logBuffers.set(key, buf);

    // Simple trigger: errors in last TRIGGER_WINDOW_MS exceed threshold
    const orgEnabled = integrationSettings?.autoIncidentEnabled ?? false;
    const threshold = integrationSettings?.autoIncidentErrorThreshold ?? ERROR_THRESHOLD;
    const windowMs =
      (integrationSettings?.autoIncidentWindowSeconds ?? TRIGGER_WINDOW_MS / 1000) * 1000;
    const cooldownMs =
      (integrationSettings?.autoIncidentCooldownSeconds ?? TRIGGER_COOLDOWN_MS / 1000) * 1000;
    const summaryLines =
      integrationSettings?.autoIncidentSummaryLines && integrationSettings.autoIncidentSummaryLines > 0
        ? Math.min(200, integrationSettings.autoIncidentSummaryLines)
        : 200;

    if (!orgEnabled) {
      return reply.send({ error: false, message: "Ingested (auto incidents disabled)" });
    }

    const windowCutoff = now - windowMs;
    const recentErrors = buf.filter((e) => e.ts >= windowCutoff && e.level === "error");
    const lastTriggerAt = lastTriggers.get(key) ?? 0;
    const inCooldown = now - lastTriggerAt < cooldownMs;

    if (!inCooldown && recentErrors.length >= threshold) {
      // Enforce incident cap if any
      if (limits.maxIncidentsPerMonth !== undefined) {
        const since = new Date();
        since.setDate(1);
        const incidentCount = await prisma.incident.count({
          where: { organizationId: orgId, createdAt: { gte: since } }
        });
        if (incidentCount >= limits.maxIncidentsPerMonth) {
          fastify.log.warn(
            { orgId, serviceId: service.id },
            "Skipping auto-incident: monthly cap reached"
          );
          return reply.send({ error: false, message: "Ingested (cap reached, no incident created)" });
        }
      }

      // Choose creator: system user or first admin in org
      let createdById = env.WEBHOOK_SYSTEM_USER_ID;
      if (!createdById) {
        const admin = await prisma.user.findFirst({
          where: {
            memberships: { some: { organizationId: orgId, role: "admin" } },
            isActive: true
          },
          select: { id: true }
        });
        if (admin) {
          createdById = admin.id;
        }
      }
      if (!createdById) {
        fastify.log.warn({ orgId }, "No system/admin user available for auto incident");
        return reply.send({ error: false, message: "Ingested (no creator available)" });
      }

      const descriptionLines = recentErrors
        .slice(-5)
        .map((e) => `- ${new Date(e.ts).toISOString()} ${e.message}`)
        .join("\n");

      const incident = await prisma.incident.create({
        data: {
          organizationId: orgId,
          serviceId: service.id,
          title: `Auto-detected errors in ${service.name}`,
          description:
            `Detected ${recentErrors.length} error-level log events in the last minute.\n` +
            `Recent examples:\n${descriptionLines}`,
          severity: "high",
          status: "investigating",
          createdById
        }
      });

      // Optional AI summary if enabled and key present
      const aiEnabled =
        env.AI_LOG_SUMMARY_ENABLED && env.DEEPSEEK_API_KEY && integrationSettings?.autoIncidentAiEnabled;
      if (aiEnabled) {
        const summary = await summarizeLogsWithAi(
          fastify.log,
          buf.slice(-summaryLines),
          service.name
        );
        if (summary) {
          try {
            await prisma.incidentUpdate.create({
              data: {
                incidentId: incident.id,
                authorId: createdById,
                message: `AI log summary:\n${summary}`
              }
            });
          } catch (err) {
            fastify.log.warn({ err }, "Failed to store AI log summary");
          }
        }
      }

      lastTriggers.set(key, now);
      fastify.log.info(
        { orgId, serviceId: service.id, incidentId: incident.id },
        "Auto-created incident from log ingest"
      );
    }

    return reply.send({ error: false, message: "Ingested" });
  });
};

export default logsRoutes;
