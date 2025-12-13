import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { auditLogQuerySchema } from "../lib/validation";
import { onAuditLogCreated } from "../lib/audit";
import { getRequestOrgId } from "../lib/org";

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/logs",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const parsedQuery = auditLogQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: true,
          message: parsedQuery.error.flatten().formErrors.join(", ") || "Invalid filters"
        });
      }

      const { action, search, targetType, page, pageSize } = parsedQuery.data;
      const filters: Prisma.AuditLogWhereInput[] = [];

      if (action) {
        filters.push({ action });
      }
      if (targetType) {
        filters.push({ targetType });
      }
      if (search) {
        filters.push({
          OR: [
            { actorEmail: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { actorName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { targetId: { contains: search, mode: Prisma.QueryMode.insensitive } }
          ]
        });
      }

      const where: Prisma.AuditLogWhereInput =
        filters.length > 0
          ? { AND: [{ organizationId: orgId }, ...filters] }
          : { organizationId: orgId };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.auditLog.count({ where })
      ]);

      return reply.send({
        error: false,
        data: logs,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    }
  );

  fastify.get(
    "/logs/stream",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      if (typeof reply.raw.flushHeaders === "function") {
        reply.raw.flushHeaders();
      }
      reply.hijack();

      const sendHeartbeat = setInterval(() => {
        reply.raw.write(": heartbeat\n\n");
      }, 15000);

      const detach = onAuditLogCreated((log) => {
        if (log.organizationId !== orgId) {
          return;
        }
        reply.raw.write(`event: audit\n`);
        reply.raw.write(`data: ${JSON.stringify(log)}\n\n`);
      });

      const closeStream = () => {
        clearInterval(sendHeartbeat);
        detach();
        reply.raw.end();
      };

      request.raw.on("close", closeStream);
      request.raw.on("aborted", closeStream);
    }
  );
};

export default auditRoutes;
