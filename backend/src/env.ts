import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  FRONTEND_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().min(1),
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
