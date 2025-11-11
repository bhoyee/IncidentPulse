import { env } from "../env";

// Pre-compute demo email addresses once so we can cheaply check on each request.
const demoEmailSet = new Set(
  (env.DEMO_USER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
);

export function isDemoEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  return demoEmailSet.has(email.toLowerCase());
}

export function hasDemoEmails(): boolean {
  return demoEmailSet.size > 0;
}

export function getDemoEmails(): string[] {
  return Array.from(demoEmailSet);
}
