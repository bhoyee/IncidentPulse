import type { FastifyPluginAsync } from "fastify";
import { fetchFreshStatus } from "../lib/status";
import { onStatusSnapshot } from "../lib/realtime";
import { DEFAULT_ORG_ID, findOrgIdBySlug } from "../lib/org";

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async (_request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (_request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) {
      orgId = await findOrgIdBySlug(orgSlug);
    }
    if (!orgId) {
      orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;
    }

    const snapshot = await fetchFreshStatus(undefined, orgId);

    return reply.send({
      error: false,
      data: snapshot.payload,
      meta: {
        state: snapshot.state,
        uptime24h: snapshot.uptime24h
      }
    });
  });

  fastify.get("/status/stream", async (_request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (_request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) {
      orgId = await findOrgIdBySlug(orgSlug);
    }
    if (!orgId) {
      orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    if (typeof reply.raw.flushHeaders === "function") {
      reply.raw.flushHeaders();
    }
    reply.hijack();

    const initial = await fetchFreshStatus(undefined, orgId);
    reply.raw.write(
      `event: status\n` +
        `data: ${JSON.stringify({
          error: false,
          data: initial.payload,
          meta: {
            state: initial.state,
            uptime24h: initial.uptime24h
          }
        })}\n\n`
    );

    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 15000);

    const detach = onStatusSnapshot((snapshot) => {
      if (snapshot.organizationId && snapshot.organizationId !== orgId) {
        return;
      }
      reply.raw.write(
        `event: status\n` +
          `data: ${JSON.stringify({
            error: false,
            data: snapshot.payload,
            meta: {
              state: snapshot.state,
              uptime24h: snapshot.uptime24h
            }
          })}\n\n`
      );
    });

    const closeStream = () => {
      clearInterval(heartbeat);
      detach();
      reply.raw.end();
    };

    reply.raw.on("close", closeStream);
    reply.raw.on("aborted", closeStream);
  });
};

export default publicRoutes;
