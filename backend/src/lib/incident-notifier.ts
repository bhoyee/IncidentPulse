import type { FastifyBaseLogger } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { env } from "../env";
import { DEFAULT_ORG_ID } from "./org";
import { getIntegrationSettings } from "./integration-settings";
import {
  filterSubscribersForService,
  getVerifiedSubscribersForOrg
} from "./status-subscribers";

const subscriberSendCache = new Map<string, number>();
function canSendSubscriberEmail(key: string, ttlMs = 30 * 60 * 1000) {
  const now = Date.now();
  const last = subscriberSendCache.get(key);
  if (last && now - last < ttlMs) return false;
  subscriberSendCache.set(key, now);
  return true;
}

export const incidentNotificationInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamRoles: true
    }
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamRoles: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.IncidentInclude;

export type IncidentNotificationContext = Prisma.IncidentGetPayload<{
  include: typeof incidentNotificationInclude;
}>;

export type AdminRecipient = {
  id: string;
  email: string;
  name: string | null;
};

export async function loadActiveAdmins(): Promise<AdminRecipient[]> {
  return prisma.user.findMany({
    where: {
      role: "admin",
      isActive: true
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  });
}

export async function notifyAdminsOfIncident(
  logger: FastifyBaseLogger,
  incident: IncidentNotificationContext,
  admins?: AdminRecipient[]
): Promise<AdminRecipient[]> {
  const recipients = admins ?? (await loadActiveAdmins());

  if (recipients.length === 0) {
    logger.warn(
      { incidentId: incident.id },
      "Incident created but no active admins available for notification"
    );
    return recipients;
  }

  const adminEmails = recipients.map((admin) => admin.email);
  const reporterName =
    incident.createdBy?.name ?? incident.createdBy?.email ?? "Unknown reporter";
  const serviceName = incident.service?.name ?? "Unassigned service";
  const description = incident.description?.trim();
  const incidentUrl = `${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`;

  const textLines = [
    "A new incident was reported and requires review.",
    "",
    `Title: ${incident.title}`,
    `Service: ${serviceName}`,
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Reported by: ${reporterName}`,
    "",
    `Review the incident: ${incidentUrl}`
  ];

  if (description) {
    textLines.push("", `Description:\n${description}`);
  }

  try {
    await sendMail({
      to: adminEmails,
      subject: `New incident reported: ${incident.title}`,
      text: textLines.join("\n")
    });
    logger.info(
      { incidentId: incident.id, recipients: adminEmails },
      "Sent admin notification for new incident"
    );
  } catch (error) {
    logger.error(
      { err: error, incidentId: incident.id },
      "Failed to send admin incident notification"
    );
  }

  return recipients;
}

export async function notifyAssigneeOfAssignment(
  logger: FastifyBaseLogger,
  incident: IncidentNotificationContext,
  assignedBy: string
): Promise<void> {
  if (!incident.assignedTo?.email) {
    return;
  }

  const description = incident.description?.trim();
  const serviceName = incident.service?.name ?? "Unassigned service";
  const textLines = [
    `You have been assigned to incident "${incident.title}".`,
    "",
    `Service: ${serviceName}`,
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    "",
    `Assigned by: ${assignedBy}`
  ];

  if (description) {
    textLines.push("", `Summary:\n${description}`);
  }

  textLines.push("", `Review the incident: ${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`);

  try {
    await sendMail({
      to: incident.assignedTo.email,
      subject: `Incident assigned: ${incident.title}`,
      text: textLines.join("\n")
    });
    logger.info(
      { incidentId: incident.id, assignee: incident.assignedTo.email },
      "Sent incident assignment notification"
    );
  } catch (error) {
    logger.error(
      { err: error, incidentId: incident.id, assignee: incident.assignedTo.email },
      "Failed to send incident assignment notification"
    );
  }
}

export async function notifyAssigneeOfResolution(
  logger: FastifyBaseLogger,
  incident: IncidentNotificationContext,
  resolvedAt: Date
): Promise<void> {
  if (!incident.assignedTo?.email) {
    return;
  }

  const description = incident.description?.trim();
  const textLines = [
    `Good news — the incident "${incident.title}" has been resolved.`,
    "",
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Resolved at: ${resolvedAt.toISOString()}`,
    "",
    `Reported by: ${incident.createdBy?.name ?? incident.createdBy?.email ?? "Unknown reporter"}`
  ];

  if (description) {
    textLines.push("", `Summary:\n${description}`);
  }

  textLines.push(
    "",
    "You were listed as the owner. No further action is required unless stakeholders need a follow-up."
  );

  try {
    await sendMail({
      to: incident.assignedTo.email,
      subject: `Incident resolved: ${incident.title}`,
      text: textLines.join("\n")
    });
    logger.info(
      { incidentId: incident.id, assignee: incident.assignedTo.email },
      "Sent incident resolution notification"
    );
  } catch (error) {
    logger.error(
      { err: error, incidentId: incident.id, assignee: incident.assignedTo.email },
      "Failed to send incident resolution notification"
    );
  }
}

type IntegrationEvent = "created" | "assigned" | "resolved";

type IntegrationMetadata = {
  assignedBy?: string;
  resolutionTime?: Date;
};

export async function notifyIncidentIntegrations(
  logger: FastifyBaseLogger,
  incident: IncidentNotificationContext,
  event: IntegrationEvent,
  metadata: IntegrationMetadata = {}
): Promise<void> {
  const orgId = incident.organization?.id ?? DEFAULT_ORG_ID;
  const settings = await getIntegrationSettings(orgId);
  if (!settings) {
    return;
  }

  await Promise.allSettled([
    sendSlackNotification(logger, settings.slackWebhookUrl, incident, event, metadata),
    sendDiscordNotification(logger, settings.discordWebhookUrl, incident, event, metadata),
    sendTeamsNotification(logger, settings.teamsWebhookUrl, incident, event, metadata),
    sendTelegramNotification(
      logger,
      settings.telegramBotToken,
      settings.telegramChatId,
      incident,
      event,
      metadata
    )
  ]);
}

export async function notifyStatusSubscribers(
  logger: FastifyBaseLogger,
  incident: IncidentNotificationContext,
  event: "created" | "resolved" | "updated"
): Promise<void> {
  const orgId = incident.organization?.id ?? DEFAULT_ORG_ID;
  const cacheKey = `${incident.id}:${event}`;
  if (!canSendSubscriberEmail(cacheKey)) return;
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true }
    });
    if (!org) return;

    const subs = await getVerifiedSubscribersForOrg(org.id);
    const filtered: { email: string; serviceIds?: unknown }[] = incident.service?.id
      ? filterSubscribersForService(subs, incident.service.id)
      : subs;
    if (!filtered.length) return;

    const statusUrl = `${env.FRONTEND_URL}/status?orgSlug=${org.slug}`;
    const subject = `[${org.name}] Incident ${event}: ${incident.title}`;
    const lines = [
      `Incident: ${incident.title}`,
      `Service: ${incident.service?.name ?? "Unassigned service"}`,
      `Severity: ${incident.severity}`,
      `Status: ${incident.status}`,
      event === "resolved" && incident.resolvedAt
        ? `Resolved at: ${incident.resolvedAt.toISOString()}`
        : undefined,
      incident.rootCause ? `Root cause: ${incident.rootCause}` : undefined,
      incident.resolutionSummary ? `Resolution: ${incident.resolutionSummary}` : undefined,
      "",
      `View status page: ${statusUrl}`
    ].filter(Boolean);

    await sendMail({
      to: filtered.map((s) => s.email),
      subject,
      text: lines.join("\n")
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to notify subscribers");
  }
}

