import { prisma } from "./db";

async function lookupCountry(ip?: string | null): Promise<string | null> {
  if (!ip) return null;
  try {
    const url = process.env.GEOIP_LOOKUP_URL || `http://ip-api.com/json/${ip}?fields=country`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { country?: string };
    return json?.country ?? null;
  } catch {
    return null;
  }
}

export async function recordPublicVisit(path: string, ip?: string, userAgent?: string) {
  try {
    const country = await lookupCountry(ip);
    await (prisma as any).publicVisit.create({
      data: {
        path,
        ip: ip ?? null,
        userAgent: userAgent?.slice(0, 255) ?? null,
        country
      }
    });
  } catch (err) {
    // swallow errors to avoid impacting user
    console.warn("Failed to record public visit", err);
  }
}
