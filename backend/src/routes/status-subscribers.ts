import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db";
import { createSubscriber, listSubscribersForOrg, unsubscribeSubscriber, verifySubscriber } from "../lib/status-subscribers";
import { DEFAULT_ORG_ID, findOrgIdBySlug } from "../lib/org";

const statusSubscriberRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Origin, Accept");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Vary", "Origin");
  });

  // Preflight for public subscribe
  fastify.options("/status/subscribe", async (request, reply) => {
    const origin = (request.headers.origin as string | undefined) || "*";
    reply
      .header("Access-Control-Allow-Origin", origin)
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type, Origin, Accept")
      .header("Vary", "Origin");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.send();
  });

  // Public subscribe
  fastify.post("/status/subscribe", async (request, reply) => {
    const origin = (request.headers.origin as string | undefined) || "*";
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Origin, Accept");
    reply.header("Vary", "Origin");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");

    const body = request.body as {
      email?: string;
      orgId?: string;
      orgSlug?: string;
      serviceIds?: string[];
    };
    if (!body?.email) {
      return reply.code(400).send({ error: true, message: "Email is required" });
    }

    let orgId: string | null = null;
    if (body.orgSlug) orgId = await findOrgIdBySlug(body.orgSlug);
    if (!orgId) orgId = body.orgId ?? DEFAULT_ORG_ID;

    try {
      await createSubscriber({
        organizationId: orgId,
        email: body.email,
        serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds : undefined
      });
      return reply.send({ error: false, message: "Check your email to verify subscription" });
    } catch (err) {
      request.log.error({ err }, "subscribe failed");
      return reply.code(500).send({ error: true, message: "Subscription failed" });
    }
  });

  // Public verify
  fastify.get("/status/verify", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    const { token } = (request.query as { token?: string }) ?? {};
    if (!token) {
      return reply.code(400).send({ error: true, message: "Missing token" });
    }
    const updated = await verifySubscriber(token);
    if (!updated) return reply.code(400).send({ error: true, message: "Invalid or used token" });
    return reply.send({ error: false, message: "Subscription verified" });
  });

  // Public unsubscribe
  fastify.post("/status/unsubscribe", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    const body = request.body as { token?: string };
    if (!body?.token) return reply.code(400).send({ error: true, message: "Missing token" });
    const removed = await unsubscribeSubscriber(body.token);
    if (!removed) return reply.code(400).send({ error: true, message: "Invalid token" });
    return reply.send({ error: false, message: "Unsubscribed" });
  });

  // Tenant: list subscribers for current org
  fastify.get("/status-subscribers", { preHandler: fastify.authenticate }, async (request, reply) => {
    const orgId = request.user.orgId ?? DEFAULT_ORG_ID;
    const subs = await listSubscribersForOrg(orgId);
    return reply.send({ error: false, data: subs });
  });

  // Tenant: delete subscriber by id
  fastify.delete("/status-subscribers/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const orgId = request.user.orgId;
    const { id } = request.params as { id: string };
    const sub = await (prisma as any).statusSubscriber.findUnique({ where: { id } });
    if (!sub || sub.organizationId !== orgId) {
      return reply.code(404).send({ error: true, message: "Not found" });
    }
    await (prisma as any).statusSubscriber.delete({ where: { id } });
    return reply.send({ error: false });
  });

  // Tenant: create subscriber manually (auto-verified)
  fastify.post("/status-subscribers", { preHandler: fastify.authenticate }, async (request, reply) => {
    const orgId = request.user.orgId ?? DEFAULT_ORG_ID;
    const body = request.body as { email?: string; serviceIds?: string[] | null; verifyNow?: boolean };
    if (!body?.email) {
      return reply.code(400).send({ error: true, message: "Email is required" });
    }
    try {
      const sub = await createSubscriber({
        organizationId: orgId,
        email: body.email,
        serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds : undefined,
        verifyNow: body.verifyNow !== false, // default true for admins
        skipEmail: true
      });
      return reply.send({ error: false, data: sub });
    } catch (err) {
      request.log.error({ err }, "create subscriber failed");
      return reply.code(500).send({ error: true, message: "Unable to create subscriber" });
    }
  });
};

export default statusSubscriberRoutes;