async function sendSlackNotification(
  logger: FastifyBaseLogger,
  webhookUrl: string | null | undefined,
  incident: IncidentNotificationContext,
  event: IntegrationEvent,
  metadata: IntegrationMetadata
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  const link = `${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`;
  const title = `[${incident.severity.toUpperCase()}] ${incident.title}`;
  const statusLine = `Status: ${incident.status}`;
  const body = buildIntegrationMessage(event, incident, metadata);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${title}*\n${statusLine}\n${body}\n<${link}|Open in IncidentPulse>`
      })
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, incidentId: incident.id },
        "Slack notification failed"
      );
    }
  } catch (error) {
    logger.error({ err: error, incidentId: incident.id }, "Slack notification threw error");
  }
}

async function sendDiscordNotification(
  logger: FastifyBaseLogger,
  webhookUrl: string | null | undefined,
  incident: IncidentNotificationContext,
  event: IntegrationEvent,
  metadata: IntegrationMetadata
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  const link = `${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`;
  const title = `[${incident.severity.toUpperCase()}] ${incident.title}`;
  const statusLine = `Status: ${incident.status}`;
  const body = buildIntegrationMessage(event, incident, metadata);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**${title}**\n${statusLine}\n${body}\n${link}`
      })
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, incidentId: incident.id },
        "Discord notification failed"
      );
    }
  } catch (error) {
    logger.error({ err: error, incidentId: incident.id }, "Discord notification threw error");
  }
}

