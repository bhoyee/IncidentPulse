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
import { sendMail } from "../lib/mailer";

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

function buildStaffInviteEmail(options: { name: string; email: string; tempPassword: string }) {
  const loginUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/superadmin-login`;
  const subject = "Welcome to IncidentPulse Platform Staff";
  const text = [
    `Hello ${options.name || "there"},`,
    "",
    "You've been added as platform staff on IncidentPulse.",
    "",
    `Email: ${options.email}`,
    `Temporary password: ${options.tempPassword}`,
    "",
    `Login: ${loginUrl}`,
    "",
    "Please sign in and change your password immediately.",
    "",
    "Thanks,",
    "IncidentPulse Team"
  ].join("\n");

  const html = `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b1021;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid #1f2937;border-radius:16px;padding:24px;color:#e2e8f0;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#60a5fa;font-weight:700;">IncidentPulse</div>
      <h1 style="margin:10px 0 0;font-size:22px;color:#f8fafc;">Welcome to Platform Staff</h1>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin-top:10px;">
        Hello ${options.name || "there"},<br/>
        You've been added as platform staff on IncidentPulse. Use the credentials below to sign in, then update your password.
      </p>
      <div style="margin-top:16px;border:1px solid #1f2937;border-radius:12px;background:#111827;padding:14px;">
        <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Email</p>
        <p style="margin:0 0 12px;font-size:15px;color:#f8fafc;font-weight:600;">${options.email}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Temporary password</p>
        <p style="margin:0;font-size:15px;color:#f8fafc;font-weight:700;">${options.tempPassword}</p>
      </div>
      <a href="${loginUrl}" style="display:inline-block;margin-top:18px;padding:12px 16px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">Open platform login</a>
      <p style="margin-top:14px;color:#94a3b8;font-size:13px;">If you did not expect this, contact your administrator.</p>
    </div>
  </div>
  `;

  return { to: options.email, subject, text, html };
}

async function computePlatformMetrics(windowDays: number) {
  const window = Math.max(1, Math.min(90, windowDays));
  const now = new Date();
  const since = new Date(now.getTime() - window * 24 * 60 * 60 * 1000);

  const [
    orgs,
    userCount,
    incidentsByDay,
    incidentsWindowCount,
    maintenanceWindowCount,
    incidentsByOrg,
    membersByOrg,
    servicesByOrg,
    lastActivityRows,
    webhookMetrics,
    persistedTop,
    persistedOrgTop,
    publicVisitsByPath,
    publicVisitsTotalCount,
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
      WHERE "createdAt" >= ${since}
      GROUP BY bucket
      ORDER BY bucket
    `,
    prisma.incident.count({ where: { createdAt: { gte: since } } }),
    prisma.maintenanceEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.incident.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: since } },
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
      where: { bucket: { gte: since } },
      _sum: { count: true, errorCount: true, totalMs: true },
      orderBy: { _sum: { count: "desc" } },
      take: 10
    }),
    prisma.$queryRaw<Array<{ orgId: string | null; route: string; count: number; errorCount: number; totalMs: number }>>`
      SELECT "orgId", route, SUM(count)::int as count, SUM("errorCount")::int as "errorCount", SUM("totalMs")::int as "totalMs"
      FROM "TrafficStat"
      WHERE bucket >= ${since}
      GROUP BY "orgId", route
      ORDER BY count DESC
      LIMIT 30
    `,
      prisma.$queryRaw<Array<{ path: string | null; count: number }>>`
        SELECT path, COUNT(*)::int AS count
        FROM "PublicVisit"
        WHERE "createdAt" >= ${since}
        GROUP BY path
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT ip)::int AS count
        FROM "PublicVisit"
        WHERE "createdAt" >= ${since} AND ip IS NOT NULL AND ip <> ''
      `,
      prisma.$queryRaw<Array<{ country: string | null; count: number }>>`
        SELECT COALESCE(country, 'Unknown') AS country, COUNT(*)::int AS count
        FROM "PublicVisit"
        WHERE "createdAt" >= ${since}
        GROUP BY COALESCE(country, 'Unknown')
      ORDER BY count DESC
      LIMIT 10
    `
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

  const activeOrgs = orgs.filter((o: any) => o.status !== "suspended" && !o.isDeleted).length;
  const inactiveOrgs = orgs.length - activeOrgs;
  const totalMembers = membersByOrg.reduce((sum: number, row: any) => sum + (row._count?._all ?? 0), 0);
  const totalAdmins = await prisma.membership.count({ where: { role: "admin" } });
  const pendingTickets = await prisma.supportTicket.count({ where: { status: "pending" } });
  const openTickets = await prisma.supportTicket.count({ where: { status: "open" } });

  // Billing rollups
  const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due", "unpaid"]);
  const inactiveSubscriptionStatuses = new Set(["canceled", "incomplete", "incomplete_expired", "paused"]);
  const billingTotals = orgSummaries.reduce(
    (acc: any, org: any) => {
      const status = org.billing?.subscriptionStatus;
      if (activeSubscriptionStatuses.has(status)) acc.activeSubscriptions += 1;
      else if (inactiveSubscriptionStatuses.has(status)) acc.inactiveSubscriptions += 1;
      else acc.unknownSubscriptions += 1;
      return acc;
    },
    { activeSubscriptions: 0, inactiveSubscriptions: 0, unknownSubscriptions: 0, totalSales: 0 }
  );

  return {
    totals: {
      orgs: orgs.length,
      tenants: orgs.length,
      users: userCount,
      incidentsWindow: incidentsWindowCount,
      maintenanceWindow: maintenanceWindowCount,
      activeOrgs,
      inactiveOrgs,
      inactiveTenants: inactiveOrgs,
      members: totalMembers,
      admins: totalAdmins,
      pendingTickets,
      openTickets
    },
    billingTotals,
    incidentsTrend: incidentsByDay,
    orgs: orgSummaries,
    webhook: webhookMetrics,
    traffic: getTrafficSnapshot(),
    trafficPersisted: {
      topEndpoints: (persistedTop as any[]).map((row) => {
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
      total: Number((publicVisitsTotalCount as any)?.[0]?.count ?? 0),
      topPaths: publicVisitsByPath.map((row: any) => ({
        path: row.path ?? "Unknown",
        count: Number(row.count ?? 0)
      })),
      topCountries: publicVisitsByCountry.map((row: any) => ({
        country: row.country ?? "Unknown",
        count: Number(row.count ?? 0)
      }))
    }
  };
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

  fastify.get("/metrics", async (request) => {
    const windowParam = (request.query as any)?.window as string | undefined;
    const windowDays = Math.max(1, Math.min(90, Number(windowParam) || 30));
    const data = await computePlatformMetrics(windowDays);
    return { error: false, data };
  });

  fastify.get("/metrics/stream", async (request, reply) => {
    const windowParam = (request.query as any)?.window as string | undefined;
    const windowDays = Math.max(1, Math.min(90, Number(windowParam) || 30));

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const send = async () => {
      try {
        const data = await computePlatformMetrics(windowDays);
        reply.raw.write(`data: ${JSON.stringify({ error: false, data })}\n\n`);
      } catch (err: any) {
        request.log.error({ err }, "Failed to stream platform metrics");
        reply.raw.write(`data: ${JSON.stringify({ error: true, message: "metrics fetch failed" })}\n\n`);
      }
    };

    await send();
    const interval = setInterval(send, 15000);
    reply.raw.on("close", () => {
      clearInterval(interval);
    });
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

  // Hard delete (destructive) an organization and all related records.
  fastify.delete<{ Params: { orgId: string } }>(
    "/organizations/:orgId",
    async (request) => {
      const { orgId } = request.params;

      const deletedOrg = await (prisma as any).organization.delete({ where: { id: orgId } });

      await recordAuditLog(
        {
          action: "platform_org_deleted" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "organization",
          targetId: orgId,
          metadata: { hardDelete: true }
        },
        prisma
      );

      return { error: false, data: deletedOrg };
    }
  );

  fastify.get<{ Params: { orgId: string } }>(
    "/organizations/:orgId/delete-preview",
    async (request) => {
      const { orgId } = request.params;
      const [
        incidents,
        incidentUpdates,
        services,
        maintenance,
        members,
        apiKeys,
        integrationSettings,
        subscribers,
        auditLogs,
        supportTickets,
        supportComments,
        supportAttachments
      ] = await Promise.all([
        (prisma as any).incident.count({ where: { organizationId: orgId } }),
        (prisma as any).incidentUpdate.count({ where: { incident: { organizationId: orgId } } }),
        (prisma as any).service.count({ where: { organizationId: orgId } }),
        (prisma as any).maintenanceEvent.count({ where: { organizationId: orgId } }),
        (prisma as any).membership.count({ where: { organizationId: orgId } }),
        (prisma as any).apiKey.count({ where: { organizationId: orgId } }),
        (prisma as any).integrationSettings.count({ where: { organizationId: orgId } }),
        (prisma as any).statusSubscriber.count({ where: { organizationId: orgId } }),
        (prisma as any).auditLog.count({ where: { organizationId: orgId } }),
        (prisma as any).supportTicket.count({ where: { organizationId: orgId } }),
        (prisma as any).supportComment.count({ where: { ticket: { organizationId: orgId } } }),
        (prisma as any).supportAttachment.count({ where: { ticket: { organizationId: orgId } } })
      ]);

      return {
        error: false,
        data: {
          organizationId: orgId,
          counts: {
            incidents,
            incidentUpdates,
            services,
            maintenance,
            members,
            apiKeys,
            integrationSettings,
            subscribers,
            auditLogs,
            supportTickets,
            supportComments,
            supportAttachments
          }
        }
      };
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
          platformRole: true,
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

  const platformRoleOptions = new Set(["support", "sales", "hr", "operations"]);

  fastify.get("/staff", async () => {
    const staff = await prisma.user.findMany({
      where: { platformRole: { not: "none" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        isActive: true,
        createdAt: true
      }
    });
    return { error: false, data: staff };
  });

  fastify.post("/staff", async (request, reply) => {
    const body = request.body as { name?: string; email?: string; platformRole?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const platformRole = body.platformRole?.trim().toLowerCase();

    if (!name || !email || !platformRole || !platformRoleOptions.has(platformRole)) {
      return reply.status(400).send({
        error: true,
        message: "Provide name, email, and a valid platform role."
      });
    }

    const tempPassword = `Temp-${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await hashPassword(tempPassword);

    try {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          isActive: true,
          isSuperAdmin: true,
          platformRole: platformRole as any
        },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
          isActive: true,
          createdAt: true
        }
      });

      const inviteEmail = buildStaffInviteEmail({ name, email, tempPassword });
      sendMail(inviteEmail).catch((err: any) => {
        request.log.warn({ err }, "Failed to send staff invite email");
      });

      await recordAuditLog(
        {
          action: "platform_staff_created" as any,
          actorId: request.user.id,
          actorEmail: request.user.email,
          actorName: request.user.name,
          targetType: "user",
          targetId: user.id,
          metadata: { platformRole: user.platformRole }
        },
        prisma
      );

      return reply.status(201).send({
        error: false,
        data: user,
        meta: { temporaryPassword: tempPassword }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({
          error: true,
          message: "A user with this email already exists"
        });
      }
      throw error;
    }
  });

  fastify.patch("/staff/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = request.body as {
      name?: string;
      platformRole?: string;
      isActive?: boolean;
    };

    const updateData: any = {};
    if (body.name?.trim()) updateData.name = body.name.trim();
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (body.platformRole) {
      const roleValue = body.platformRole.trim().toLowerCase();
      if (!platformRoleOptions.has(roleValue)) {
        return reply.status(400).send({
          error: true,
          message: "Invalid platform role."
        });
      }
      updateData.platformRole = roleValue;
      updateData.isSuperAdmin = true;
    }

    if (!Object.keys(updateData).length) {
      return reply.status(400).send({ error: true, message: "No changes provided." });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        isActive: true,
        createdAt: true
      }
    });

    await recordAuditLog(
      {
        action: "platform_staff_updated" as any,
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        targetType: "user",
        targetId: userId,
        metadata: updateData
      },
      prisma
    );

    return { error: false, data: updated };
  });

  fastify.delete("/staff/:userId", async (request) => {
    const { userId } = request.params as { userId: string };
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, platformRole: "none" as any },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        isActive: true,
        createdAt: true
      }
    });

    await recordAuditLog(
      {
        action: "platform_staff_deleted" as any,
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorName: request.user.name,
        targetType: "user",
        targetId: userId,
        metadata: { platformRole: updated.platformRole }
      },
      prisma
    );

    return { error: false, data: updated };
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
