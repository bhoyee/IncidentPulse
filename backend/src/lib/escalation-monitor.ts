import type { FastifyInstance } from "fastify";
import { env } from "../env";
import { prisma } from "./db";
import { enqueueMail } from "./queues";

const ESCALATION_WINDOW_MS = env.INCIDENT_ESCALATION_MINUTES * 60 * 1000;
const POLL_INTERVAL_MS = env.INCIDENT_ESCALATION_POLL_SECONDS * 1000;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function registerIncidentEscalationWatcher(fastify: FastifyInstance) {
  let isRunning = false;

  const runCheck = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const cutoff = new Date(Date.now() - ESCALATION_WINDOW_MS);

      const incidents = await prisma.incident.findMany({
        where: {
          createdAt: {
            lte: cutoff
          },
          firstResponseAt: null,
          escalationNotifiedAt: null,
          status: {
            in: ["open", "investigating"]
          }
        },
        include: {
          createdBy: {
            select: {
              name: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });

      if (incidents.length === 0) {
        return;
      }

      const admins = await prisma.user.findMany({
        where: {
          role: "admin",
          isActive: true
        },
        select: {
          name: true,
          email: true
        }
      });

      if (admins.length === 0) {
        fastify.log.warn("Incident escalation watcher: no active admins found to notify");
        return;
      }

      const adminEmails = admins.map((admin) => admin.email);
      const notificationTimestamp = new Date();
      const notifiedIncidentIds: string[] = [];

      for (const incident of incidents) {
        const assignedSummary = incident.assignedTo
          ? `${incident.assignedTo.name} (${incident.assignedTo.email})`
          : "Unassigned";
        const creatorSummary = `${incident.createdBy.name} (${incident.createdBy.email})`;
        const createdAtLocal = incident.createdAt.toISOString();

        const subject = `[IncidentPulse] No response yet for incident "${incident.title}"`;

        const textBody = [
          `Incident "${incident.title}" has not received a first response within ${env.INCIDENT_ESCALATION_MINUTES} minutes.`,
          "",
          `Severity: ${incident.severity}`,
          `Status: ${incident.status}`,
          `Created at: ${createdAtLocal}`,
          `Created by: ${creatorSummary}`,
          `Assigned to: ${assignedSummary}`,
          "",
          `Description:`,
          incident.description,
          "",
          `Please ensure this incident receives attention as soon as possible.`
        ].join("\n");

        const htmlBody = `
          <p>Incident <strong>${incident.title}</strong> has not received a first response within <strong>${env.INCIDENT_ESCALATION_MINUTES} minutes</strong>.</p>
          <ul>
            <li><strong>Severity:</strong> ${incident.severity}</li>
            <li><strong>Status:</strong> ${incident.status}</li>
            <li><strong>Created at:</strong> ${createdAtLocal}</li>
            <li><strong>Created by:</strong> ${creatorSummary}</li>
            <li><strong>Assigned to:</strong> ${assignedSummary}</li>
          </ul>
          <p><strong>Description</strong></p>
          <p>${escapeHtml(incident.description).replace(/\n/g, "<br />")}</p>
          <p>Please ensure this incident receives attention as soon as possible.</p>
        `;

        try {
          await enqueueMail({
            to: adminEmails,
            subject,
            text: textBody,
            html: htmlBody
          });
          notifiedIncidentIds.push(incident.id);
          fastify.log.info(
            {
              incidentId: incident.id,
              recipients: adminEmails
            },
            "Sent escalation notification email"
          );
        } catch (error) {
          fastify.log.error(
            {
              err: error,
              incidentId: incident.id
            },
            "Failed to send escalation notification email"
          );
        }
      }

      if (notifiedIncidentIds.length > 0) {
        await prisma.incident.updateMany({
          where: {
            id: {
              in: notifiedIncidentIds
            }
          },
          data: {
            escalationNotifiedAt: notificationTimestamp
          }
        });
      }
    } catch (error) {
      fastify.log.error({ err: error }, "Incident escalation watcher failed");
    } finally {
      isRunning = false;
    }
  };

  fastify.addHook("onReady", async () => {
    fastify.log.info(
      {
        escalationMinutes: env.INCIDENT_ESCALATION_MINUTES,
        pollIntervalSeconds: env.INCIDENT_ESCALATION_POLL_SECONDS
      },
      "Starting incident escalation watcher"
    );

    await runCheck();
    const timer = setInterval(() => {
      void runCheck();
    }, POLL_INTERVAL_MS);

    fastify.addHook("onClose", async () => {
      clearInterval(timer);
    });
  });
}