async function sendTeamsNotification(
  logger: FastifyBaseLogger,
  webhookUrl: string | null | undefined,
  incident: IncidentNotificationContext,
  event: IntegrationEvent,
  metadata: IntegrationMetadata
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  const link = `${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`;
  const title = `[${incident.severity.toUpperCase()}] ${incident.title}`;
  const statusLine = `Status: ${incident.status}`;
  const body = buildIntegrationMessage(event, incident, metadata);
  const color = severityToTeamsColor(incident.severity);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        themeColor: color,
        summary: title,
        title,
        text: `${statusLine}\n\n${body}\n\n[Open IncidentPulse](${link})`
      })
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, incidentId: incident.id },
        "Teams notification failed"
      );
    }
  } catch (error) {
    logger.error({ err: error, incidentId: incident.id }, "Teams notification threw error");
  }
}

async function sendTelegramNotification(
  logger: FastifyBaseLogger,
  botToken: string | null | undefined,
  chatId: string | null | undefined,
  incident: IncidentNotificationContext,
  event: IntegrationEvent,
  metadata: IntegrationMetadata
): Promise<void> {
  if (!botToken || !chatId) {
    return;
  }

  const link = `${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`;
  const title = `[${incident.severity.toUpperCase()}] ${incident.title}`;
  const statusLine = `Status: ${incident.status}`;
  const body = buildIntegrationMessage(event, incident, metadata);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `${title}\n${statusLine}\n${body}\n${link}`
        })
      }
    );

    if (!response.ok) {
      logger.error(
        { status: response.status, incidentId: incident.id },
        "Telegram notification failed"
      );
    }
  } catch (error) {
    logger.error({ err: error, incidentId: incident.id }, "Telegram notification threw error");
  }
}

function buildIntegrationMessage(
  event: IntegrationEvent,
  incident: IncidentNotificationContext,
  metadata: IntegrationMetadata
): string {
  const reporter =
    incident.createdBy?.name ?? incident.createdBy?.email ?? "Unknown reporter";
  const serviceName = incident.service?.name ?? "Unassigned service";

  switch (event) {
    case "created":
      return `Service: ${serviceName}\nReported by: ${reporter}`;
    case "assigned":
      if (incident.assignedTo) {
        return `Service: ${serviceName}\nAssigned to ${
          incident.assignedTo.name ?? incident.assignedTo.email
        } (by ${metadata.assignedBy ?? "System"})`;
      }
      return `Service: ${serviceName}\nAssignment cleared (by ${
        metadata.assignedBy ?? "System"
      })`;
    case "resolved":
      return `Service: ${serviceName}\nResolved at ${
        metadata.resolutionTime?.toISOString() ?? "now"
      } by ${incident.assignedTo?.name ?? incident.assignedTo?.email ?? "Responder"}`;
    default:
      return "";
  }
}

function severityToTeamsColor(severity: string | undefined): string {
  switch (severity) {
    case "critical":
      return "d32f2f";
    case "high":
      return "f57c00";
    case "medium":
      return "fbc02d";
    default:
      return "1976d2";
  }
}

