import type { FastifyPluginAsync } from "fastify";
import { fetchFreshStatus } from "../lib/status";
import { onStatusSnapshot } from "../lib/realtime";

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async (_request, reply) => {
    const snapshot = await fetchFreshStatus();

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
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    if (typeof reply.raw.flushHeaders === "function") {
      reply.raw.flushHeaders();
    }
    reply.hijack();

    const initial = await fetchFreshStatus();
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
