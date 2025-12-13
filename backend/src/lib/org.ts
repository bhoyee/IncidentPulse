import type { MembershipRole, Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { prisma } from "./db";

export const DEFAULT_ORG_ID = "org-default";
export const DEFAULT_ORG_NAME = "Default Organization";
export const DEFAULT_ORG_SLUG = "default";

function mapUserRoleToMembership(role: Role): MembershipRole {
  if (role === "admin") return "owner";
  if (role === "operator") return "editor";
  return "viewer";
}

export async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    create: {
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG
    },
    update: {}
  });
}

export async function ensureUserOrgContext(userId: string, userRole: Role) {
  const org = await ensureDefaultOrganization();

  const existingMembership = await prisma.membership.findFirst({
    where: { userId },
    select: { organizationId: true, role: true }
  });

  if (existingMembership) {
    return existingMembership;
  }

  const membershipRole = mapUserRoleToMembership(userRole);

  const membership = await prisma.membership.create({
    data: {
      id: `m-${userId}`,
      userId,
      organizationId: org.id,
      role: membershipRole
    },
    select: { organizationId: true, role: true }
  });

  return membership;
}

export function getRequestOrgId(request: FastifyRequest): string {
  const orgId = (request.user as { orgId?: string } | undefined)?.orgId;
  return orgId ?? DEFAULT_ORG_ID;
}

export async function findOrgIdBySlug(slug: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true }
  });
  return org?.id ?? null;
}
