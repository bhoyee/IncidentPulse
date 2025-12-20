import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rawBody from "fastify-raw-body";
import fastifyJwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env";
import { databaseHealthCheck } from "./lib/db";
import { getSessionCookieName } from "./lib/auth";
import { registerIncidentEscalationWatcher } from "./lib/escalation-monitor";
import authRoutes from "./routes/auth";
import incidentsRoutes from "./routes/incidents";
import publicRoutes from "./routes/public";
import metricsRoutes from "./routes/metrics";
import teamRoutes from "./routes/team";
import integrationsRoutes from "./routes/integrations";
import apiKeysRoutes from "./routes/api-keys";
import billingRoutes from "./routes/billing";
import webhooksRoutes from "./routes/webhooks";
import servicesRoutes from "./routes/services";
import maintenanceRoutes from "./routes/maintenance";
import auditRoutes from "./routes/audit";
import organizationsRoutes from "./routes/organizations";
import supportRoutes from "./routes/support";
import logsRoutes from "./routes/logs";
import platformRoutes from "./routes/platform";
import { enforceOrgRateLimit } from "./lib/org-rate-limit";
import { recordTraffic, persistTraffic } from "./lib/traffic-metrics";
import { recordPublicVisit } from "./lib/visitor-metrics";
import {
  ensureUploadsRootSync,
  MAX_ATTACHMENT_BYTES,
  uploadsRoot
} from "./lib/storage";
import { hasDemoEmails, isDemoEmail } from "./lib/demo";

