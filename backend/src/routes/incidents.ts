import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  createIncidentSchema,
  incidentQuerySchema,
  incidentUpdateLogSchema,
  updateIncidentSchema
} from "../lib/validation";
import { sendMail } from "../lib/mailer";
import { env } from "../env";

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

      const admins = await prisma.user.findMany({
        where: {
          role: "admin",
          isActive: true
        },
        select: {
          email: true,
          name: true
        }
      });

      let resolvedAssignedToId: string | null = null;
      if (request.user.role === "admin") {
        resolvedAssignedToId = assignedToId ?? null;
      } else {
        resolvedAssignedToId = null;
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

      if (admins.length === 0) {
        fastify.log.warn(
          { incidentId: incident.id },
          "Incident created but no active admins available for notification"
        );
      } else {
        const adminEmails = admins.map((admin) => admin.email);
        const reporterName =
          incident.createdBy?.name ||
          incident.createdBy?.email ||
          "Unknown reporter";
        const incidentUrl = `${env.FRONTEND_URL}/dashboard/incidents/${incident.id}`;
        const subject = `New incident reported: ${incident.title}`;
        const description = incident.description?.trim();
        const textBody = [
          `A new incident was reported and requires review.`,
          "",
          `Title: ${incident.title}`,
          `Severity: ${incident.severity}`,
          `Status: ${incident.status}`,
          `Reported by: ${reporterName}`,
          "",
          `Review the incident: ${incidentUrl}`,
          "",
          description ? `Description:\n${description}` : ""
        ]
          .filter(Boolean)
          .join("\n");

        try {
          await sendMail({
            to: adminEmails,
            subject,
            text: textBody
          });
          fastify.log.info(
            { incidentId: incident.id, recipients: adminEmails },
            "Sent admin notification for new incident"
          );
        } catch (error) {
          fastify.log.error(
            { err: error, incidentId: incident.id },
            "Failed to send admin incident notification"
          );
        }
      }

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
          status: true,
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

      const hasAssignedToKey = Object.prototype.hasOwnProperty.call(
        parsedBody.data,
        "assignedToId"
      );

      if (hasAssignedToKey && request.user.role !== "admin") {
        return reply.status(403).send({
          error: true,
          message: "Only admins can assign incidents"
        });
      }

      if (request.user.role === "admin") {
        if (hasAssignedToKey) {
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
      const statusChangedToResolved =
        parsedBody.data.status === "resolved" && existing.status !== "resolved";
      const shouldSetResolvedAt = statusChangedToResolved && existing.resolvedAt === null;

      const incident = await prisma.incident.update({
        where: { id: id.id },
        data: {
          ...updatePayload,
          ...(parsedBody.data.categories === undefined ? {} : { categories: categories ?? [] }),
          ...(parsedBody.data.impactScope === undefined
            ? {}
            : { impactScope: impactScope ?? null }),
          ...(hasAssignedToKey
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

      if (statusChangedToResolved && incident.assignedTo?.email) {
        const resolutionTime = incident.resolvedAt ?? now;
        const subject = `Incident resolved: ${incident.title}`;
        const description = incident.description?.trim();
        const textLines = [
          `Good news — the incident "${incident.title}" has been resolved.`,
          "",
          `Severity: ${incident.severity}`,
          `Status: ${incident.status}`,
          `Resolved at: ${resolutionTime.toISOString()}`,
          "",
          `Reported by: ${
            incident.createdBy?.name ?? incident.createdBy?.email ?? "Unknown reporter"
          }`
        ];

        if (description) {
          textLines.push("", `Summary:\n${description}`);
        }

        textLines.push(
          "",
          "You were listed as the owner. No further action is required unless stakeholders need a follow-up."
        );

        const textBody = textLines.join("\n");

        try {
          await sendMail({
            to: incident.assignedTo.email,
            subject,
            text: textBody
          });
          fastify.log.info(
            { incidentId: incident.id, assignee: incident.assignedTo.email },
            "Sent incident resolution notification"
          );
        } catch (error) {
          fastify.log.error(
            { err: error, incidentId: incident.id, assignee: incident.assignedTo.email },
            "Failed to send incident resolution notification"
          );
        }
      }

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

  fastify.delete(
    "/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };

      try {
        await prisma.incident.delete({
          where: { id: params.id }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return reply.status(404).send({
            error: true,
            message: "Incident not found"
          });
        }
        throw error;
      }

      return reply.status(204).send();
    }
  );
};

export default incidentsRoutes;
