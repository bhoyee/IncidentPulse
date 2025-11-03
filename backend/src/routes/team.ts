import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { hashPassword, toSafeUser } from "../lib/auth";
import { createUserSchema, teamUsersQuerySchema, updateUserSchema } from "../lib/validation";
import { sendMail } from "../lib/mailer";
import { env } from "../env";

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

        let emailStatus: "pending" | "delivered" | "failed" | "skipped" = "pending";
        let emailError: string | null = null;

        const shouldSendEmail = true;

        if (!shouldSendEmail) {
          emailStatus = "skipped";
        } else {
          const loginUrl = new URL("/login", env.FRONTEND_URL).toString();
          const textBody = [
            `Hi ${user.name},`,
            "",
            "An IncidentPulse administrator created an account for you.",
            "",
            `Email: ${user.email}`,
            `Temporary password: ${finalPassword}`,
            "",
            `You can sign in at ${loginUrl}. For security, please update your password after logging in.`,
            "",
            "If you weren’t expecting this message, reach out to your team lead."
          ].join("\n");

          const htmlBody = `
            <p>Hi ${user.name},</p>
            <p>An IncidentPulse administrator created an account for you.</p>
            <ul>
              <li><strong>Email:</strong> ${user.email}</li>
              <li><strong>Temporary password:</strong> ${finalPassword}</li>
            </ul>
            <p>You can sign in at <a href="${loginUrl}">${loginUrl}</a>. For security, please update your password after logging in.</p>
            <p>If you weren’t expecting this message, reach out to your team lead.</p>
          `;

          const mailPromise = sendMail({
            to: user.email,
            subject: "Your new IncidentPulse account",
            text: textBody,
            html: htmlBody
          })
            .then(() => {
              emailStatus = "delivered";
            })
            .catch((mailError) => {
              emailStatus = "failed";
              emailError =
                mailError instanceof Error
                  ? mailError.message
                  : "Failed to deliver onboarding email.";
              fastify.log.error(
                { err: mailError, userId: user.id, email: user.email },
                "Failed to send onboarding email to new user"
              );
            });

          const EMAIL_TIMEOUT_MS = 4000;
          await Promise.race([
            mailPromise,
            new Promise((resolve) => setTimeout(resolve, EMAIL_TIMEOUT_MS))
          ]);

          if (emailStatus === "pending") {
            // Allow the promise to finish in the background without causing an unhandled rejection.
            void mailPromise.catch(() => {});
          }
        }

        return reply.status(201).send({
          error: false,
          data: toSafeUser(user),
          meta: {
            initialPassword: password ? null : finalPassword,
            emailStatus,
            emailError
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

      const updatePayload: Prisma.UserUpdateInput = {};

      if (data.role) {
        updatePayload.role = data.role;
      }
      if (data.isActive !== undefined) {
        updatePayload.isActive = data.isActive;
      }
      if (data.teamRoles !== undefined) {
        updatePayload.teamRoles = data.teamRoles;
      }
      if (data.name) {
        updatePayload.name = data.name;
      }
      if (data.email) {
        updatePayload.email = data.email;
      }

      try {
        const user = await prisma.user.update({
          where: { id: params.id },
          data: updatePayload,
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
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2025") {
            return reply.status(404).send({
              error: true,
              message: "User not found"
            });
          }
          if (error.code === "P2002") {
            return reply.status(409).send({
              error: true,
              message: "A user with this email already exists"
            });
          }
        }

        throw error;
      }
    }
  );

  fastify.delete(
    "/users/:id",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const params = request.params as { id: string };

      if (params.id === request.user.id) {
        return reply.status(400).send({
          error: true,
          message: "You cannot delete your own account."
        });
      }

      try {
        await prisma.user.delete({
          where: { id: params.id }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2025") {
            return reply.status(404).send({
              error: true,
              message: "User not found"
            });
          }
          if (error.code === "P2003") {
            return reply.status(409).send({
              error: true,
              message:
                "Unable to delete this user because they are referenced by existing incidents. Deactivate the account instead."
            });
          }
        }
        throw error;
      }

      return reply.status(204).send();
    }
  );
};

function generatePassword(): string {
  const raw = crypto.randomBytes(12).toString("base64url");
  // ensure at least 14 characters, mix letters and digits
  return raw.slice(0, 16);
}

export default teamRoutes;
