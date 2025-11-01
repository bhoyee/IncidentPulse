import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import { loginSchema } from "../lib/validation";
import { clearSession, setSessionCookie, toSafeUser, verifyPassword } from "../lib/auth";

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

    const token = await reply.jwtSign({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name
    });

    await setSessionCookie(reply, token);

    return reply.status(200).send({
      error: false,
      user: toSafeUser(user)
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
      user
    });
  });
};

export default authRoutes;
