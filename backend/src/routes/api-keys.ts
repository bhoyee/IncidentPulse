import type { FastifyPluginAsync } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { getRequestOrgId } from "../lib/org";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const createSchema = z.object({
  name: z.string().min(2).max(100)
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional()
});

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: fastify.authenticate }, async (request, reply) => {
    const orgId = getRequestOrgId(request);
    const keys = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, lastUsedAt: true, createdAt: true }
    });
    return reply.send({ error: false, data: keys });
  });

  fastify.post("/", { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] }, async (request, reply) => {
    const orgId = getRequestOrgId(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: true, message: "Invalid payload" });
    }
    const rawKey = `ipk_${randomBytes(24).toString("hex")}`;
    const created = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: parsed.data.name.trim(),
        hashedKey: hashKey(rawKey)
      },
      select: { id: true, name: true, lastUsedAt: true, createdAt: true }
    });

    return reply.status(201).send({
      error: false,
      data: created,
      meta: { key: rawKey }
    });
  });

  fastify.patch("/:id", { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] }, async (request, reply) => {
    const orgId = getRequestOrgId(request);
    const params = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: true, message: "Invalid payload" });
    }

    const existing = await prisma.apiKey.findFirst({
      where: { id: params.id, organizationId: orgId }
    });
    if (!existing) {
      return reply.status(404).send({ error: true, message: "API key not found" });
    }

    await prisma.apiKey.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {})
      }
    });

    return reply.send({ error: false });
  });

  fastify.delete("/:id", { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] }, async (request, reply) => {
    const orgId = getRequestOrgId(request);
    const params = request.params as { id: string };
    await prisma.apiKey.deleteMany({
      where: { id: params.id, organizationId: orgId }
    });
    return reply.status(204).send();
  });
};

export default apiKeysRoutes;
