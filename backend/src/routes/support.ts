import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import {
  persistSupportAttachment,
  persistSupportAttachmentBuffer,
  buildAttachmentUrl
} from "../lib/storage";
import { notifySupportTicketCreated, notifySupportComment } from "../lib/support-notifier";
import { env } from "../env";

type TicketPayload = {
  subject: string;
  body: string;
  priority?: "low" | "medium" | "high" | "urgent";
  category?: string;
};

const supportRoutes: FastifyPluginAsync = async (fastify) => {
  // Authentication for support routes; inbound webhook bypasses JWT if secret is valid.
  fastify.addHook("preHandler", async (request, reply) => {
    const path = request.routerPath || request.raw.url || "";
    if (path.startsWith("/support/inbound")) {
      return;
    }
    return fastify.authenticate(request, reply);
  });

  fastify.post(
    "/inbound",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
    },
    async (request, reply) => {
      const payload = (request.body as any) || {};
      const secret = payload.secret || request.headers["x-support-secret"];
      if (env.SUPPORT_INBOUND_SECRET && secret !== env.SUPPORT_INBOUND_SECRET) {
        throw fastify.httpErrors.unauthorized("Invalid inbound secret");
      }
      const from: string | undefined = payload.from;
      const to: string | undefined = Array.isArray(payload.to) ? payload.to[0] : payload.to;
      const subject: string | undefined = payload.subject;
      const text: string | undefined = payload.text || payload.html;
      const inboundAttachments: Array<{
        filename?: string;
        content?: string;
        contentType?: string;
      }> = Array.isArray(payload.attachments) ? payload.attachments : [];

      if (!from || !subject) {
        throw fastify.httpErrors.badRequest("Missing from/subject");
      }

      const ticketId =
        extractTicketIdFromAddress(to) ||
        extractTicketIdFromSubject(subject);
      if (!ticketId) {
        throw fastify.httpErrors.badRequest("Ticket token not found");
      }

      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, organizationId: true }
      });
      if (!ticket) {
        throw fastify.httpErrors.notFound("Ticket not found");
      }

      const senderEmail = from.toLowerCase();
      const user = await prisma.user.findFirst({
        where: { email: senderEmail },
        select: { id: true, email: true, isActive: true, memberships: true }
      });
      if (!user || !user.isActive) {
        throw fastify.httpErrors.forbidden("Sender not recognized");
      }
      const member = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId: ticket.organizationId }
      });
      if (!member) {
        throw fastify.httpErrors.forbidden("Sender not in org");
      }

      const body = (text || "").trim();
      if (!body && inboundAttachments.length === 0) {
        throw fastify.httpErrors.badRequest("Empty message");
      }

      const comment = await prisma.supportComment.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          body: body || "(attachment)"
        }
      });

      const savedAttachments = [];
      for (const att of inboundAttachments) {
        if (!att?.content) continue;
        try {
          const buffer = Buffer.from(att.content, "base64");
          const stored = await persistSupportAttachmentBuffer(buffer, ticket.id, {
            filename: att.filename,
            mimeType: att.contentType
          });
          const record = await prisma.supportAttachment.create({
            data: {
              ticketId: ticket.id,
              uploadedById: user.id,
              filename: stored.originalFilename,
              mimeType: stored.mimeType,
              size: stored.size,
              path: stored.relativePath
            }
          });
          savedAttachments.push(record);
        } catch (err) {
          request.log.warn({ err }, "Failed to persist inbound attachment");
        }
      }

      notifySupportComment(ticket.id, user.email).catch((err) =>
        request.log.warn({ err }, "Failed to send support inbound notification")
      );

      return reply.send({
        error: false,
        message: "Comment added",
        data: { commentId: comment.id, attachments: savedAttachments }
      });
    }
  );

  function extractTicketIdFromAddress(address?: string): string | null {
    if (!address) return null;
    const match = address.match(/\+([a-z0-9-]+)@/i);
    return match?.[1] ?? null;
  }

  function extractTicketIdFromSubject(subj?: string): string | null {
    if (!subj) return null;
    const match = subj.match(/\[Support\s+#?([a-z0-9-]+)\]/i);
    return match?.[1] ?? null;
  }

  fastify.get(
    "/",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" }
      }
    },
    async (request) => {
      if (!request.user.orgId) {
        throw fastify.httpErrors.badRequest("Missing org context");
      }
      const { status, priority, q, page = "1", pageSize = "10" } = request.query as {
        status?: string;
        priority?: string;
        q?: string;
        page?: string;
        pageSize?: string;
      };

      const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
      const sizeNum = Math.min(50, Math.max(1, parseInt(pageSize || "10", 10) || 10));

      const whereClause: any = {
        organizationId: request.user.orgId,
        status: (status as any) || undefined,
        priority: (priority as any) || undefined
      };

      if (q?.trim()) {
        whereClause.OR = [
          { subject: { contains: q.trim(), mode: "insensitive" } },
          { body: { contains: q.trim(), mode: "insensitive" } }
        ];
      }

      const [total, tickets] = await Promise.all([
        prisma.supportTicket.count({ where: whereClause }),
        prisma.supportTicket.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum,
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            assignee: { select: { id: true, name: true, email: true } },
            comments: {
              orderBy: { createdAt: "asc" },
              where: { isInternal: false },
              include: {
                author: { select: { id: true, name: true, email: true } }
              }
            },
            attachments: true
          }
        })
      ]);

      return { error: false, data: tickets, meta: { page: pageNum, pageSize: sizeNum, total } };
    }
  );

  fastify.post(
    "/",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" }
      }
    },
    async (request) => {
    if (!request.user.orgId) {
      throw fastify.httpErrors.badRequest("Missing org context");
    }
    const payload = request.body as TicketPayload;
    if (!payload?.subject || !payload?.body) {
      throw fastify.httpErrors.badRequest("Subject and body are required");
    }
    const ticket = await prisma.supportTicket.create({
      data: {
        subject: payload.subject.trim(),
        body: payload.body.trim(),
        priority: (payload.priority as any) ?? "medium",
        category: payload.category?.trim(),
        organizationId: request.user.orgId,
        createdById: request.user.id
      }
    });
    notifySupportTicketCreated(ticket.id).catch((err) =>
      request.log.warn({ err }, "Failed to send support ticket notification")
    );
    return { error: false, data: ticket };
  }
  );

  fastify.patch(
    "/:ticketId/status",
    {
      config: {
        rateLimit: { max: 20, timeWindow: "1 minute" }
      }
    },
    async (request) => {
    const { ticketId } = request.params as { ticketId: string };
    const { status } = request.body as { status: "open" | "pending" | "closed" };
    if (!request.user.orgId) {
      throw fastify.httpErrors.badRequest("Missing org context");
    }
    if (request.user.role !== "admin") {
      throw fastify.httpErrors.forbidden();
    }
    const updated = await prisma.supportTicket.updateMany({
      where: { id: ticketId, organizationId: request.user.orgId },
      data: { status }
    });
    if (!updated.count) {
      throw fastify.httpErrors.notFound("Ticket not found");
    }
    return { error: false, message: "Status updated" };
    }
  );

  fastify.post(
    "/:ticketId/comments",
    {
      config: {
        rateLimit: { max: 20, timeWindow: "1 minute" }
      }
    },
    async (request) => {
      const { ticketId } = request.params as { ticketId: string };
      const { body, isInternal } = request.body as { body: string; isInternal?: boolean };
      if (!request.user.orgId) {
        throw fastify.httpErrors.badRequest("Missing org context");
      }
      if (!body?.trim()) {
        throw fastify.httpErrors.badRequest("Comment body is required");
      }
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: ticketId, organizationId: request.user.orgId },
        select: { id: true }
      });
      if (!ticket) {
        throw fastify.httpErrors.notFound("Ticket not found");
      }
      const internalFlag = request.user.isSuperAdmin ? Boolean(isInternal) : false;
      const comment = await prisma.supportComment.create({
        data: {
          ticketId,
          authorId: request.user.id,
          body: body.trim(),
          isInternal: internalFlag
        },
        include: {
          author: { select: { id: true, name: true, email: true } }
        }
      });
      if (!internalFlag) {
        notifySupportComment(ticketId, comment.author?.email).catch((err) =>
          request.log.warn({ err }, "Failed to send support comment notification")
        );
      }
      return { error: false, data: comment };
    }
  );

  fastify.post(
    "/:ticketId/attachments",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" }
      }
    },
    async (request) => {
    const { ticketId } = request.params as { ticketId: string };
    if (!request.user.orgId) {
      throw fastify.httpErrors.badRequest("Missing org context");
    }
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId: request.user.orgId },
      select: { id: true }
    });
    if (!ticket) {
      throw fastify.httpErrors.notFound("Ticket not found");
    }
    const parts = request.parts();
    const saved = [];
    for await (const part of parts) {
      if (part.type === "file") {
        const stored = await persistSupportAttachment(part, ticketId);
        const record = await prisma.supportAttachment.create({
          data: {
            ticketId,
            uploadedById: request.user.id,
            filename: stored.originalFilename,
            mimeType: stored.mimeType,
            size: stored.size,
            path: stored.relativePath
          }
        });
        saved.push({
          ...record,
          url: buildAttachmentUrl(stored.relativePath)
        });
      }
    }
    return { error: false, data: saved };
  }
  );

  // Platform super-admin routes
  fastify.register(async (superAdminScope) => {
    superAdminScope.addHook("preHandler", superAdminScope.authenticate);
    superAdminScope.addHook("preHandler", superAdminScope.requireSuperAdmin);

    superAdminScope.get(
      "/",
      {
        config: {
          rateLimit: { max: 60, timeWindow: "1 minute" }
        }
      },
      async (request) => {
        const { status, orgId } = request.query as { status?: string; orgId?: string };
        const tickets = await prisma.supportTicket.findMany({
          where: {
            status: (status as any) || undefined,
            organizationId: orgId || undefined
          },
          orderBy: { createdAt: "desc" },
          include: {
            organization: { select: { id: true, name: true, slug: true, plan: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            assignee: { select: { id: true, name: true, email: true } },
            comments: {
              orderBy: { createdAt: "asc" },
              include: { author: { select: { id: true, name: true, email: true } } }
            },
            attachments: true
          }
        });
        return { error: false, data: tickets };
      }
    );

    superAdminScope.patch(
      "/:ticketId/status",
      {
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
      },
      async (request) => {
      const { ticketId } = request.params as { ticketId: string };
      const { status } = request.body as { status: "open" | "pending" | "closed" };
      const updated = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status }
      });
      return { error: false, data: updated };
      }
    );

    superAdminScope.patch(
      "/:ticketId",
      {
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
      },
      async (request) => {
        const { ticketId } = request.params as { ticketId: string };
        const { subject, body, priority, category } = request.body as {
          subject?: string;
          body?: string;
          priority?: "low" | "medium" | "high" | "urgent";
          category?: string | null;
        };

        const data: any = {};
        if (subject?.trim()) data.subject = subject.trim();
        if (body?.trim()) data.body = body.trim();
        if (priority) data.priority = priority as any;
        if (category !== undefined) data.category = category?.trim() || null;

        if (!Object.keys(data).length) {
          throw superAdminScope.httpErrors.badRequest("No fields to update");
        }

        const updated = await prisma.supportTicket.update({
          where: { id: ticketId },
          data
        });
        return { error: false, data: updated };
      }
    );

    superAdminScope.patch(
      "/:ticketId/assign",
      {
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
      },
      async (request) => {
        const { ticketId } = request.params as { ticketId: string };
        const { assigneeId } = request.body as { assigneeId?: string | null };
        const updated = await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { assigneeId: assigneeId ?? null }
        });
        return { error: false, data: updated };
      }
    );

    superAdminScope.delete(
      "/:ticketId",
      {
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
      },
      async (request) => {
        const { ticketId } = request.params as { ticketId: string };
        await prisma.supportTicket.delete({ where: { id: ticketId } });
        return { error: false, message: "Ticket deleted" };
      }
    );

    superAdminScope.post(
      "/:ticketId/comments",
      {
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
      },
      async (request) => {
        const { ticketId } = request.params as { ticketId: string };
        const { body, isInternal } = request.body as { body: string; isInternal?: boolean };
        if (!body?.trim()) {
          throw fastify.httpErrors.badRequest("Comment body is required");
        }
        const ticket = await prisma.supportTicket.findUnique({
          where: { id: ticketId },
          select: { id: true, organizationId: true }
        });
        if (!ticket) {
          throw fastify.httpErrors.notFound("Ticket not found");
        }
        const comment = await prisma.supportComment.create({
          data: {
            ticketId,
            authorId: request.user.id,
            body: body.trim(),
            isInternal: isInternal ?? true
          }
        });
        if (!isInternal) {
          notifySupportComment(ticketId, request.user.email).catch((err) =>
            request.log.warn({ err }, "Failed to send support comment notification")
          );
        }
        return { error: false, data: comment };
      }
    );

    superAdminScope.delete(
      "/:ticketId/comments/:commentId",
      {
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
      },
      async (request) => {
        const { ticketId, commentId } = request.params as { ticketId: string; commentId: string };
        // Ensure the comment belongs to the ticket
        const existing = await prisma.supportComment.findFirst({
          where: { id: commentId, ticketId }
        });
        if (!existing) {
          throw superAdminScope.httpErrors.notFound("Comment not found");
        }
        await prisma.supportComment.delete({ where: { id: commentId } });
        return { error: false, message: "Comment deleted" };
      }
    );
  }, { prefix: "/platform" });
};

export default supportRoutes;
