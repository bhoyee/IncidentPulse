import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import { changePasswordSchema, loginSchema } from "../lib/validation";
import { clearSession, hashPassword, setSessionCookie, toSafeUser, verifyPassword } from "../lib/auth";
import { recordAuditLog } from "../lib/audit";
import { isDemoEmail } from "../lib/demo";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/login", async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: true,
        message: parseResult.error.flatten().formErrors.join(", ") || "Invalid email or password"
      });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        error: true,
        message: "Invalid credentials"
      });
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return reply.status(401).send({
        error: true,
        message: "Invalid credentials"
      });
    }

    const demoUser = isDemoEmail(user.email);

    const token = await reply.jwtSign({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      isDemo: demoUser
    });

    await setSessionCookie(reply, token);
    await recordAuditLog({
      action: "user_login",
      actorId: user.id,
      actorEmail: user.email,
      actorName: user.name
    });

    return reply.status(200).send({
      error: false,
      user: {
        ...toSafeUser(user),
        isDemo: demoUser
      }
    });
  });

  fastify.post("/logout", async (_request, reply) => {
    await clearSession(reply);
    return reply.status(200).send({
      error: false,
      message: "Logged out"
    });
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamRoles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      await clearSession(reply);
      return reply.status(404).send({
        error: true,
        message: "User not found"
      });
    }

    return reply.status(200).send({
      error: false,
      user: {
        ...user,
        isDemo: isDemoEmail(user.email)
      }
    });
  });

  fastify.post(
    "/change-password",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsedBody = changePasswordSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: true,
          message: parsedBody.error.flatten().formErrors.join(", ") || "Invalid payload"
        });
      }

      const { currentPassword, newPassword } = parsedBody.data;

      const user = await prisma.user.findUnique({
        where: { id: request.user.id }
      });

      if (!user || !user.isActive) {
        await clearSession(reply);
        return reply.status(401).send({
          error: true,
          message: "Unauthorized"
        });
      }

      if (isDemoEmail(user.email)) {
        return reply.status(403).send({
          error: true,
          message: "Password changes are disabled for demo accounts."
        });
      }

      const matches = await verifyPassword(currentPassword, user.passwordHash);
      if (!matches) {
        return reply.status(400).send({
          error: true,
          message: "Current password is incorrect."
        });
      }

      const hashed = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashed
        }
      });

      return reply.status(200).send({
        error: false,
        message: "Password updated successfully."
      });
    }
  );
};

export default authRoutes;
