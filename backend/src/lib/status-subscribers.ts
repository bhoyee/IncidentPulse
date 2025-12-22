import { prisma } from "./db";
import { randomBytes } from "crypto";
import { sendMail } from "./mailer";
import { env } from "../env";

const maintenanceSendCache = new Map<string, number>();

export type SubscriberCreateInput = {
  organizationId: string;
  email: string;
  serviceIds?: string[] | null;
  verifyNow?: boolean;
  skipEmail?: boolean;
};

function makeToken(): string {
  return randomBytes(24).toString("hex");
}

export async function createSubscriber(input: SubscriberCreateInput) {
  const token = makeToken();
  const serviceIds = input.serviceIds && input.serviceIds.length ? input.serviceIds : null;
    const normalizedEmail = input.email.toLowerCase();
  const existing = await (prisma as any).statusSubscriber.findFirst({
    where: { organizationId: input.organizationId, email: normalizedEmail }
  });

  let subscriber;
  if (existing) {
    subscriber = await (prisma as any).statusSubscriber.update({
      where: { id: existing.id },
      data: {
        serviceIds,
        verificationToken: input.verifyNow ? null : token,
        verifiedAt: input.verifyNow ? new Date() : existing.verifiedAt ?? null
      }
    });
  } else {
    subscriber = await (prisma as any).statusSubscriber.create({
      data: {
        organizationId: input.organizationId,
        email: normalizedEmail,
        serviceIds,
        verificationToken: input.verifyNow ? null : token,
        verifiedAt: input.verifyNow ? new Date() : null
      }
    });
  }

  if (!input.verifyNow && !input.skipEmail) {
    const verifyUrl = `${env.FRONTEND_URL}/public/status/verify?token=${token}`;
    await sendMail({
      to: subscriber.email,
      subject: "Confirm your status subscription",
      text: `Please confirm your subscription to status updates.\n\nConfirm: ${verifyUrl}\n\nIf you did not request this, you can ignore this email.`
    });
  }

  return subscriber;
}

export async function verifySubscriber(token: string) {
  const subscriber = await (prisma as any).statusSubscriber.findFirst({
    where: { verificationToken: token }
  });
  if (!subscriber) return null;

  return (prisma as any).statusSubscriber.update({
    where: { id: subscriber.id },
    data: {
      verifiedAt: new Date(),
      verificationToken: null
    }
  });
}

export async function unsubscribeSubscriber(token: string) {
  const subscriber = await (prisma as any).statusSubscriber.findFirst({
    where: { verificationToken: token }
  });
  if (!subscriber) return null;
  return (prisma as any).statusSubscriber.delete({ where: { id: subscriber.id } });
}

export async function listSubscribersForOrg(organizationId: string) {
  return (prisma as any).statusSubscriber.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getVerifiedSubscribersForOrg(organizationId: string) {
  return (prisma as any).statusSubscriber.findMany({
    where: { organizationId, verifiedAt: { not: null } }
  });
}

export async function notifyMaintenanceSubscribers(
  logger: { error: Function },
  maintenance: {
    id: string;
    title: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    appliesToAll: boolean;
    serviceId?: string | null;
    organizationId: string;
    description?: string | null;
  }
) {
  const cacheKey = `maint:${maintenance.id}:${maintenance.status}`;
  const now = Date.now();
  const last = maintenanceSendCache.get(cacheKey);
  if (last && now - last < 30 * 60 * 1000) return;
  maintenanceSendCache.set(cacheKey, now);

  try {
    const org = await prisma.organization.findUnique({
      where: { id: maintenance.organizationId },
      select: { id: true, name: true, slug: true }
    });
    if (!org) return;

    const subs = await getVerifiedSubscribersForOrg(org.id);
    const filtered =
      maintenance.appliesToAll || !maintenance.serviceId
        ? subs
        : filterSubscribersForService(subs, maintenance.serviceId);
    if (!filtered.length) return;

    const serviceName = maintenance.serviceId
      ? await prisma.service
          .findUnique({ where: { id: maintenance.serviceId }, select: { name: true } })
          .then((s) => s?.name)
      : null;

    const statusUrl = `${env.FRONTEND_URL}/status?orgSlug=${org.slug}`;
    const statusLabel = maintenance.status.replace("_", " ");
    const windowText = `${maintenance.startsAt.toISOString()} — ${maintenance.endsAt.toISOString()}`;
    const servicesLine = maintenance.appliesToAll
      ? "Services: All services"
      : serviceName
        ? `Service: ${serviceName}`
        : maintenance.serviceId
          ? `Service ID: ${maintenance.serviceId}`
          : undefined;

    const lines = [
      `Maintenance: ${maintenance.title}`,
      `Status: ${statusLabel}`,
      `Window: ${windowText}`,
      servicesLine,
      maintenance.description ? `Details: ${maintenance.description}` : undefined,
      "",
      `View status page: ${statusUrl}`
    ].filter(Boolean);

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; padding:16px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:18px;font-weight:800;">${org.name}</div>
            <span style="padding:6px 10px;border-radius:20px;background:#0ea5e9;color:#0b1727;font-weight:700;text-transform:capitalize;">
              ${statusLabel}
            </span>
          </div>
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${maintenance.title}</h2>
          <p style="margin:0 0 12px;font-size:14px;color:#1f2937;">Scheduled maintenance update.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
            <tbody>
              <tr>
                <td style="padding:6px 0;font-weight:700;width:120px;">Window</td>
                <td style="padding:6px 0;">${windowText}</td>
              </tr>
              ${
                servicesLine
                  ? `<tr><td style="padding:6px 0;font-weight:700;">Services</td><td style="padding:6px 0;">${servicesLine.replace(
                      "Services: ",
                      ""
                    )}</td></tr>`
                  : ""
              }
              ${
                maintenance.description
                  ? `<tr><td style="padding:6px 0;font-weight:700;">Details</td><td style="padding:6px 0;">${maintenance.description}</td></tr>`
                  : ""
              }
            </tbody>
          </table>
          <div style="margin-top:16px;">
            <a href="${statusUrl}" style="display:inline-block;padding:10px 14px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
              View status page
            </a>
          </div>
        </div>
        <p style="text-align:center;font-size:12px;color:#6b7280;margin-top:10px;">You are receiving this because you subscribed to ${org.name} status updates.</p>
      </div>
    `;

    await sendMail({
      to: filtered.map((s: any) => s.email),
      subject: `[${org.name}] Maintenance ${statusLabel}: ${maintenance.title}`,
      text: lines.join("\n"),
      html
    });
  } catch (err) {
    logger.error({ err }, "Failed to notify maintenance subscribers");
  }
}
export function filterSubscribersForService(
  subs: { serviceIds: unknown }[],
  serviceId: string
) {
  return subs.filter((s) => {
    const svcIds = Array.isArray(s.serviceIds) ? (s.serviceIds as string[]) : null;
    if (!svcIds || svcIds.length === 0) return true;
    return svcIds.includes(serviceId);
  });
}

