import type { Service } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./slug";

export const DEFAULT_SERVICE_SLUG = "platform";
const DEFAULT_SERVICE_NAME = "Platform";

export async function getDefaultService(): Promise<Service> {
  const existing = await prisma.service.findFirst({
    where: { slug: DEFAULT_SERVICE_SLUG }
  });

  if (existing) {
    return existing;
  }

  return prisma.service.create({
    data: {
      name: DEFAULT_SERVICE_NAME,
      slug: DEFAULT_SERVICE_SLUG,
      description: "Default platform-wide service"
    }
  });
}

export async function ensureUniqueSlug(
  desired: string,
  options: { ignoreServiceId?: string } = {}
): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.service.findFirst({
      where: {
        slug: candidate,
        NOT: options.ignoreServiceId ? { id: options.ignoreServiceId } : undefined
      },
      select: { id: true }
    });

    if (!existing) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export async function findServiceBySlug(slug: string): Promise<Service | null> {
  return prisma.service.findFirst({
    where: { slug }
  });
}

export async function resolveServiceIdOrDefault(
  slug: string
): Promise<Service> {
  const normalized = slugify(slug);
  const existing = await findServiceBySlug(normalized);
  if (existing) {
    return existing;
  }
  return getDefaultService();
}
