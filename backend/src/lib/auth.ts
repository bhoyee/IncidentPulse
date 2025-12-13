import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { env } from "../env";

const SESSION_COOKIE = "incidentpulse_session";

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    domain: env.COOKIE_DOMAIN,
    maxAge: 60 * 60 * 24 * 7 // seven days
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type SessionTokenPayload = {
  id: string;
  role: User["role"];
  email: string;
  name: string;
  orgId: string;
  membershipRole: string;
  isDemo?: boolean;
};

export function toSafeUser(
  user: Pick<
    User,
    "id" | "email" | "name" | "role" | "createdAt" | "updatedAt" | "teamRoles" | "isActive"
  >
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    teamRoles: user.teamRoles,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function requireRole(request: FastifyRequest, roles: Array<User["role"]>) {
  if (!roles.includes(request.user.role)) {
    const error = new Error("Forbidden") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

export async function clearSession(reply: FastifyReply) {
  reply.clearCookie(getSessionCookieName(), getCookieOptions());
}

export async function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(getSessionCookieName(), token, getCookieOptions());
}
