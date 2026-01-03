import "dotenv/config";
import { z } from "zod";

// Provide sensible defaults in test mode so Jest can bootstrap without a full .env.
if (process.env.NODE_ENV === "test") {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ||
    "test-jwt-secret-should-be-at-least-32-characters-long-123456";
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
  process.env.COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "localhost";
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-resend-key";
  process.env.SMTP_FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS || "demo@example.com";
  process.env.SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "IncidentPulse";
  process.env.WEBHOOK_HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || "demo-hmac-secret";
  process.env.WEBHOOK_SHARED_TOKEN = process.env.WEBHOOK_SHARED_TOKEN || "demo-token";
  process.env.WEBHOOK_SYSTEM_USER_ID =
    process.env.WEBHOOK_SYSTEM_USER_ID || "00000000-0000-0000-0000-000000000000";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/incidentpulse?schema=public";
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  FRONTEND_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  SMTP_FROM_ADDRESS: z.string().email("SMTP_FROM_ADDRESS must be a valid email"),
  SMTP_FROM_NAME: z.string().min(1, "SMTP_FROM_NAME is required"),
  WEBHOOK_HMAC_SECRET: z.string().min(1, "WEBHOOK_HMAC_SECRET is required"),
  WEBHOOK_SHARED_TOKEN: z.string().min(1).optional(),
  WEBHOOK_SYSTEM_USER_ID: z.string().uuid().optional(),
  INCIDENT_ESCALATION_MINUTES: z.coerce.number().int().positive().default(15),
  INCIDENT_ESCALATION_POLL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),
  STRIPE_PORTAL_RETURN_URL: z.string().url().optional(),
  STRIPE_TEST_CUSTOMER_ID: z.string().optional(),
  STRIPE_CHECKOUT_PRO_URL: z.string().url().optional(),
  STRIPE_CHECKOUT_ENTERPRISE_URL: z.string().url().optional(),
  SUPPORT_INBOUND_SECRET: z.string().optional(),
  SUPPORT_REPLY_TO_ADDRESS: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  LOG_BUFFER_TTL_MS: z.coerce.number().int().positive().optional(), // default 10 minutes
  LOG_TRIGGER_WINDOW_MS: z.coerce.number().int().positive().optional(), // default 60s
  LOG_TRIGGER_ERROR_THRESHOLD: z.coerce.number().int().positive().optional(), // default 20
  LOG_TRIGGER_COOLDOWN_MS: z.coerce.number().int().positive().optional(), // default 5 minutes
  AI_LOG_SUMMARY_ENABLED: z
    .preprocess((value) => {
      if (value === undefined) return false;
      if (typeof value === "boolean") return value;
      const normalized = String(value).toLowerCase().trim();
      return ["1", "true", "yes", "y"].includes(normalized);
    }, z.boolean())
    .optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  MULTI_TENANT_ENABLED: z.preprocess((value) => {
    if (value === undefined) return false;
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase().trim();
    return ["1", "true", "yes", "y"].includes(normalized);
  }, z.boolean()),
  // Comma-separated list of demo emails that should be treated as read-only.
  DEMO_USER_EMAILS: z.string().optional(),
  PORT: z
    .string()
    .optional()
    .default("4000")
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().positive())
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
