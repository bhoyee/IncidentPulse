import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  createMaintenanceSchema,
  maintenanceQuerySchema,
  updateMaintenanceSchema
} from "../lib/validation";
import {
  maintenanceEventInclude,
  serializeMaintenanceEvent,
  transitionMaintenanceEvents
} from "../lib/maintenance";

const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const parsedQuery = maintenanceQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: true,
          message: parsedQuery.error.flatten().formErrors.join(", ") || "Invalid filters"
        });
      }

      await transitionMaintenanceEvents(prisma);

      const { status, window = "upcoming", serviceId } = parsedQuery.data;
      const now = new Date();

      const filters: Prisma.MaintenanceEventWhereInput = {};
      if (status) {
        filters.status = status;
      }

      if (serviceId) {
        filters.OR = [{ appliesToAll: true }, { serviceId }];
      }

      if (window === "upcoming") {
        filters.status =
          filters.status ??
          {
            in: ["scheduled", "in_progress"]
          };
        filters.endsAt = { gte: now };
      } else if (window === "past") {
        filters.endsAt = { lt: now };
      }

      const events = await prisma.maintenanceEvent.findMany({
        where: filters,
        orderBy: [
          { startsAt: "asc" },
          { createdAt: "desc" }
        ],
        include: maintenanceEventInclude
      });

      return reply.send({
        error: false,
        data: events.map(serializeMaintenanceEvent)
      });
    }
  );

  fastify.post(
    "/",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const parsedBody = createMaintenanceSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid maintenance payload"
        });
      }

      const payload = parsedBody.data;
      const event = await prisma.maintenanceEvent.create({
        data: {
          title: payload.title,
          description: payload.description ?? null,
          startsAt: new Date(payload.startsAt),
          endsAt: new Date(payload.endsAt),
          appliesToAll: payload.appliesToAll ?? true,
          serviceId: payload.appliesToAll === false ? payload.serviceId ?? null : null,
          createdById: request.user.id
        },
        include: maintenanceEventInclude
      });

      await transitionMaintenanceEvents(prisma);

      return reply.status(201).send({
        error: false,
        data: serializeMaintenanceEvent(event)
      });
    }
  );

  fastify.patch(
    "/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };
      const parsedBody = updateMaintenanceSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid maintenance payload"
        });
      }

      const payload = parsedBody.data;
      const event = await prisma.maintenanceEvent.update({
        where: { id: params.id },
        data: {
          ...(payload.title === undefined ? {} : { title: payload.title }),
          ...(payload.description === undefined ? {} : { description: payload.description ?? null }),
          ...(payload.startsAt === undefined ? {} : { startsAt: new Date(payload.startsAt) }),
          ...(payload.endsAt === undefined ? {} : { endsAt: new Date(payload.endsAt) }),
          ...(payload.appliesToAll === undefined
            ? {}
            : {
                appliesToAll: payload.appliesToAll,
                serviceId:
                  payload.appliesToAll === false ? payload.serviceId ?? null : null
              }),
          ...(payload.serviceId !== undefined && (payload.appliesToAll ?? false) === false
            ? { serviceId: payload.serviceId ?? null }
            : {})
        },
        include: maintenanceEventInclude
      });

      await transitionMaintenanceEvents(prisma);

      return reply.send({
        error: false,
        data: serializeMaintenanceEvent(event)
      });
    }
  );

  fastify.post(
    "/:id/cancel",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };
      const existing = await prisma.maintenanceEvent.findUnique({
        where: { id: params.id },
        include: maintenanceEventInclude
      });

      if (!existing) {
        return reply.status(404).send({
          error: true,
          message: "Maintenance event not found"
        });
      }

      if (existing.status === "completed" || existing.status === "canceled") {
        return reply.status(400).send({
          error: true,
          message: `Event already ${existing.status}`
        });
      }

      const updated = await prisma.maintenanceEvent.update({
        where: { id: params.id },
        data: {
          status: "canceled"
        },
        include: maintenanceEventInclude
      });

      return reply.send({
        error: false,
        data: serializeMaintenanceEvent(updated)
      });
    }
  );
};

export default maintenanceRoutes;
