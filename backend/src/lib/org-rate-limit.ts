import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db";

type Bucket = {
  limit: number;
  count: number;
  windowStart: number;
  fetchedAt: number;
};

const buckets = new Map<string, Bucket>();
const DEFAULT_LIMIT = Number(process.env.DEFAULT_ORG_RATE_LIMIT ?? "600");
const FETCH_TTL_MS = 60_000;
const WINDOW_MS = 60_000;

export async function enforceOrgRateLimit(request: FastifyRequest, reply: FastifyReply) {
  const orgId = (request.user as any)?.orgId as string | undefined;
  if (!orgId) return;
  if ((request.user as any)?.isSuperAdmin) return;

  const now = Date.now();
  let bucket = buckets.get(orgId);

  if (!bucket || now - bucket.fetchedAt > FETCH_TTL_MS) {
    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
      select: { rateLimitPerMinute: true } as any
    })) as any;
    const limit = org?.rateLimitPerMinute ?? DEFAULT_LIMIT;
    bucket = {
      limit,
      count: 0,
      windowStart: now,
      fetchedAt: now
    };
    buckets.set(orgId, bucket);
  }

  // reset window if needed
  if (now - bucket.windowStart >= WINDOW_MS) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  bucket.count += 1;
  if (bucket.count > bucket.limit) {
    return reply.status(429).send({
      error: true,
      message: "Rate limit exceeded for this organization. Try again shortly."
    });
  }
}

export function updateOrgRateLimitCache(orgId: string, limit: number) {
  const now = Date.now();
  buckets.set(orgId, {
    limit,
    count: 0,
    windowStart: now,
    fetchedAt: now
  });
}
