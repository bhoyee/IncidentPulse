import type { FastifyPluginAsync } from "fastify";
import { randomInt } from "node:crypto";
import { prisma } from "../lib/db";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema
} from "../lib/validation";
import {
  clearSession,
  hashPassword,
  setSessionCookie,
  toSafeUser,
  verifyPassword
} from "../lib/auth";
import { recordAuditLog } from "../lib/audit";
import { isDemoEmail } from "../lib/demo";
import { sendMail } from "../lib/mailer";

const RESET_CODE_EXPIRY_MINUTES = 10;

function generateResetCode(): string {
  return randomInt(100000, 1000000).toString();
}

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

    // Mark demo logins so downstream middleware/UI can disable write actions.
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

      // Prevent shared demo credentials from being modified.
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

  fastify.post("/forgot-password", async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: true,
        message: parsed.error.flatten().formErrors.join(", ") || "Invalid email"
      });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.isActive) {
      return reply.status(404).send({
        error: true,
        message: "No account found for that email."
      });
    }

    if (isDemoEmail(user.email)) {
      return reply.status(403).send({
        error: true,
        message: "Demo accounts cannot request password resets."
      });
    }

    const code = generateResetCode();
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt
      }
    });

    const bodyText = [
      "You requested to reset your IncidentPulse password.",
      "",
      `Use this verification code: ${code}`,
      "",
      "This code expires in 10 minutes."
    ].join("\n");

    await sendMail({
      to: user.email,
      subject: "IncidentPulse password reset code",
      text: bodyText,
      html: `<p>You requested to reset your IncidentPulse password.</p><p>Use this verification code:</p><p style="font-size: 20px; font-weight: bold;">${code}</p><p>This code expires in 10 minutes.</p>`
    });

    return reply.send({
      error: false,
      message: "A verification code has been sent to your email."
    });
  });

  fastify.post("/reset-password", async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: true,
        message: parsed.error.flatten().formErrors.join(", ") || "Invalid payload"
      });
    }

    const { email, code, newPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.isActive) {
      return reply.status(404).send({
        error: true,
        message: "No account found for that email."
      });
    }

    if (isDemoEmail(user.email)) {
      return reply.status(403).send({
        error: true,
        message: "Demo accounts cannot change passwords via reset."
      });
    }

    const token = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!token) {
      return reply.status(400).send({
        error: true,
        message: "No active reset request. Please request a new code."
      });
    }

    const codeMatches = await verifyPassword(code, token.codeHash);
    if (!codeMatches) {
      return reply.status(400).send({
        error: true,
        message: "Invalid or expired code."
      });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: {
          consumedAt: new Date()
        }
      })
    ]);

    return reply.send({
      error: false,
      message: "Password updated successfully."
    });
  });
};

export default authRoutes;
