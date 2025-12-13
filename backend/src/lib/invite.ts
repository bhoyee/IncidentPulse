import { randomBytes } from "node:crypto";
import { addMinutes } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export type InviteToken = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  code: string;
  expiresAt: Date;
};

export async function createInvite(
  params: { organizationId: string; email: string; role: string; ttlMinutes?: number },
  prisma: PrismaClient = defaultPrisma
): Promise<InviteToken> {
  const code = randomBytes(16).toString("hex");
  const expiresAt = addMinutes(new Date(), params.ttlMinutes ?? 60 * 24);

  const invite = await prisma.inviteToken.create({
    data: {
      id: `inv-${code}`,
      organizationId: params.organizationId,
      email: params.email.toLowerCase(),
      role: params.role,
      codeHash: code,
      expiresAt
    }
  });

  return {
    id: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    role: invite.role,
    code,
    expiresAt: invite.expiresAt
  };
}

export async function consumeInvite(
  code: string,
  prisma: PrismaClient = defaultPrisma
): Promise<{ organizationId: string; email: string; role: string } | null> {
  const token = await prisma.inviteToken.findFirst({
    where: {
      codeHash: code,
      expiresAt: { gt: new Date() },
      consumedAt: null
    }
  });

  if (!token) {
    return null;
  }

  await prisma.inviteToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() }
  });

  return {
    organizationId: token.organizationId,
    email: token.email,
    role: token.role
  };
}
