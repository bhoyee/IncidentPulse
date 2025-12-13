// Provide minimal env defaults so env.ts validation passes during tests.
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "test-jwt-secret-should-be-at-least-32-characters-long-123456";
process.env.PORT = process.env.PORT || "4000";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://incidentpulse:incidentpulse@localhost:15433/incidentpulse?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
process.env.COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "localhost";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-resend-key";
process.env.SMTP_FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS || "demo@example.com";
process.env.SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "IncidentPulse";
process.env.WEBHOOK_HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || "demo-hmac-secret";
process.env.WEBHOOK_SHARED_TOKEN = process.env.WEBHOOK_SHARED_TOKEN || "demo-token";
process.env.WEBHOOK_SYSTEM_USER_ID =
  process.env.WEBHOOK_SYSTEM_USER_ID || "00000000-0000-0000-0000-000000000000";

// Keep NODE_ENV=test so env.ts test defaults also apply.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
