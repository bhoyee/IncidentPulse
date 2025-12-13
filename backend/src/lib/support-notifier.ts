import { prisma } from "./db";
import { sendMail } from "./mailer";
import { env } from "../env";

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

  const recipients = await getOrgAdminEmails(ticket.organizationId);
  if (ticket.createdBy?.email) {
    recipients.push(ticket.createdBy.email);
  }
  const superAdmins = await getSuperAdminEmails();
  recipients.push(...superAdmins);
  const to = Array.from(new Set(recipients));
  if (to.length === 0) return;

  const orgName = ticket.organization?.name ?? "Workspace";
  const openedBy = ticket.createdBy?.name ?? ticket.createdBy?.email ?? "User";
  const link = buildDashboardLink(ticket.id, "support");
  const replyTo = buildReplyTo(ticket.id);

  await sendMail({
    to,
    subject: `[Support #${ticket.id}] ${orgName}: ${ticket.subject}`,
    text: [
      `${orgName} support ticket opened`,
      `Subject: ${ticket.subject}`,
      `Priority: ${ticket.priority}`,
      `Opened by: ${openedBy}`,
      ``,
      `View ticket: ${link}`
    ].join("\n"),
    replyTo
  });
}

export async function notifySupportComment(ticketId: string, authorEmail?: string | null) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      priority: true,
      organizationId: true,
      organization: { select: { name: true } }
    }
  });
  if (!ticket) return;
  const recipients = await getOrgAdminEmails(ticket.organizationId);
  if (authorEmail) {
    recipients.push(authorEmail);
  }
  const superAdmins = await getSuperAdminEmails();
  recipients.push(...superAdmins);
  const to = Array.from(new Set(recipients));
  if (to.length === 0) return;

  const orgName = ticket.organization?.name ?? "Workspace";
  const link = buildDashboardLink(ticketId, "support");
  const replyTo = buildReplyTo(ticketId);

  await sendMail({
    to,
    subject: `[Support #${ticketId}] New comment: ${ticket.subject}`,
    text: [
      `${orgName} support ticket updated`,
      `Subject: ${ticket.subject}`,
      `Priority: ${ticket.priority}`,
      ``,
      `View ticket: ${link}`
    ].join("\n"),
    replyTo
  });
}
