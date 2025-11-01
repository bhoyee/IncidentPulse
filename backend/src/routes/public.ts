import type { FastifyPluginAsync } from "fastify";
import { fetchFreshStatus } from "../lib/status";

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
};

export default publicRoutes;
