import type { FastifyBaseLogger } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { env } from "../env";
import { getIntegrationSettings } from "./integration-settings";

export const incidentNotificationInclude = {
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
  const settings = await getIntegrationSettings();
  if (!settings) {
    return;
  }

  await Promise.allSettled([
    sendSlackNotification(logger, settings.slackWebhookUrl, incident, event, metadata),
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

