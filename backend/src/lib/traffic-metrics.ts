import { prisma } from "./db";

type EndpointStats = {
  route: string;
  count: number;
  errorCount: number;
  totalMs: number;
};

type Snapshot = {
  totalRequests: number;
  errorCount: number;
  avgMs: number;
  statusCounts: Record<string, number>;
  topEndpoints: Array<{ route: string; count: number; avgMs: number; errorRate: number }>;
  perOrg: Record<string, OrgTraffic>;
};

type OrgTraffic = {
  totalRequests: number;
  errorCount: number;
  totalMs: number;
  statusCounts: Record<string, number>;
};

const statusCounts: Record<string, number> = {};
const endpoints = new Map<string, EndpointStats>();
const perOrg: Record<string, OrgTraffic> = {};
let totalRequests = 0;
let errorCount = 0;
let totalMs = 0;

export function recordTraffic(route: string, statusCode: number, durationMs: number, orgId?: string) {
  totalRequests += 1;
  totalMs += durationMs;
  const key = statusCode.toString();
  statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  if (statusCode >= 400) {
    errorCount += 1;
  }

  const stat = endpoints.get(route) ?? { route, count: 0, errorCount: 0, totalMs: 0 };
  stat.count += 1;
  stat.totalMs += durationMs;
  if (statusCode >= 400) {
    stat.errorCount += 1;
  }
  endpoints.set(route, stat);

  if (orgId) {
    const bucket = perOrg[orgId] ?? {
      totalRequests: 0,
      errorCount: 0,
      totalMs: 0,
      statusCounts: {}
    };
    bucket.totalRequests += 1;
    bucket.totalMs += durationMs;
    bucket.statusCounts[key] = (bucket.statusCounts[key] ?? 0) + 1;
    if (statusCode >= 400) bucket.errorCount += 1;
    perOrg[orgId] = bucket;
  }
}

export function getTrafficSnapshot(): Snapshot {
  const topEndpoints = Array.from(endpoints.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e) => ({
      route: e.route,
      count: e.count,
      avgMs: e.count ? Math.round(e.totalMs / e.count) : 0,
      errorRate: e.count ? Number(((e.errorCount / e.count) * 100).toFixed(1)) : 0
    }));

  return {
    totalRequests,
    errorCount,
    avgMs: totalRequests ? Math.round(totalMs / totalRequests) : 0,
    statusCounts: { ...statusCounts },
    topEndpoints,
    perOrg
  };
}

export async function persistTraffic(route: string, statusCode: number, durationMs: number, orgId?: string) {
  const bucket = new Date();
  bucket.setMinutes(0, 0, 0);
  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "TrafficStat" ("orgId","route","bucket","count","errorCount","totalMs")
      VALUES ($1,$2,$3,1,$4,$5)
      ON CONFLICT ("orgId","route","bucket")
      DO UPDATE SET "count" = "TrafficStat"."count" + 1,
                    "errorCount" = "TrafficStat"."errorCount" + EXCLUDED."errorCount",
                    "totalMs" = "TrafficStat"."totalMs" + EXCLUDED."totalMs",
                    "updatedAt" = now()
      `,
      orgId ?? null,
      route,
      bucket,
      statusCode >= 400 ? 1 : 0,
      Math.max(0, Math.round(durationMs))
    );
  } catch (err) {
    // Swallow errors to avoid impacting request path
    console.warn("Traffic persist failed", err);
  }
}
