import { Queue, type RedisOptions } from "bullmq";
import { env } from "../env";

function buildConnection(): RedisOptions | undefined {
  if (env.NODE_ENV === "test") return undefined;
  if (!env.REDIS_URL) return undefined;
  try {
    const u = new URL(env.REDIS_URL);
    return {
      host: u.hostname,
      port: Number(u.port || "6379"),
      password: u.password || undefined,
      db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0
    };
  } catch {
    return undefined;
  }
}

const connection = buildConnection();

export const mailQueue = connection ? new Queue("mail", { connection }) : null;
export const webhookQueue = connection ? new Queue("webhook", { connection }) : null;
export const opsQueue = connection ? new Queue("ops", { connection }) : null;

export type QueueHealth =
  | {
      status: "unknown";
      message: string;
    }
  | {
      status: "ok" | "down";
      message?: string;
      counts?: Record<string, number>;
    };

export async function getQueueHealthSummary(): Promise<QueueHealth> {
  if (!connection || !mailQueue || !webhookQueue || !opsQueue) {
    return { status: "unknown", message: "Queue not configured" };
  }

  try {
    await Promise.all([mailQueue.waitUntilReady(), webhookQueue.waitUntilReady(), opsQueue.waitUntilReady()]);
    const [mailCounts, webhookCounts, opsCounts] = await Promise.all([
      mailQueue.getJobCounts("waiting", "active", "delayed", "failed"),
      webhookQueue.getJobCounts("waiting", "active", "delayed", "failed"),
      opsQueue.getJobCounts("waiting", "active", "delayed", "failed")
    ]);

    const mergeCounts = (...counts: Array<Record<string, number>>) => {
      return counts.reduce<Record<string, number>>((acc, curr) => {
        Object.entries(curr).forEach(([key, val]) => {
          acc[key] = (acc[key] || 0) + (val || 0);
        });
        return acc;
      }, {});
    };

    return {
      status: "ok",
      counts: mergeCounts(mailCounts, webhookCounts, opsCounts)
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Queue health check failed";
    return { status: "down", message };
  }
}

type MailJobPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
};

type WebhookJobPayload = {
  url: string;
  payload: unknown;
  headers?: Record<string, string>;
};

export async function enqueueMail(job: MailJobPayload) {
  if (!mailQueue) return null;
  try {
    return await mailQueue.add("send", job, { attempts: 3, backoff: { type: "exponential", delay: 1500 } });
  } catch {
    return null;
  }
}

export async function enqueueWebhook(job: WebhookJobPayload) {
  if (!webhookQueue) return null;
  try {
    return await webhookQueue.add("deliver", job, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });
  } catch {
    return null;
  }
}
