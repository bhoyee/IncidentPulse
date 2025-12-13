import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import { recordAuditLog } from "../lib/audit";
import { hashPassword } from "../lib/auth";
import type { Plan } from "@prisma/client";
import { env } from "../env";
import { getWebhookMetrics } from "../lib/webhook-metrics";
import { getTrafficSnapshot } from "../lib/traffic-metrics";
import { updateOrgRateLimitCache } from "../lib/org-rate-limit";
import { Prisma } from "@prisma/client";

let stripe: any = null;
async function getStripe() {
  if (stripe || !env.STRIPE_SECRET_KEY) return stripe;
  // Lazy load stripe only if configured
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require("stripe");
  stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  return stripe;
}

async function getBillingStatusForOrg(org: { id: string; stripeCustomerId: string | null; plan: Plan }) {
  const client = await getStripe();
  if (!client) {
    return { customerId: org.stripeCustomerId, subscriptionStatus: "unavailable" };
  }
  if (!org.stripeCustomerId) {
    return { customerId: null, subscriptionStatus: "not_created" };
  }
  try {
    const subs = await client.subscriptions.list({
      customer: org.stripeCustomerId,
      status: "all",
      limit: 1
    });
    const sub = subs.data?.[0];
    return {
      customerId: org.stripeCustomerId,
      subscriptionStatus: sub?.status ?? "none",
      currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      priceId: sub?.items?.data?.[0]?.price?.id ?? null
    };
  } catch (err) {
    return { customerId: org.stripeCustomerId, subscriptionStatus: "error" };
  }
}

async function getOrCreateStripeCustomer(orgId: string) {
  const client = await getStripe();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, stripeCustomerId: true }
  });
  if (!org) throw new Error("Organization not found");
  if (org.stripeCustomerId) return org.stripeCustomerId;
  if (!client) {
    return process.env.STRIPE_TEST_CUSTOMER_ID || null;
  }
  const customer = await client.customers.create({
    name: org.name,
    metadata: { orgId: org.id, orgSlug: org.slug || undefined }
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id }
  });
  return customer.id as string;
}

const platformRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require super-admin
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireSuperAdmin);

  fastify.get("/organizations", async () => {
    const orgs = await (prisma as any).organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        isDeleted: true,
        createdAt: true,
        stripeCustomerId: true,
        rateLimitPerMinute: true,
        _count: {
          select: {
            members: true,
            services: true,
            incidents: true
          }
        }
      }
    });

    const results = await Promise.all(
      orgs.map(async (org: any) => {
        const billing = await getBillingStatusForOrg(org as any);
        return { ...org, billing };
      })
    );

    return { error: false, data: results };
  });

  fastify.get("/metrics", async () => {
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      orgs,
      userCount,
      incidentsByDay,
      incidents30Count,
      maintenance30Count,
      incidentsByOrg,
      membersByOrg,
      servicesByOrg,
      lastActivityRows,
      webhookMetrics,
      persistedTop,
      persistedOrgTop,
      publicVisitsByPath,
      publicVisitsTotals,
      publicVisitsByCountry
    ] = await Promise.all([
      (prisma as any).organization.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        isDeleted: true,
        createdAt: true,
        rateLimitPerMinute: true,
        stripeCustomerId: true
      }
    }),
      prisma.user.count(),
      prisma.$queryRaw<Array<{ bucket: Date; count: number }>>`
        SELECT DATE_TRUNC('day', "createdAt")::date AS bucket, COUNT(*)::int AS count
        FROM "Incident"
        WHERE "createdAt" >= ${last30}
        GROUP BY bucket
        ORDER BY bucket
      `,
      prisma.incident.count({ where: { createdAt: { gte: last30 } } }),
      prisma.maintenanceEvent.count({ where: { createdAt: { gte: last30 } } }),
      prisma.incident.groupBy({
        by: ["organizationId"],
        where: { createdAt: { gte: last30 } },
        _count: { _all: true }
      }),
      prisma.membership.groupBy({
        by: ["organizationId"],
        _count: { _all: true }
      }),
      prisma.service.groupBy({
        by: ["organizationId"],
        _count: { _all: true }
      }),
      prisma.$queryRaw<Array<{ organizationId: string; lastActivity: Date }>>`
        SELECT "organizationId", MAX("createdAt") AS "lastActivity"
        FROM "AuditLog"
        GROUP BY "organizationId"
      `,
      getWebhookMetrics(),
      (prisma as any).trafficStat.groupBy({
        by: ["route"],
        where: { bucket: { gte: last30 } },
        _sum: { count: true, errorCount: true, totalMs: true },
        orderBy: { _sum: { count: "desc" } },
        take: 10
      }),
      prisma.$queryRaw<Array<{ orgId: string | null; route: string; count: number; errorCount: number; totalMs: number }>>`
        SELECT "orgId", route, SUM(count)::int as count, SUM("errorCount")::int as "errorCount", SUM("totalMs")::int as "totalMs"
        FROM "TrafficStat"
        WHERE bucket >= ${last30}
        GROUP BY "orgId", route
        ORDER BY count DESC
        LIMIT 30
      `,
      (prisma as any).publicVisit.groupBy({
        by: ["path"],
        _count: { _all: true },
        where: { createdAt: { gte: last30 } },
        orderBy: { _count: { _all: "desc" } },
        take: 10
      }),
      (prisma as any).publicVisit.aggregate({
        _count: { _all: true }
      }) as any,
      (prisma as any).publicVisit.groupBy({
        by: ["country"],
        _count: { _all: true },
        where: { createdAt: { gte: last30 }, country: { not: null } },
        orderBy: { _count: { _all: "desc" } },
        take: 10
      })
    ]);

    const incidentsByOrgMap = new Map<string, number>(
      incidentsByOrg.map((row: { organizationId: string; _count: { _all: number } }) => [row.organizationId, row._count._all])
    );
    const membersByOrgMap = new Map<string, number>(
      membersByOrg.map((row: { organizationId: string; _count: { _all: number } }) => [row.organizationId, row._count._all])
    );
    const servicesByOrgMap = new Map<string, number>(
      servicesByOrg.map((row: { organizationId: string; _count: { _all: number } }) => [row.organizationId, row._count._all])
    );
    const lastActivityMap = new Map<string, Date>(
      lastActivityRows.map((row: { organizationId: string; lastActivity: Date }) => [row.organizationId, row.lastActivity])
    );

    const orgSummaries = await Promise.all(
      orgs.map(async (org: any) => {
        const billing = await getBillingStatusForOrg(org as any);
        return {
          ...org,
          lastActivity: lastActivityMap.get(org.id) ?? null,
          counts: {
            incidents30: incidentsByOrgMap.get(org.id) ?? 0,
            members: membersByOrgMap.get(org.id) ?? 0,
            services: servicesByOrgMap.get(org.id) ?? 0
          },
          billing
        };
      })
    );

    return {
      error: false,
      data: {
        totals: {
          orgs: orgs.length,
          users: userCount,
          incidents30: incidents30Count,
          maintenance30: maintenance30Count
        },
        incidentsTrend: incidentsByDay,
        orgs: orgSummaries,
        webhook: webhookMetrics,
        traffic: getTrafficSnapshot(),
        trafficPersisted: {
          topEndpoints: persistedTop.map((row: any) => {
            const count = Number(row._sum?.count ?? 0);
            const errors = Number(row._sum?.errorCount ?? 0);
            const totalMs = Number(row._sum?.totalMs ?? 0);
            return {
              route: row.route,
              count,
              avgMs: count ? Math.round(totalMs / count) : 0,
              errorRate: count ? Number(((errors / count) * 100).toFixed(1)) : 0
            };
          }),
          topEndpointsByOrg: (persistedOrgTop as any[]).map((row) => {
            const count = Number(row.count ?? 0);
            const errors = Number(row.errorCount ?? 0);
            const totalMs = Number(row.totalMs ?? 0);
            return {
              orgId: row.orgId,
              route: row.route,
              count,
              avgMs: count ? Math.round(totalMs / count) : 0,
              errorRate: count ? Number(((errors / count) * 100).toFixed(1)) : 0
            };
          })
        },
        visitors: {
          total: (publicVisitsTotals as any)?._count?._all ?? 0,
          topPaths: publicVisitsByPath.map((row: any) => ({
            path: row.path,
            count: row._count?._all ?? 0
          })),
          topCountries: publicVisitsByCountry.map((row: any) => ({
            country: row.country ?? "Unknown",
            count: row._count?._all ?? 0
          }))
        }
      }
    };
  });

  fastify.patch<{ Params: { orgId: string }; Body: { status: "active" | "suspended" } }>(
    "/organizations/:orgId/status",
    async (request) => {
      const { orgId } = request.params;
      const { status } = request.body;
      const updated = await (prisma as any).organization.update({
        where: { id: orgId },
        data: { status, isDeleted: false, deletedAt: null }
      });

      await recordAuditLog(
        {
          action: "platform_org_status_updated" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "organization",
          targetId: orgId,
          metadata: { status }
        },
        prisma
      );

      return { error: false, data: updated };
    }
  );

  fastify.patch<{ Params: { orgId: string }; Body: { plan: Plan } }>(
    "/organizations/:orgId/plan",
    async (request) => {
      const { orgId } = request.params;
      const { plan } = request.body;
      const updated = await (prisma as any).organization.update({
        where: { id: orgId },
        data: { plan }
      });

      await recordAuditLog(
        {
          action: "platform_org_plan_updated" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "organization",
          targetId: orgId,
          metadata: { plan }
        },
        prisma
      );

      return { error: false, data: updated };
    }
  );

  fastify.patch<{ Params: { orgId: string }; Body: { rateLimitPerMinute: number } }>(
    "/organizations/:orgId/rate-limit",
    async (request, reply) => {
      const { orgId } = request.params;
      const { rateLimitPerMinute } = request.body;
      if (!rateLimitPerMinute || rateLimitPerMinute < 50) {
        return reply.status(400).send({ error: true, message: "Provide a reasonable rate limit (>=50)." });
      }
      const updated = await (prisma as any).organization.update({
        where: { id: orgId },
        data: { rateLimitPerMinute }
      });
      updateOrgRateLimitCache(orgId, rateLimitPerMinute);
      return { error: false, data: updated };
    }
  );

  fastify.delete<{ Params: { orgId: string } }>(
    "/organizations/:orgId",
    async (request) => {
      const { orgId } = request.params;
      const updated = await (prisma as any).organization.update({
        where: { id: orgId },
        data: { isDeleted: true, status: "suspended", deletedAt: new Date() }
      });

      await recordAuditLog(
        {
          action: "platform_org_deleted" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "organization",
          targetId: orgId,
          metadata: { softDelete: true }
        },
        prisma
      );

      return { error: false, data: updated };
    }
  );

  fastify.get<{ Params: { orgId: string } }>("/organizations/:orgId/invoices", async (request, reply) => {
    const client = await getStripe();
    if (!client || !env.STRIPE_PORTAL_RETURN_URL) {
      return reply
        .status(400)
        .send({ error: true, message: "Configure STRIPE_SECRET_KEY and STRIPE_PORTAL_RETURN_URL to enable invoices." });
    }
    const customerId = await getOrCreateStripeCustomer(request.params.orgId);
    if (!customerId) {
      return reply.status(400).send({ error: true, message: "No Stripe customer available for this org." });
    }
    const invoices = await client.invoices.list({ customer: customerId, limit: 10 });
    const data = invoices.data.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      total: inv.total,
      currency: inv.currency,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      createdAt: inv.created,
      invoicePdf: inv.invoice_pdf
    }));
    return { error: false, data };
  });

  fastify.post<{ Params: { orgId: string } }>("/organizations/:orgId/portal", async (request, reply) => {
    const client = await getStripe();
    if (!client || !env.STRIPE_PORTAL_RETURN_URL) {
      return reply
        .status(400)
        .send({ error: true, message: "Configure STRIPE_SECRET_KEY and STRIPE_PORTAL_RETURN_URL to enable portal." });
    }
    const customerId = await getOrCreateStripeCustomer(request.params.orgId);
    if (!customerId) {
      return reply.status(400).send({ error: true, message: "No Stripe customer available for this org." });
    }
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: env.STRIPE_PORTAL_RETURN_URL
    });
    return { error: false, data: { url: session.url } };
  });

  fastify.get("/users", async () => {
    const [users, lastLoginRows] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          isSuperAdmin: true,
          createdAt: true,
          memberships: {
            select: { organizationId: true }
          },
          _count: {
            select: { memberships: true }
          }
        }
      }),
      prisma.$queryRaw<Array<{ id: string; lastLogin: Date }>>`
        SELECT "actorId" as id, MAX("createdAt") as "lastLogin"
        FROM "AuditLog"
        WHERE action = 'user_login' AND "actorId" IS NOT NULL
        GROUP BY "actorId"
      `
    ]);
    const lastLoginMap = new Map(lastLoginRows.map((row) => [row.id, row.lastLogin]));
    const data = users.map((u) => ({
      ...u,
      membershipCount: (u as any)._count?.memberships ?? u.memberships.length,
      lastLogin: lastLoginMap.get(u.id) ?? null
    }));
    return { error: false, data };
  });

  fastify.patch<{ Params: { userId: string }; Body: { isActive: boolean } }>(
    "/users/:userId/suspend",
    async (request) => {
      const { userId } = request.params;
      const { isActive } = request.body;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: { id: true, isActive: true }
      });

      await recordAuditLog(
        {
          action: "platform_user_suspended" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "user",
          targetId: userId,
          metadata: { isActive }
        },
        prisma
      );

      return { error: false, data: updated };
    }
  );

  fastify.get("/audit/logs", async (request, reply) => {
    const page = Number((request.query as any)?.page ?? 1);
    const pageSize = Math.min(50, Number((request.query as any)?.pageSize ?? 20));
    const actionFilter = (request.query as any)?.action as string | undefined;

    const where: any = actionFilter
      ? { action: actionFilter }
      : { action: { startsWith: "platform_" as any } };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return reply.send({
      error: false,
      data: logs,
      meta: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  });

  fastify.post<{ Params: { userId: string } }>(
    "/users/:userId/reset-password",
    async (request) => {
      const { userId } = request.params;
      const temporaryPassword = `Temp-${Math.random().toString(36).slice(2, 10)}!`;
      const passwordHash = await hashPassword(temporaryPassword);

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: { id: true, email: true }
      });

      await recordAuditLog(
        {
          action: "platform_user_password_reset" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "user",
          targetId: userId,
          metadata: { tempPasswordIssued: true }
        },
        prisma
      );

      return {
        error: false,
        data: { userId: updated.id, email: updated.email, temporaryPassword }
      };
    }
  );
};

export default platformRoutes;
