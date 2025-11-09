import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  createIncidentSchema,
  incidentQuerySchema,
  incidentUpdateLogSchema,
  updateIncidentSchema
} from "../lib/validation";
import {
  incidentNotificationInclude,
  loadActiveAdmins,
  notifyAdminsOfIncident,
  notifyAssigneeOfAssignment,
  notifyAssigneeOfResolution,
  notifyIncidentIntegrations
} from "../lib/incident-notifier";
import {
  buildAttachmentUrl,
  persistIncidentAttachment,
  removeAttachmentFile,
  removeIncidentUploads
} from "../lib/storage";
import { recordAuditLog } from "../lib/audit";

const MAX_ATTACHMENTS_PER_UPDATE = 5;

const attachmentInclude = {
  uploadedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.IncidentAttachmentInclude;

type AttachmentWithUser = Prisma.IncidentAttachmentGetPayload<{
  include: typeof attachmentInclude;
}>;

function serializeAttachment(attachment: AttachmentWithUser) {
  return {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
    updateId: attachment.updateId,
    url: buildAttachmentUrl(attachment.path),
    uploadedBy: attachment.uploadedBy
  };
}

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

      const {
        page,
        pageSize,
        status,
        severity,
        search,
        teamRole,
        assignedTo,
        serviceId
      } = parseQuery.data;

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

      if (serviceId) {
        filters.push({ serviceId });
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
            },
            service: {
              select: {
                id: true,
                name: true,
                slug: true
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

      const admins = await loadActiveAdmins();

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

      const service = await prisma.service.findUnique({
        where: { id: incidentPayload.serviceId }
      });

      if (!service) {
        return reply.status(400).send({
          error: true,
          message: "Service not found"
        });
      }

      const incident = await prisma.incident.create({
        data: {
          ...incidentPayload,
          ...(categories ? { categories } : {}),
          ...(impactScope ? { impactScope } : {}),
          assignedToId: resolvedAssignedToId ?? undefined,
          createdById: request.user.id
        },
        include: incidentNotificationInclude
      });

      if (incident.assignedTo) {
        const assignedBy =
          request.user.name ?? request.user.email ?? "Administrator";
        await notifyAssigneeOfAssignment(fastify.log, incident, assignedBy);
        await notifyIncidentIntegrations(fastify.log, incident, "assigned", { assignedBy });
      }

      await notifyAdminsOfIncident(fastify.log, incident, admins);
      await notifyIncidentIntegrations(fastify.log, incident, "created");
      await recordAuditLog({
        action: "incident_created",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        targetType: "incident",
        targetId: incident.id,
        metadata: {
          severity: incident.severity,
          status: incident.status,
          serviceId: incident.serviceId
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
          attachments: {
            orderBy: { createdAt: "desc" },
            include: attachmentInclude
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true
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
              },
              attachments: {
                orderBy: { createdAt: "asc" },
                include: attachmentInclude
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

      const responsePayload = {
        ...incident,
        attachments: incident.attachments.map(serializeAttachment),
        updates: incident.updates.map((update) => ({
          ...update,
          attachments: update.attachments.map(serializeAttachment)
        }))
      };

      return reply.send({
        error: false,
        data: responsePayload
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

      const {
        assignedToId,
        categories,
        impactScope,
        serviceId: incomingServiceId,
        rootCause,
        resolutionSummary,
        ...updatePayload
      } = parsedBody.data;

      const trimmedRootCause =
        rootCause === undefined ? undefined : rootCause.trim();
      const trimmedResolutionSummary =
        resolutionSummary === undefined ? undefined : resolutionSummary.trim();

      if (
        trimmedRootCause !== undefined &&
        trimmedRootCause.length === 0
      ) {
        return reply.status(400).send({
          error: true,
          message: "Root cause cannot be empty"
        });
      }

      if (
        trimmedResolutionSummary !== undefined &&
        trimmedResolutionSummary.length === 0
      ) {
        return reply.status(400).send({
          error: true,
          message: "Resolution summary cannot be empty"
        });
      }

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

      const hasServiceKey = Object.prototype.hasOwnProperty.call(parsedBody.data, "serviceId");
      if (hasServiceKey && request.user.role !== "admin") {
        return reply.status(403).send({
          error: true,
          message: "Only admins can change service ownership"
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

      let nextServiceId: string | undefined;
      if (hasServiceKey) {
        if (!incomingServiceId) {
          return reply.status(400).send({
            error: true,
            message: "Service is required"
          });
        }

        const service = await prisma.service.findUnique({
          where: { id: incomingServiceId },
          select: { id: true }
        });

        if (!service) {
          return reply.status(400).send({
            error: true,
            message: "Service not found"
          });
        }

        nextServiceId = service.id;
      }

      const now = new Date();
      const statusChangedToResolved =
        parsedBody.data.status === "resolved" && existing.status !== "resolved";

      if (statusChangedToResolved) {
        if (!trimmedRootCause || !trimmedResolutionSummary) {
          return reply.status(400).send({
            error: true,
            message: "Root cause and resolution summary are required when resolving an incident"
          });
        }
      }

      const shouldSetResolvedAt = statusChangedToResolved && existing.resolvedAt === null;
      const assignmentChanged =
        request.user.role === "admin" &&
        hasAssignedToKey &&
        resolvedAssignedToId !== undefined &&
        resolvedAssignedToId !== existing.assignedToId &&
        resolvedAssignedToId !== null;

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
          ...(hasServiceKey && nextServiceId ? { serviceId: nextServiceId } : {}),
          ...(shouldSetResolvedAt ? { resolvedAt: now } : {}),
          ...(trimmedRootCause !== undefined ? { rootCause: trimmedRootCause } : {}),
          ...(trimmedResolutionSummary !== undefined
            ? { resolutionSummary: trimmedResolutionSummary }
            : {})
        },
        include: incidentNotificationInclude
      });

      if (statusChangedToResolved) {
        const resolutionTime = incident.resolvedAt ?? now;
        await notifyAssigneeOfResolution(fastify.log, incident, resolutionTime);
        await notifyIncidentIntegrations(fastify.log, incident, "resolved", { resolutionTime });
        await recordAuditLog({
          action: "incident_resolved",
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "incident",
          targetId: incident.id,
          metadata: {
            status: incident.status,
            resolvedAt: incident.resolvedAt
          }
        });
      } else if (parsedBody.data.status === "investigating") {
        await recordAuditLog({
          action: "incident_investigating",
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "incident",
          targetId: incident.id,
          metadata: { status: incident.status }
        });
      } else if (parsedBody.data.status === "monitoring") {
        await recordAuditLog({
          action: "incident_monitoring",
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "incident",
          targetId: incident.id,
          metadata: { status: incident.status }
        });
      }

      if (assignmentChanged) {
        const assignedBy =
          request.user.name ?? request.user.email ?? "Administrator";
        await notifyAssigneeOfAssignment(fastify.log, incident, assignedBy);
        await notifyIncidentIntegrations(fastify.log, incident, "assigned", { assignedBy });
      }

      await recordAuditLog({
        action: "incident_updated",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        targetType: "incident",
        targetId: incident.id,
        metadata: {
          status: incident.status,
          severity: incident.severity
        }
      });

      return reply.send({
        error: false,
        data: incident
      });
    }
  );

  fastify.post(
    "/:id/attachments",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin", "operator"])] },
    async (request, reply) => {
      const params = request.params as { id: string };
      const incident = await prisma.incident.findUnique({
        where: { id: params.id },
        select: {
          id: true,
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

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          error: true,
          message: "Attachment file is required"
        });
      }

      let storedMeta;
      try {
        storedMeta = await persistIncidentAttachment(file, params.id);
      } catch (error) {
        request.log.warn({ err: error }, "Failed to store attachment");
        return reply.status(400).send({
          error: true,
          message:
            error instanceof Error ? error.message : "Attachment could not be processed"
        });
      }

      const attachment = await prisma.incidentAttachment.create({
        data: {
          incidentId: params.id,
          uploadedById: request.user.id,
          filename: storedMeta.originalFilename,
          mimeType: storedMeta.mimeType,
          size: storedMeta.size,
          path: storedMeta.relativePath
        },
        include: attachmentInclude
      });

      return reply.status(201).send({
        error: false,
        data: serializeAttachment(attachment)
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

       const { message, attachmentIds = [] } = parsedBody.data;

       if (attachmentIds.length > MAX_ATTACHMENTS_PER_UPDATE) {
         return reply.status(400).send({
           error: true,
           message: `You can attach up to ${MAX_ATTACHMENTS_PER_UPDATE} files per update`
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

      if (attachmentIds.length > 0) {
        const attachments = await prisma.incidentAttachment.findMany({
          where: {
            id: { in: attachmentIds },
            incidentId: id.id,
            updateId: null,
            uploadedById: request.user.id
          },
          select: { id: true }
        });

        if (attachments.length !== attachmentIds.length) {
          return reply.status(400).send({
            error: true,
            message: "One or more attachments are invalid or already linked"
          });
        }
      }

      const now = new Date();

      const update = await prisma.$transaction(async (tx) => {
        const updateRecord = await tx.incidentUpdate.create({
          data: {
            incidentId: id.id,
            authorId: request.user.id,
            message
          }
        });

        if (!incident.firstResponseAt) {
          await tx.incident.update({
            where: { id: id.id },
            data: {
              firstResponseAt: now
            }
          });
        }

        if (attachmentIds.length > 0) {
          await tx.incidentAttachment.updateMany({
            where: {
              id: { in: attachmentIds }
            },
            data: {
              updateId: updateRecord.id
            }
          });
        }

        return updateRecord;
      });

      return reply.status(201).send({
        error: false,
        data: update
      });
    }
  );

  fastify.delete(
    "/:incidentId/attachments/:attachmentId",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin", "operator"])] },
    async (request, reply) => {
      const params = request.params as { incidentId: string; attachmentId: string };

      const attachment = await prisma.incidentAttachment.findUnique({
        where: { id: params.attachmentId },
        select: {
          id: true,
          incidentId: true,
          uploadedById: true,
          updateId: true,
          path: true
        }
      });

      if (!attachment || attachment.incidentId !== params.incidentId) {
        return reply.status(404).send({
          error: true,
          message: "Attachment not found"
        });
      }

      if (attachment.updateId) {
        return reply.status(400).send({
          error: true,
          message: "Attachment is already linked to an update"
        });
      }

      if (request.user.role !== "admin" && attachment.uploadedById !== request.user.id) {
        return reply.status(403).send({
          error: true,
          message: "You can only remove attachments you uploaded"
        });
      }

      await prisma.incidentAttachment.delete({
        where: { id: params.attachmentId }
      });
      await removeAttachmentFile(attachment.path);

      return reply.status(204).send();
    }
  );

  fastify.delete(
    "/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };

      const existing = await prisma.incident.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          severity: true,
          status: true,
          serviceId: true
        }
      });

      if (!existing) {
        return reply.status(404).send({
          error: true,
          message: "Incident not found"
        });
      }

      try {
        await prisma.incident.delete({
          where: { id: params.id }
        });
        await removeIncidentUploads(params.id);
      } catch (error) {
        throw error;
      }

      await recordAuditLog({
        action: "incident_deleted",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        targetType: "incident",
        targetId: existing.id,
        metadata: {
          severity: existing.severity,
          status: existing.status
        }
      });

      return reply.status(204).send();
    }
  );
};

export default incidentsRoutes;
