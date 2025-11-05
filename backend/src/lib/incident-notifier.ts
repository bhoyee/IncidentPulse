import type { FastifyBaseLogger } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { env } from "../env";

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
  const description = incident.description?.trim();
  const incidentUrl = `${env.FRONTEND_URL}/dashboard?incidentId=${incident.id}`;

  const textLines = [
    "A new incident was reported and requires review.",
    "",
    `Title: ${incident.title}`,
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
  const textLines = [
    `You have been assigned to incident "${incident.title}".`,
    "",
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