export function buildApp() {
  ensureUploadsRootSync();

  const fastify = Fastify({
    trustProxy: true,
    logger: {
      transport:
        process.env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: {
                singleLine: true
              }
            }
          : undefined
    }
  });

  fastify.register(sensible);
  fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute"
  });
  if (process.env.NODE_ENV !== "test") {
    fastify.register(rawBody, {
      field: "rawBody",
      global: false,
      encoding: false,
      runFirst: true
    });
  }
  fastify.register(cookie);
  fastify.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true
  });
  fastify.register(multipart, {
    limits: {
      fileSize: MAX_ATTACHMENT_BYTES,
      files: 5
    }
  });

  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: getSessionCookieName(), signed: false },
    sign: {
      expiresIn: "7d"
    }
  });
  fastify.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: "/uploads/",
    decorateReply: false
  });

  fastify.addHook("onRequest", async (request) => {
    (request as any).startTime = Date.now();
  });

  if (hasDemoEmails()) {
    const demoWriteAllow = new Set<string>(["/auth/logout"]);

    fastify.addHook("onRequest", async (request, reply) => {
      // Block any mutating verbs for demo sessions before handlers run.
      const method = request.method.toUpperCase();
      if (method === "GET" || method === "OPTIONS" || method === "HEAD") {
        return;
      }

      try {
        await request.jwtVerify();
      } catch {
        return;
      }

      if (isDemoEmail(request.user?.email)) {
        const routePath = request.routerPath ?? request.raw.url ?? "";
        // Allow demo sessions to call logout so they can exit gracefully.
        if (demoWriteAllow.has(routePath)) {
          return;
        }

        return reply.status(403).send({
          error: true,
          message:
            "Demo accounts are read-only. Self-host IncidentPulse to explore write actions."
        });
      }
    });
  }

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      request.log.warn({ err: error }, "Authentication failed");
      return reply.status(401).send({
        error: true,
        message: "Unauthorized"
      });
    }

    // Block access for suspended or deleted orgs (non-super-admins).
    try {
      if (request.user?.orgId && !request.user?.isSuperAdmin) {
        const { prisma } = await import("./lib/db");
        const org = (await prisma.organization.findUnique({
          where: { id: request.user.orgId }
        })) as any;
        if (org && (org.isDeleted || org.status === "suspended")) {
          return reply.status(403).send({
            error: true,
            message: "Organization is suspended"
          });
        }
        // Block writes for overdue billing.
        const method = request.method.toUpperCase();
        const routePath = (request.routerPath ?? request.raw.url ?? "").toString();
        const isMutating = method !== "GET" && method !== "OPTIONS" && method !== "HEAD";
        const isBillingRoute = routePath.includes("/billing");
        if (org && org.billingStatus && org.billingStatus !== "active" && isMutating && !isBillingRoute) {
          return reply.status(402).send({
            error: true,
            message: "Billing issue detected. Please update payment to continue."
          });
        }
        const rateLimitResult = await enforceOrgRateLimit(request, reply);
        if (rateLimitResult) {
          return rateLimitResult;
        }
      }
    } catch (err) {
      request.log.warn({ err }, "Org status check failed");
    }
  });

  fastify.decorate("authorize", (roles: Array<"admin" | "operator" | "viewer">) => {
    return async (request, reply) => {
      if (!roles.includes(request.user.role)) {
        request.log.warn(
          { userId: request.user.id, role: request.user.role, required: roles },
          "Authorization failure"
        );
        return reply.status(403).send({
          error: true,
          message: "Forbidden"
        });
      }
    };
  });

  fastify.decorate("requireSuperAdmin", async (request, reply) => {
    if (!request.user?.isSuperAdmin) {
      request.log.warn({ userId: request.user?.id }, "Super admin required");
      return reply.status(403).send({
        error: true,
        message: "Forbidden"
      });
    }
  });

  fastify.get("/health", async (_request, reply) => {
    const dbHealthy = await databaseHealthCheck();
    return reply.send({
      api: "ok",
      db: dbHealthy,
      uptimeSeconds: process.uptime()
    });
  });

  fastify.register(authRoutes, { prefix: "/auth" });
  fastify.register(incidentsRoutes, { prefix: "/incidents" });
  fastify.register(publicRoutes, { prefix: "/public" });
  fastify.register(metricsRoutes, { prefix: "/metrics" });
  fastify.register(teamRoutes, { prefix: "/team" });
  fastify.register(servicesRoutes, { prefix: "/services" });
  fastify.register(integrationsRoutes, { prefix: "/integrations" });
  fastify.register(apiKeysRoutes, { prefix: "/api-keys" });
  fastify.register(billingRoutes, { prefix: "/billing" });
  fastify.register(webhooksRoutes, { prefix: "/webhooks" });
  fastify.register(maintenanceRoutes, { prefix: "/maintenance" });
  fastify.register(auditRoutes, { prefix: "/audit" });
  fastify.register(organizationsRoutes, { prefix: "/organizations" });
  fastify.register(supportRoutes, { prefix: "/support" });
  fastify.register(logsRoutes, { prefix: "/logs" });
  fastify.register(platformRoutes, { prefix: "/platform" });

  fastify.addHook("onResponse", async (request, reply) => {
    const route = request.routerPath || request.raw.url || "unknown";
    const durationMs =
      typeof reply.getResponseTime === "function" ? reply.getResponseTime() : Date.now() - (request as any).startTime || 0;
    const orgId = (request as any).user?.orgId ?? undefined;
    recordTraffic(route, reply.statusCode, durationMs, orgId);
    void persistTraffic(route, reply.statusCode, durationMs, orgId);

    // Lightweight public visit logging for anonymous GETs
    if (request.method === "GET" && !request.user && route.startsWith("/")) {
      // Avoid logging API routes; keep to public pages/status/docs
      const skip = route.startsWith("/api") || route.startsWith("/metrics") || route.startsWith("/auth");
      if (!skip) {
        const ua = request.headers["user-agent"];
        const forwarded = request.headers["x-forwarded-for"];
        const clientIp =
          typeof forwarded === "string" && forwarded.length > 0
            ? forwarded.split(",")[0].trim()
            : Array.isArray(forwarded) && forwarded.length > 0
            ? forwarded[0]
            : request.ip;
        recordPublicVisit(route, clientIp, typeof ua === "string" ? ua : undefined);
      }
    }
  });

  registerIncidentEscalationWatcher(fastify);

  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const message =
      statusCode === 500
        ? "Unexpected error. Please try again."
        : error.message || "Request failed";

    reply.status(statusCode).send({
      error: true,
      message
    });
  });

  return fastify;
}
