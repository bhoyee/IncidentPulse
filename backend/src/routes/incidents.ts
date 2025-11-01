import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  createIncidentSchema,
  incidentQuerySchema,
  incidentUpdateLogSchema,
  updateIncidentSchema
} from "../lib/validation";

const incidentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parseQuery = incidentQuerySchema.safeParse(request.query);
      if (!parseQuery.success) {
        return reply.status(400).send({
          error: true,
          message: parseQuery.error.flatten().formErrors.join(", ") || "Invalid query parameters"
        });
      }

      const { page, pageSize, status, severity, search, teamRole, assignedTo } = parseQuery.data;

      const filters: Prisma.IncidentWhereInput[] = [];

      if (status) {
        filters.push({ status });
      }

      if (severity) {
        filters.push({ severity });
      }

      if (search) {
        filters.push({
          OR: [
            {
              title: {
                contains: search,
                mode: Prisma.QueryMode.insensitive
              }
            },
            {
              description: {
                contains: search,
                mode: Prisma.QueryMode.insensitive
              }
            }
          ]
        });
      }

      if (teamRole) {
        filters.push({
          OR: [
            {
              assignedTo: {
                teamRoles: {
                  has: teamRole
                }
              }
            },
            {
              createdBy: {
                teamRoles: {
                  has: teamRole
                }
              }
            }
          ]
        });
      }

      if (assignedTo) {
        filters.push({ assignedToId: assignedTo });
      }

      if (request.user.role === "operator") {
        filters.push({
          OR: [{ createdById: request.user.id }, { assignedToId: request.user.id }]
        });
      }

      const where: Prisma.IncidentWhereInput =
        filters.length > 0 ? { AND: filters } : {};

      const [incidents, total] = await Promise.all([
        prisma.incident.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                teamRoles: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                teamRoles: true
              }
            }
          }
        }),
        prisma.incident.count({ where })
      ]);

      return reply.send({
        error: false,
        data: incidents,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    }
  );

  fastify.post(
    "/",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin", "operator"])] },
    async (request, reply) => {
      const parsedBody = createIncidentSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid incident payload"
        });
      }

      const { assignedToId, categories, impactScope, ...incidentPayload } = parsedBody.data;

      let resolvedAssignedToId: string | null = null;
      if (request.user.role === "admin") {
        resolvedAssignedToId = assignedToId ?? null;
      } else {
        resolvedAssignedToId = request.user.id;
      }

      if (resolvedAssignedToId) {
        const assignee = await prisma.user.findFirst({
          where: { id: resolvedAssignedToId, isActive: true }
        });

        if (!assignee) {
          return reply.status(400).send({
            error: true,
            message: "Assignee not found or inactive"
          });
        }
      }

      const incident = await prisma.incident.create({
        data: {
          ...incidentPayload,
          ...(categories ? { categories } : {}),
          ...(impactScope ? { impactScope } : {}),
          assignedToId: resolvedAssignedToId ?? undefined,
          createdById: request.user.id
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              teamRoles: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              teamRoles: true
            }
          }
        }
      });

      return reply.status(201).send({
        error: false,
        data: incident
      });
    }
  );

  fastify.get(
    "/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const id = request.params as { id: string };

      const incident = await prisma.incident.findUnique({
        where: { id: id.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              teamRoles: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              teamRoles: true
            }
          },
          updates: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!incident) {
        return reply.status(404).send({
          error: true,
          message: "Incident not found"
        });
      }

      if (
        request.user.role === "operator" &&
        incident.createdById !== request.user.id &&
        incident.assignedToId !== request.user.id
      ) {
        return reply.status(403).send({
          error: true,
          message: "Forbidden"
        });
      }

      return reply.send({
        error: false,
        data: incident
      });
    }
  );

  fastify.patch(
    "/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin", "operator"])] },
    async (request, reply) => {
      const id = request.params as { id: string };
      const parsedBody = updateIncidentSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid update payload"
        });
      }

      const existing = await prisma.incident.findUnique({
        where: { id: id.id },
        select: {
          id: true,
          resolvedAt: true,
          createdById: true,
          assignedToId: true
        }
      });

      if (!existing) {
        return reply.status(404).send({
          error: true,
          message: "Incident not found"
        });
      }

      if (
        request.user.role === "operator" &&
        existing.createdById !== request.user.id &&
        existing.assignedToId !== request.user.id
      ) {
        return reply.status(403).send({
          error: true,
          message: "Forbidden"
        });
      }

      const { assignedToId, categories, impactScope, ...updatePayload } = parsedBody.data;

      let resolvedAssignedToId: string | null | undefined = undefined;

      if (request.user.role === "admin") {
        if (parsedBody.data.hasOwnProperty("assignedToId")) {
          resolvedAssignedToId = assignedToId ?? null;

          if (resolvedAssignedToId) {
            const assignee = await prisma.user.findFirst({
              where: { id: resolvedAssignedToId, isActive: true }
            });

            if (!assignee) {
              return reply.status(400).send({
                error: true,
                message: "Assignee not found or inactive"
              });
            }
          }
        }
      }

      const now = new Date();
      const shouldSetResolvedAt =
        parsedBody.data.status === "resolved" && existing.resolvedAt === null;

      const incident = await prisma.incident.update({
        where: { id: id.id },
        data: {
          ...updatePayload,
          ...(parsedBody.data.categories === undefined ? {} : { categories: categories ?? [] }),
          ...(parsedBody.data.impactScope === undefined
            ? {}
            : { impactScope: impactScope ?? null }),
          ...(parsedBody.data.hasOwnProperty("assignedToId")
            ? { assignedToId: resolvedAssignedToId ?? null }
            : {}),
          ...(shouldSetResolvedAt ? { resolvedAt: now } : {})
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              teamRoles: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              teamRoles: true
            }
          }
        }
      });

      return reply.send({
        error: false,
        data: incident
      });
    }
  );

  fastify.post(
    "/:id/update-log",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin", "operator"])] },
    async (request, reply) => {
      const id = request.params as { id: string };
      const parsedBody = incidentUpdateLogSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid update message"
        });
      }

      const incident = await prisma.incident.findUnique({
        where: { id: id.id },
        select: {
          id: true,
          firstResponseAt: true,
          status: true,
          createdById: true,
          assignedToId: true
        }
      });

      if (!incident) {
        return reply.status(404).send({
          error: true,
          message: "Incident not found"
        });
      }

      if (
        request.user.role === "operator" &&
        incident.createdById !== request.user.id &&
        incident.assignedToId !== request.user.id
      ) {
        return reply.status(403).send({
          error: true,
          message: "Forbidden"
        });
      }

      const now = new Date();

      const [update] = await prisma.$transaction([
        prisma.incidentUpdate.create({
          data: {
            incidentId: id.id,
            authorId: request.user.id,
            message: parsedBody.data.message
          }
        }),
        prisma.incident.update({
          where: { id: id.id },
          data: incident.firstResponseAt
            ? {}
            : {
                firstResponseAt: now
              }
        })
      ]);

      return reply.status(201).send({
        error: false,
        data: update
      });
    }
  );
};

export default incidentsRoutes;
