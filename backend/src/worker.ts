import "dotenv/config";
import { Worker, type JobsOptions } from "bullmq";
import { env } from "./env";
import { sendMail } from "./lib/mailer";
import { recordAuditLog } from "./lib/audit";
import { prisma } from "./lib/db";

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

function buildConnection() {
  if (!env.REDIS_URL) return undefined;
  const u = new URL(env.REDIS_URL);
  return {
    host: u.hostname,
    port: Number(u.port || "6379"),
    password: u.password || undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0
  };
}

const connection = buildConnection();

if (!connection) {
  // eslint-disable-next-line no-console
  console.warn("Worker: REDIS_URL not set; queues will not run.");
  process.exit(0);
}

const defaultOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1500 }
};

// Mail worker
new Worker(
  "mail",
  async (job) => {
    const data = job.data as MailJobPayload;
    await sendMail({
      to: data.to,
      subject: data.subject,
      text: data.text ?? "",
      html: data.html,
      replyTo: data.replyTo
    });
    return true;
  },
  { connection, concurrency: 5, removeOnComplete: { count: 500 }, removeOnFail: { count: 200 } }
);

// Webhook worker
new Worker(
  "webhook",
  async (job) => {
    const data = job.data as WebhookJobPayload;
    const res = await fetch(data.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(data.headers ?? {}) },
      body: JSON.stringify(data.payload)
    });
    if (!res.ok) {
      throw new Error(`Webhook failed ${res.status} ${res.statusText}`);
    }
    return true;
  },
  { connection, concurrency: 3, removeOnComplete: { count: 500 }, removeOnFail: { count: 200 } }
);

// Ops worker placeholder (add heavy jobs here)
new Worker(
  "ops",
  async () => true,
  { connection, concurrency: 2, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 } }
);

// Minimal audit for failed jobs
function onFailed(queueName: string) {
  return async (job: any, err: any) => {
    const meta = {
      queue: queueName,
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: err?.message || "unknown"
    };
    // eslint-disable-next-line no-console
    console.error(`Job failed in ${queueName}`, meta);
    try {
      await recordAuditLog(
        {
          action: "platform_queue_failed" as any,
          actorId: "system",
          actorEmail: "system",
          actorName: "System",
          targetType: "queue",
          targetId: queueName,
          metadata: meta
        },
        prisma
      );
    } catch {
      // ignore audit failures
    }
  };
}

const mailWorker = new Worker("mail", async () => true, { connection }); // dummy to attach events
const webhookWorker = new Worker("webhook", async () => true, { connection });
const opsWorker = new Worker("ops", async () => true, { connection });

[mailWorker, webhookWorker, opsWorker].forEach((w) => {
  w.on("failed", onFailed(w.name));
});

// eslint-disable-next-line no-console
console.log("Worker started with Redis:", env.REDIS_URL);
