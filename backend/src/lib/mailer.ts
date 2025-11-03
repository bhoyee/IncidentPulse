import nodemailer from "nodemailer";
import { env } from "../env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_ENCRYPTION === "ssl",
  requireTLS: env.SMTP_ENCRYPTION === "tls" || env.SMTP_ENCRYPTION === "starttls",
  auth: {
    user: env.SMTP_USERNAME,
    pass: env.SMTP_PASSWORD
  }
});

type MailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail({ to, subject, text, html }: MailOptions) {
  const normalisedRecipients = Array.isArray(to) ? to.join(",") : to;

  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_ADDRESS}>`,
    to: normalisedRecipients,
    subject,
    text,
    html: html ?? text
  });
}
