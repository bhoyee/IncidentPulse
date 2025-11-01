import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { hashPassword, toSafeUser } from "../lib/auth";
import { createUserSchema, teamUsersQuerySchema, updateUserSchema } from "../lib/validation";

const teamRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/users",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const parsedQuery = teamUsersQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: true,
          message: parsedQuery.error.flatten().formErrors.join(", ") || "Invalid query parameters"
        });
      }

      const { search, page, pageSize } = parsedQuery.data;

      const filters: Prisma.UserWhereInput[] = [];

      if (search) {
        filters.push({
          OR: [
            {
              name: {
                contains: search,
                mode: Prisma.QueryMode.insensitive
              }
            },
            {
              email: {
                contains: search,
                mode: Prisma.QueryMode.insensitive
              }
            },
            {
              teamRoles: {
                has: search
              }
            }
          ]
        });
      }

      const where: Prisma.UserWhereInput =
        filters.length > 0 ? { AND: filters } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            teamRoles: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        prisma.user.count({ where })
      ]);

      return reply.send({
        error: false,
        data: users.map((user) => toSafeUser(user)),
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
    "/users",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const parsedBody = createUserSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid payload"
        });
      }

      const { name, email, role, teamRoles, isActive, password } = parsedBody.data;
      const finalPassword = password ?? generatePassword();

      try {
        const user = await prisma.user.create({
          data: {
            name,
            email,
            role,
            teamRoles,
            isActive: isActive ?? true,
            passwordHash: await hashPassword(finalPassword)
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            teamRoles: true,
            createdAt: true,
            updatedAt: true
          }
        });

        return reply.status(201).send({
          error: false,
          data: toSafeUser(user),
          meta: {
            initialPassword: password ? null : finalPassword
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return reply.status(409).send({
            error: true,
            message: "A user with this email already exists"
          });
        }

        throw error;
      }
    }
  );

  fastify.patch(
    "/users/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };
      const parsedBody = updateUserSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid payload"
        });
      }

      const data = parsedBody.data;

      const user = await prisma.user.update({
        where: { id: params.id },
        data: {
          ...(data.role ? { role: data.role } : {}),
          ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
          ...(data.teamRoles === undefined ? {} : { teamRoles: data.teamRoles })
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          teamRoles: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return reply.send({
        error: false,
        data: toSafeUser(user)
      });
    }
  );
};

function generatePassword(): string {
  const raw = crypto.randomBytes(12).toString("base64url");
  // ensure at least 14 characters, mix letters and digits
  return raw.slice(0, 16);
}

export default teamRoutes;
