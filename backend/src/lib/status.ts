import type { PrismaClient, Incident } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export type PublicIncident = {
  id: string;
  title: string;
  severity: Incident["severity"];
  status: Incident["status"];
  startedAt: Date;
  service: {
    id: string;
    name: string;
    slug: string;
  };
};

export type ServiceStatusSnapshot = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  state: StatusSnapshot["state"];
  activeIncidentCount: number;
};

export type StatusSnapshot = {
  state: "operational" | "partial_outage" | "major_outage";
  uptime24h: number;
  payload: {
    overall_state: "operational" | "partial_outage" | "major_outage";
    active_incidents: PublicIncident[];
    services: ServiceStatusSnapshot[];
    last_24h: {
      uptime_percent: number;
      incident_count: number;
    };
  };
};

const STATUS_STALE_SECONDS = 15;

export async function computeStatusSnapshot(prisma: PrismaClient = defaultPrisma): Promise<StatusSnapshot> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [activeIncidents, incidentsLast24hCount, services] = await Promise.all([
    prisma.incident.findMany({
      where: {
        status: {
          not: "resolved"
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true
          }
        }
      }
    }),
    prisma.incident.count({
      where: {
        createdAt: {
          gte: since
        }
      }
    }),
    prisma.service.findMany({
      orderBy: { name: "asc" }
    })
  ]);

  const activePublicIncidents: PublicIncident[] = activeIncidents.map((incident) => ({
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.createdAt,
    service: {
      id: incident.service.id,
      name: incident.service.name,
      slug: incident.service.slug
    }
  }));

  const incidentsByService = activeIncidents.reduce<Record<string, Incident[]>>((acc, incident) => {
    const list = acc[incident.serviceId] ?? [];
    list.push(incident);
    acc[incident.serviceId] = list;
    return acc;
  }, {});

  const serviceSnapshots: ServiceStatusSnapshot[] = services.map((service) => {
    const serviceIncidents = incidentsByService[service.id] ?? [];
    const state = determineOverallState(serviceIncidents);
    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      state,
      activeIncidentCount: serviceIncidents.length
    };
  });

  const overallState = determineOverallState(activeIncidents);
  const uptime24h = calculateUptime(activeIncidents);

  return {
    state: overallState,
    uptime24h,
    payload: {
      overall_state: overallState,
      active_incidents: activePublicIncidents,
      services: serviceSnapshots,
      last_24h: {
        uptime_percent: uptime24h,
        incident_count: incidentsLast24hCount
      }
    }
  };
}

function determineOverallState(incidents: Incident[]): StatusSnapshot["state"] {
  const hasCritical = incidents.some((incident) => incident.severity === "critical");
  if (hasCritical) {
    return "major_outage";
  }

  const hasHigh = incidents.some((incident) => incident.severity === "high");
  if (hasHigh) {
    return "partial_outage";
  }

  return "operational";
}

function calculateUptime(incidents: Incident[]): number {
  if (incidents.length === 0) {
    return 100;
  }

  const downtimeWeight = incidents.reduce((total, incident) => {
    switch (incident.severity) {
      case "critical":
        return total + 20;
      case "high":
        return total + 10;
      case "medium":
        return total + 5;
      default:
        return total + 1;
    }
  }, 0);

  return Math.max(0, 100 - Math.min(downtimeWeight, 95));
}

export async function refreshStatusCache(prisma: PrismaClient = defaultPrisma): Promise<StatusSnapshot> {
  const snapshot = await computeStatusSnapshot(prisma);

  await prisma.statusCache.upsert({
    where: { id: "global-status-cache" },
    create: {
      id: "global-status-cache",
      state: snapshot.state,
      uptime24h: snapshot.uptime24h,
      payload: snapshot.payload
    },
    update: {
      state: snapshot.state,
      uptime24h: snapshot.uptime24h,
      payload: snapshot.payload
    }
  });

  return snapshot;
}

export async function fetchFreshStatus(prisma: PrismaClient = defaultPrisma): Promise<StatusSnapshot> {
  const cache = await prisma.statusCache.findUnique({
    where: { id: "global-status-cache" }
  });

  if (!cache) {
    return refreshStatusCache(prisma);
  }

  const [latestIncident, latestUpdate] = await Promise.all([
    prisma.incident.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    }),
    prisma.incidentUpdate.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  ]);

  const cacheUpdatedAt = cache.updatedAt.getTime();
  const latestActivity = Math.max(
    latestIncident?.updatedAt.getTime() ?? 0,
    latestUpdate?.createdAt.getTime() ?? 0
  );

  const isActivityStale = latestActivity > cacheUpdatedAt;
  const isTimerStale = Math.abs(Date.now() - cacheUpdatedAt) / 1000 > STATUS_STALE_SECONDS;

  if (isActivityStale || isTimerStale) {
    return refreshStatusCache(prisma);
  }

  const payload = cache.payload as Record<string, unknown>;
  if (!("services" in payload)) {
    return refreshStatusCache(prisma);
  }

  return {
    state: cache.state,
    uptime24h: cache.uptime24h,
    payload: payload as StatusSnapshot["payload"]
  };
}
