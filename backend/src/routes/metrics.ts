import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import { refreshStatusCache } from "../lib/status";

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/sla",
    { preHandler: fastify.authenticate },
    async (_request, reply) => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const incidents = await prisma.incident.findMany({
        where: {
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
