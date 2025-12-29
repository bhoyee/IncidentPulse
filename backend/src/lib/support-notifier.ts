import { prisma } from "./db";
import { enqueueMail } from "./queues";
import { env } from "../env";

function trimMessage(input?: string | null, max = 800): string | undefined {
  if (!input) return undefined;
  const cleaned = input.trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSupportEmailBody(options: {
  orgName: string;
  subject: string;
  priority?: string;
  status?: string;
  openedBy?: string;
  message?: string;
  link: string;
  note?: string;
}) {
  const lines = [
    `${options.orgName} support ticket update`,
    `Subject: ${options.subject}`,
    `Priority: ${options.priority ?? "medium"}`,
    `Status: ${options.status ?? "open"}`
  ];

  if (options.openedBy) {
    lines.push(`Opened by: ${options.openedBy}`);
  }

  if (options.message) {
    lines.push("", "Last message:", options.message);
  }

  if (options.note) {
    lines.push("", options.note);
  }

  lines.push("", `View ticket: ${options.link}`);
  return lines.join("\n");
}

function buildSupportEmailHtml(options: {
  orgName: string;
  subject: string;
  priority?: string;
  status?: string;
  openedBy?: string;
  message?: string;
  link: string;
  headline?: string;
  note?: string;
}) {
  const rows = [
    ["Subject", options.subject],
    ["Priority", options.priority ?? "medium"],
    ["Status", options.status ?? "open"]
  ];
  if (options.openedBy) {
    rows.push(["Opened by", options.openedBy]);
  }

  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">${escapeHtml(
            label
          )}</td>
          <td style="padding:8px 12px;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(
            value
          )}</td>
        </tr>`
    )
    .join("");

  const messageBlock = options.message
    ? `<div style="margin-top:16px;padding:12px 14px;border-radius:12px;background:#f1f5f9;">
        <div style="font-size:12px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.08em;">Latest message</div>
        <p style="margin:8px 0 0;color:#0f172a;font-size:14px;white-space:pre-line;">${escapeHtml(
          options.message
        )}</p>
      </div>`
    : "";

  const noteBlock = options.note
    ? `<p style="margin:16px 0 0;color:#475569;font-size:14px;">${escapeHtml(options.note)}</p>`
    : "";

  return `
  <div style="background:#f8fafc;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:24px;">
      <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.1em;">IncidentPulse Support</div>
      <h1 style="margin:8px 0 0;font-size:20px;color:#0f172a;">${escapeHtml(
        options.headline ?? `${options.orgName} support update`
      )}</h1>
      <p style="margin:6px 0 0;color:#64748b;font-size:14px;">${escapeHtml(options.orgName)}</p>
      <table style="width:100%;margin-top:16px;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;">
        ${rowHtml}
      </table>
      ${messageBlock}
      ${noteBlock}
      <div style="margin-top:20px;">
        <a href="${options.link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600;font-size:14px;">View ticket</a>
      </div>
    </div>
  </div>`;
}

function buildDashboardLink(ticketId: string, tab = "support") {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  return `${base}/dashboard?tab=${tab}&ticket=${ticketId}`;
}

function buildReplyTo(ticketId: string): string | undefined {
  if (!env.SUPPORT_REPLY_TO_ADDRESS) return undefined;
  const address = env.SUPPORT_REPLY_TO_ADDRESS.trim();
  if (!address.includes("+")) {
    return address;
  }
  const [localPart, domain] = address.split("@");
  if (!domain) return address;
  const [base, suffix = ""] = localPart.split("+");
  const plusPart = suffix ? `${ticketId}-${suffix}` : ticketId;
  return `${base}+${plusPart}@${domain}`;
}

async function getOrgAdminEmails(orgId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId, role: "admin" },
    select: { user: { select: { email: true, isActive: true } } }
  });
  const emails = memberships
    .map((m) => m.user?.email)
    .filter((e): e is string => Boolean(e));
  return Array.from(new Set(emails));
}

async function getSuperAdminEmails(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isSuperAdmin: true, isActive: true },
    select: { email: true }
  });
  const emails = users.map((u) => u.email).filter((e): e is string => Boolean(e));
  return Array.from(new Set(emails));
}

export async function notifySupportTicketCreated(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      organization: { select: { name: true } },
      createdBy: { select: { name: true, email: true } }
    }
  });
  if (!ticket) return;

  const superAdmins = await getSuperAdminEmails();
  const creatorEmail = ticket.createdBy?.email?.toLowerCase() ?? null;
  const to = Array.from(
    new Set(
      superAdmins
        .filter(Boolean)
        .map((e) => e.toLowerCase())
        .filter((e) => e && e !== creatorEmail)
    )
  );
  if (to.length === 0) return;

  const orgName = ticket.organization?.name ?? "Workspace";
  const openedBy = ticket.createdBy?.name ?? ticket.createdBy?.email ?? "User";
  const link = buildDashboardLink(ticket.id, "support");
  const replyTo = buildReplyTo(ticket.id);

  if (to.length === 0) {
    // eslint-disable-next-line no-console
    console.warn("[support ticket] no recipients for ticket create", { ticketId, orgName });
    return;
  }

  const enqueueResult = await enqueueMail({
    to,
    subject: `[Support #${ticket.id}] ${orgName}: ${ticket.subject}`,
    text: buildSupportEmailBody({
      orgName,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      openedBy,
      message: trimMessage(ticket.body),
      link
    }),
    html: buildSupportEmailHtml({
      orgName,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      openedBy,
      message: trimMessage(ticket.body),
      link
    }),
    replyTo
  });

  if (!enqueueResult) {
    // eslint-disable-next-line no-console
    console.warn("[support ticket] enqueueMail returned null (create)", {
      ticketId,
      recipients: to
    });
  } else {
    // eslint-disable-next-line no-console
    console.log("[support ticket] queued create email", { ticketId, recipients: to });
  }
}

