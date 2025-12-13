import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_SERVICE_SLUG,
  ensureUniqueSlug,
  getDefaultService
} from "../lib/services";
import { getRequestOrgId } from "../lib/org";
import { getPlanLimits } from "../lib/org-limits";
import { prisma } from "../lib/db";

const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-_]+$/i).optional()
});

const updateServiceSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    slug: z.string().min(2).max(120).regex(/^[a-z0-9-_]+$/i).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

const servicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const [services, activeCounts] = await Promise.all([
        prisma.service.findMany({
          where: { organizationId: orgId },
          orderBy: { name: "asc" }
        }),
        prisma.incident.groupBy({
          by: ["serviceId"],
          where: {
            organizationId: orgId,
            status: {
              not: "resolved"
            }
          },
          _count: { _all: true }
        })
      ]);

      const countMap = new Map<string, number>(
        activeCounts.map((entry) => [entry.serviceId, entry._count._all])
      );

      return reply.send({
        error: false,
        data: services.map((service) => ({
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: service.description,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
          activeIncidentCount: countMap.get(service.id) ?? 0
        }))
      });
    }
  );

  fastify.post(
    "/",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const parsed = createServiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid service payload"
        });
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true }
      });

      const plan = org?.plan ?? "free";
      const limits = getPlanLimits(plan);
      if (limits.maxServices !== undefined) {
        const currentCount = await prisma.service.count({ where: { organizationId: orgId } });
        if (currentCount >= limits.maxServices) {
          return reply.status(402).send({
            error: true,
            message: `Service limit reached for ${plan} plan. Please upgrade to add more services.`
          });
        }
      }

      const { name, description, slug } = parsed.data;
      const finalSlug = await ensureUniqueSlug(slug ?? name);

      const service = await prisma.service.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          description: description?.trim() ?? null,
          organizationId: orgId
        }
      });

      return reply.status(201).send({
        error: false,
        data: service
      });
    }
  );

  fastify.patch(
    "/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };
      const parsed = updateServiceSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid service payload"
        });
      }

      const existing = await prisma.service.findUnique({
        where: { id: params.id }
      });

      if (!existing) {
        return reply.status(404).send({
          error: true,
          message: "Service not found"
        });
      }

      const updates: Record<string, unknown> = {};

      if (parsed.data.name !== undefined) {
        updates.name = parsed.data.name.trim();
      }

      if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() ?? null;
      }

      if (parsed.data.slug !== undefined || parsed.data.name !== undefined) {
        const desiredSlug = parsed.data.slug ?? parsed.data.name ?? existing.slug;
        const nextSlug = await ensureUniqueSlug(desiredSlug, {
          ignoreServiceId: existing.id
        });
        updates.slug = nextSlug;
      }

      const service = await prisma.service.update({
        where: { id: params.id },
        data: updates
      });

      return reply.send({
        error: false,
        data: service
      });
    }
  );

  fastify.delete(
    "/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };

      const service = await prisma.service.findUnique({
        where: { id: params.id }
      });

      if (!service) {
        return reply.status(404).send({
          error: true,
          message: "Service not found"
        });
      }

      if (service.slug === DEFAULT_SERVICE_SLUG) {
        return reply.status(400).send({
          error: true,
          message: "Default service cannot be deleted"
        });
      }

      try {
        await prisma.service.delete({
          where: { id: params.id }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
          return reply.status(409).send({
            error: true,
            message: "Service is still referenced by incidents"
          });
        }
        throw error;
      }

      return reply.status(204).send();
    }
  );

  // Ensure default service exists at startup
  fastify.addHook("onReady", async () => {
    await getDefaultService();
  });
};

export default servicesRoutes;
