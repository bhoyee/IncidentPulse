import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma, type MembershipRole } from "@prisma/client";
import { prisma } from "../lib/db";
import { requireRole, setSessionCookie, hashPassword } from "../lib/auth";
import { recordAuditLog } from "../lib/audit";
import { getRequestOrgId } from "../lib/org";
import { membershipUpdateSchema } from "../lib/validation";
import { createInvite, consumeInvite } from "../lib/invite";

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/i, "Slug can contain letters, numbers and dashes").min(2).max(64)
});

const updateOrgSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/i, "Slug can contain letters, numbers and dashes")
      .min(2)
      .max(64)
      .optional()
  })
  .refine((data) => data.name || data.slug, {
    message: "Provide a name or slug to update"
  });

const organizationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const memberships = (await prisma.membership.findMany({
        where: { userId: request.user.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              plan: true,
              billingStatus: true,
              services: { select: { id: true } },
              members: { select: { id: true } }
            } as any
          }
        },
        orderBy: { createdAt: "asc" }
      })) as any[];

      const data = memberships.map((m: any) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        membershipRole: m.role,
        plan: m.organization.plan,
        billingStatus: m.organization.billingStatus,
        servicesCount: m.organization.services.length,
        membersCount: m.organization.members.length
      }));

      return reply.send({
        error: false,
        data
      });
    }
  );

  // Creation guarded by plan/org limits
  fastify.post(
    "/",
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      requireRole(request, ["admin"]);
      const memberships = await prisma.membership.findMany({
        where: { userId: request.user.id, role: { in: ["owner", "admin"] } },
        include: { organization: { select: { plan: true } } }
      });
      const currentCount = memberships.length;
      const hasEnterprise = memberships.some((m) => m.organization.plan === "enterprise");
      const hasPro = memberships.some((m) => m.organization.plan === "pro");
      const orgLimit = hasEnterprise ? undefined : hasPro ? 5 : 1;
      if (orgLimit !== undefined && currentCount >= orgLimit) {
        return reply.status(402).send({
          error: true,
          message: `Org limit reached for your plan (${currentCount}/${orgLimit}). Upgrade to add more workspaces.`
        });
      }

      const parsed = createOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid organization payload"
        });
      }

      try {
        const organization = await prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: {
              name: parsed.data.name.trim(),
              slug: parsed.data.slug.trim().toLowerCase()
            }
          });

          await tx.membership.create({
            data: {
              id: `m-${request.user.id}-${org.id}`,
              userId: request.user.id,
              organizationId: org.id,
              role: "owner"
            }
          });

          return org;
        });

        await recordAuditLog(
          {
            action: "user_created",
            actorId: request.user.id,
            actorEmail: request.user.email,
            actorName: request.user.name,
            organizationId: organization.id,
            targetType: "organization",
            targetId: organization.id,
            metadata: {
              name: organization.name,
              slug: organization.slug
            }
          },
          prisma
        );

        return reply.status(201).send({
          error: false,
          data: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return reply.status(409).send({
            error: true,
            message: "Organization slug already exists"
          });
        }
        throw error;
      }
    }
  );

  fastify.patch(
    "/:orgId",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const params = request.params as { orgId: string };
      const parsed = updateOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid organization payload"
        });
      }

      const membership = await prisma.membership.findFirst({
        where: {
          organizationId: params.orgId,
          userId: request.user.id,
          role: { in: ["owner", "admin"] }
        },
        select: { role: true }
      });

      if (!membership) {
        return reply.status(403).send({
          error: true,
          message: "Only organization owners or admins can update this organization."
        });
      }

      const data: Prisma.OrganizationUpdateInput = {};
      if (parsed.data.name) {
        data.name = parsed.data.name.trim();
      }
      if (parsed.data.slug) {
        data.slug = parsed.data.slug.trim().toLowerCase();
      }

      try {
        const updated = await prisma.organization.update({
          where: { id: params.orgId },
          data,
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true,
            updatedAt: true
          }
        });

        await recordAuditLog({
          action: "user_updated",
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          organizationId: params.orgId,
          targetType: "organization",
          targetId: params.orgId,
          metadata: { name: updated.name, slug: updated.slug }
        });

        return reply.send({ error: false, data: updated });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return reply.status(409).send({ error: true, message: "Organization slug already exists" });
        }
        throw error;
      }
    }
  );

  fastify.delete(
    "/:orgId",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const params = request.params as { orgId: string };

      const membership = await prisma.membership.findFirst({
        where: {
          organizationId: params.orgId,
          userId: request.user.id,
          role: "owner"
        }
      });

      if (!membership) {
        return reply.status(403).send({
          error: true,
          message: "Only organization owners can delete this organization."
        });
      }

      const remainingOrgCount = await prisma.membership.count({
        where: {
          userId: request.user.id,
          organization: { isDeleted: false }
        }
      });

      if (params.orgId === getRequestOrgId(request) && remainingOrgCount <= 1) {
        return reply.status(400).send({
          error: true,
          message: "You cannot delete your last organization. Create another workspace first."
        });
      }

      await prisma.organization.update({
        where: { id: params.orgId },
        data: {
          status: "suspended",
          isDeleted: true,
          deletedAt: new Date()
        }
      });

      await recordAuditLog({
        action: "user_deleted",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        organizationId: params.orgId,
        targetType: "organization",
        targetId: params.orgId
      });

      return reply.status(204).send();
    }
  );

  fastify.get(
    "/members",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const members = await prisma.membership.findMany({
        where: { organizationId: orgId },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              teamRoles: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      });

      return reply.send({
        error: false,
        data: members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          accountRole: m.user.role,
          membershipRole: m.role,
          isActive: m.user.isActive,
          teamRoles: m.user.teamRoles
        }))
      });
    }
  );

  fastify.post(
    "/members/invite",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const bodySchema = z.object({
        email: z.string().email(),
        role: z.enum(["owner", "admin", "editor", "viewer"]).default("viewer")
      });
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid invite payload"
        });
      }

      const actorMembership = await prisma.membership.findFirst({
        where: { userId: request.user.id, organizationId: orgId },
        select: { role: true }
      });
      if (!actorMembership || (actorMembership.role !== "owner" && actorMembership.role !== "admin")) {
        return reply.status(403).send({
          error: true,
          message: "Only organization owners or admins can invite members."
        });
      }

      const invite = await createInvite(
        {
          organizationId: orgId,
          email: parsed.data.email,
          role: parsed.data.role
        },
        prisma
      );

      await recordAuditLog({
        action: "user_created",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        organizationId: orgId,
        targetType: "invite",
        targetId: invite.id,
        metadata: { email: invite.email, role: invite.role }
      });

      // In a real system, send email here with invite.code

      return reply.send({
        error: false,
        data: {
          inviteId: invite.id,
          code: invite.code,
          expiresAt: invite.expiresAt
        }
      });
    }
  );

  fastify.post("/members/accept", async (request, reply) => {
    const bodySchema = z.object({
      code: z.string().min(10),
      name: z.string().min(2).max(120),
      password: z.string().min(10).max(128)
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: true,
        message: parsed.error.flatten().formErrors.join(", ") || "Invalid invite"
      });
    }

    const invite = await consumeInvite(parsed.data.code, prisma);
    if (!invite) {
      return reply.status(400).send({
        error: true,
        message: "Invalid or expired invite."
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email }
    });

    let finalUserId: string;
    let finalRole: "admin" | "operator" | "viewer";
    if (!existingUser) {
      const hashed = await hashPassword(parsed.data.password);
      const created = await prisma.user.create({
        data: {
          name: parsed.data.name.trim(),
          email: invite.email,
          role: "viewer",
          passwordHash: hashed,
          isActive: true
        }
      });
      finalUserId = created.id;
      finalRole = created.role;
    } else {
      finalUserId = existingUser.id;
      finalRole = existingUser.role;
    }

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: finalUserId,
          organizationId: invite.organizationId
        }
      },
      create: {
        id: `m-${finalUserId}-${invite.organizationId}`,
        userId: finalUserId,
        organizationId: invite.organizationId,
        role: invite.role as MembershipRole
      },
      update: {
        role: invite.role as MembershipRole
      }
    });

    const tokenPayload = {
      id: finalUserId,
      role: finalRole,
      email: invite.email,
      name: parsed.data.name,
      orgId: invite.organizationId,
      membershipRole: invite.role
    };
    const token = await reply.jwtSign(tokenPayload);
    await setSessionCookie(reply, token);

    return reply.send({
      error: false,
      message: "Invitation accepted.",
      data: {
        orgId: invite.organizationId,
        email: invite.email,
        membershipRole: invite.role
      }
    });
  });

  fastify.patch(
    "/members/:userId",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const params = request.params as { userId: string };
      const parsed = membershipUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid membership payload"
        });
      }

      const actorMembership = await prisma.membership.findFirst({
        where: { userId: request.user.id, organizationId: orgId },
        select: { role: true }
      });
      if (!actorMembership || (actorMembership.role !== "owner" && actorMembership.role !== "admin")) {
        return reply.status(403).send({
          error: true,
          message: "Only organization owners or admins can change membership roles."
        });
      }

      const targetMembership = await prisma.membership.findFirst({
        where: { userId: params.userId, organizationId: orgId },
        select: { role: true }
      });

      if (!targetMembership) {
        return reply.status(404).send({
          error: true,
          message: "Membership not found."
        });
      }

      await prisma.membership.update({
        where: {
          userId_organizationId: {
            userId: params.userId,
            organizationId: orgId
          }
        },
        data: { role: parsed.data.role }
      });

      await recordAuditLog({
        action: "user_updated",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        organizationId: orgId,
        targetType: "membership",
        targetId: params.userId,
        metadata: { role: parsed.data.role }
      });

      return reply.send({ error: false });
    }
  );

  fastify.delete(
    "/members/:userId",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const params = request.params as { userId: string };

      if (params.userId === request.user.id) {
        return reply.status(400).send({
          error: true,
          message: "You cannot remove yourself."
        });
      }

      const actorMembership = await prisma.membership.findFirst({
        where: { userId: request.user.id, organizationId: orgId },
        select: { role: true }
      });
      if (!actorMembership || (actorMembership.role !== "owner" && actorMembership.role !== "admin")) {
        return reply.status(403).send({
          error: true,
          message: "Only organization owners or admins can remove members."
        });
      }

      const targetMembership = await prisma.membership.findFirst({
        where: { userId: params.userId, organizationId: orgId },
        select: { role: true }
      });

      if (!targetMembership) {
        return reply.status(404).send({
          error: true,
          message: "Membership not found."
        });
      }

      await prisma.membership.delete({
        where: {
          userId_organizationId: {
            userId: params.userId,
            organizationId: orgId
          }
        }
      });

      await recordAuditLog({
        action: "user_deleted",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        organizationId: orgId,
        targetType: "membership",
        targetId: params.userId
      });

      return reply.status(204).send();
    }
  );

  fastify.post(
    "/switch",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const bodySchema = z.object({
        organizationId: z.string().uuid("organizationId must be a uuid")
      });
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: true,
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid payload"
        });
      }

      const membership = await prisma.membership.findFirst({
        where: {
          organizationId: parsed.data.organizationId,
          userId: request.user.id
        },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!membership) {
        return reply.status(403).send({
          error: true,
          message: "You do not have access to this organization."
        });
      }

      const tokenPayload = {
        id: request.user.id,
        role: request.user.role,
        email: request.user.email,
        name: request.user.name,
        orgId: membership.organization.id,
        membershipRole: membership.role,
        isDemo: request.user.isDemo ?? false
      };

      const token = await reply.jwtSign(tokenPayload);
      await setSessionCookie(reply, token);

      return reply.send({
        error: false,
        data: {
          organization: {
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
            membershipRole: membership.role
          }
        }
      });
    }
  );
};

export default organizationsRoutes;
