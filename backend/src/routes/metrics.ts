import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import { refreshStatusCache } from "../lib/status";
import { getWebhookMetrics } from "../lib/webhook-metrics";
import { getRequestOrgId } from "../lib/org";

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/sla",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const incidents = await prisma.incident.findMany({
        where: {
          organizationId: orgId,
          createdAt: {
            gte: startOfDay
          }
        },
        select: {
          createdAt: true,
          firstResponseAt: true,
          resolvedAt: true
        }
      });

      const firstResponseDurations = incidents
        .filter((incident) => incident.firstResponseAt)
        .map((incident) => differenceInMinutes(incident.createdAt, incident.firstResponseAt!));

      const resolutionDurations = incidents
        .filter((incident) => incident.resolvedAt)
        .map((incident) => differenceInMinutes(incident.createdAt, incident.resolvedAt!));

      return reply.send({
        error: false,
        data: {
          avgFirstResponseMinutesToday: average(firstResponseDurations),
          avgResolveMinutesToday: average(resolutionDurations)
        }
      });
    }
  );

  fastify.get(
    "/analytics",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const orgId = getRequestOrgId(request);
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const [incidents, severityGroups, serviceGroups, weeklyTrend, monthlyTrend] = await Promise.all([
        prisma.incident.findMany({
          where: {
            organizationId: orgId,
            createdAt: {
              gte: last30Days
            }
          },
          select: {
            createdAt: true,
            firstResponseAt: true,
            resolvedAt: true,
            severity: true,
            serviceId: true
          }
        }),
        prisma.incident.groupBy({
          by: ["severity"],
          where: { organizationId: orgId },
          _count: { _all: true }
        }),
        prisma.incident.groupBy({
          by: ["serviceId"],
          where: { organizationId: orgId },
          _count: { _all: true }
        }),
        prisma.$queryRaw<
          Array<{ bucket: Date; count: number }>
        >`SELECT DATE_TRUNC('week', "createdAt")::date AS bucket, COUNT(*)::int AS count FROM "Incident" WHERE "organizationId" = ${orgId} AND "createdAt" >= ${last90Days} GROUP BY bucket ORDER BY bucket`,
        prisma.$queryRaw<
          Array<{ bucket: Date; count: number }>
        >`SELECT DATE_TRUNC('month', "createdAt")::date AS bucket, COUNT(*)::int AS count FROM "Incident" WHERE "organizationId" = ${orgId} AND "createdAt" >= ${last90Days} GROUP BY bucket ORDER BY bucket`
      ]);

      const firstResponseDurations = incidents
        .filter((incident) => incident.firstResponseAt)
        .map((incident) => differenceInMinutes(incident.createdAt, incident.firstResponseAt!));

      const resolutionDurations = incidents
        .filter((incident) => incident.resolvedAt)
        .map((incident) => differenceInMinutes(incident.createdAt, incident.resolvedAt!));

      const services = await prisma.service.findMany({
        where: {
          organizationId: orgId,
          id: {
            in: serviceGroups.map((group) => group.serviceId).filter(Boolean) as string[]
          }
        },
        select: {
          id: true,
          name: true
        }
      });
      const serviceNameMap = new Map(services.map((service) => [service.id, service.name]));

      const severityStats = severityGroups.map((group) => ({
        severity: group.severity,
        count: group._count._all
      }));

      const serviceStats = serviceGroups.map((group) => ({
        serviceId: group.serviceId,
        serviceName: group.serviceId ? serviceNameMap.get(group.serviceId) ?? "Unknown service" : "Unassigned",
        count: group._count._all
      }));

      return reply.send({
        error: false,
        data: {
          avgResolutionMinutes: average(resolutionDurations),
          avgFirstResponseMinutes: average(firstResponseDurations),
          severityBreakdown: severityStats,
          serviceBreakdown: serviceStats,
          weeklyTrend: weeklyTrend.map((entry) => ({ bucket: entry.bucket, count: entry.count })),
          monthlyTrend: monthlyTrend.map((entry) => ({ bucket: entry.bucket, count: entry.count }))
        }
      });
    }
  );

  fastify.get(
    "/recompute",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (_request, reply) => {
      const snapshot = await refreshStatusCache();
      return reply.send({
        error: false,
        data: snapshot
      });
    }
  );

  fastify.get(
    "/webhook",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (_request, reply) => {
      return reply.send({
        error: false,
        data: getWebhookMetrics()
      });
    }
  );
};

function differenceInMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

export default metricsRoutes;
