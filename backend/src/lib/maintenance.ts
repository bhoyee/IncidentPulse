import type { MaintenanceEvent, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export const maintenanceEventInclude = {
  service: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.MaintenanceEventInclude;

export type MaintenanceEventWithService = Prisma.MaintenanceEventGetPayload<{
  include: typeof maintenanceEventInclude;
}>;

export async function transitionMaintenanceEvents(prisma: PrismaClient = defaultPrisma): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.maintenanceEvent.updateMany({
      where: {
        status: "scheduled",
        startsAt: {
          lte: now
        },
        endsAt: {
          gte: now
        }
      },
      data: {
        status: "in_progress"
      }
    }),
    prisma.maintenanceEvent.updateMany({
      where: {
        status: {
          in: ["scheduled", "in_progress"]
        },
        endsAt: {
          lt: now
        }
      },
      data: {
        status: "completed"
      }
    })
  ]);
}

export function serializeMaintenanceEvent(event: MaintenanceEventWithService) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    appliesToAll: event.appliesToAll,
    service: event.appliesToAll
      ? null
      : event.service
        ? {
            id: event.service.id,
            name: event.service.name,
            slug: event.service.slug
          }
        : null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}

export function isActiveMaintenance(event: MaintenanceEvent, reference = new Date()): boolean {
  return event.status === "in_progress" || (event.status === "scheduled" && event.startsAt <= reference && event.endsAt >= reference);
}