export async function notifySupportComment(
  ticketId: string,
  recipientEmail?: string | null,
  message?: string | null
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      priority: true,
      status: true,
      organizationId: true,
      organization: { select: { name: true } }
    }
  });
  if (!ticket) return;
  if (!recipientEmail) return;

  const orgName = ticket.organization?.name ?? "Workspace";
  const link = buildDashboardLink(ticketId, "support");
  const replyTo = buildReplyTo(ticketId);

  const enqueueResult = await enqueueMail({
    to: recipientEmail,
    subject: `[Support #${ticketId}] New comment: ${ticket.subject}`,
    text: buildSupportEmailBody({
      orgName,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      message: trimMessage(message),
      link
    }),
    html: buildSupportEmailHtml({
      orgName,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      message: trimMessage(message),
      link
    }),
    replyTo
  });

  if (!enqueueResult) {
    // eslint-disable-next-line no-console
    console.warn("[support ticket] enqueueMail returned null (comment)", {
      ticketId,
      recipient: recipientEmail
    });
  } else {
    // eslint-disable-next-line no-console
    console.log("[support ticket] queued comment email", { ticketId, recipient: recipientEmail });
  }
}

export async function notifySupportAssignment(
  ticketId: string,
  assigneeEmail?: string | null,
  options?: { tab?: string; orgName?: string; subject?: string; priority?: string; status?: string }
) {
  if (!assigneeEmail) return;
  const link = buildDashboardLink(ticketId, options?.tab ?? "platformSupport");
  const orgName = options?.orgName ?? "Workspace";
  const subject = options?.subject ?? `Ticket ${ticketId}`;
  const priority = options?.priority;
  const status = options?.status;

  await enqueueMail({
    to: assigneeEmail,
    subject: `[Support #${ticketId}] Assigned to you: ${subject}`,
    text: buildSupportEmailBody({
      orgName,
      subject,
      priority,
      status,
      message: "This ticket has been assigned to you. Please review and respond.",
      link
    }),
    html: buildSupportEmailHtml({
      orgName,
      subject,
      priority,
      status,
      message: "This ticket has been assigned to you. Please review and respond.",
      link,
      headline: "Ticket assigned to you"
    })
  });
}

export async function notifySupportTicketClosed(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      priority: true,
      status: true,
      body: true,
      organizationId: true,
      organization: { select: { name: true } },
      createdBy: { select: { email: true, name: true } }
    }
  });
  if (!ticket?.createdBy?.email) return;

  const orgName = ticket.organization?.name ?? "Workspace";
  const link = buildDashboardLink(ticketId, "support");
  const note =
    "We’ve closed this ticket. If you have any further questions, please reopen the ticket or create a new one.";

  await enqueueMail({
    to: ticket.createdBy.email,
    subject: `[Support #${ticketId}] Ticket closed: ${ticket.subject}`,
    text: buildSupportEmailBody({
      orgName,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      openedBy: ticket.createdBy.name ?? ticket.createdBy.email,
      message: undefined,
      link,
      note
    }),
    html: buildSupportEmailHtml({
      orgName,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      openedBy: ticket.createdBy.name ?? ticket.createdBy.email,
      message: undefined,
      link,
      headline: "Ticket closed",
      note
    })
  });
}
