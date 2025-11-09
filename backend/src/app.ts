import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rawBody from "fastify-raw-body";
import fastifyJwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
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
import webhooksRoutes from "./routes/webhooks";
import servicesRoutes from "./routes/services";
import maintenanceRoutes from "./routes/maintenance";
import {
  ensureUploadsRootSync,
  MAX_ATTACHMENT_BYTES,
  uploadsRoot
} from "./lib/storage";

export function buildApp() {
  ensureUploadsRootSync();

  const fastify = Fastify({
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
  fastify.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true
  });
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
  fastify.register(webhooksRoutes, { prefix: "/webhooks" });
  fastify.register(maintenanceRoutes, { prefix: "/maintenance" });

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
