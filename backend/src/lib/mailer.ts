import { Resend } from "resend";
import { env } from "../env";

const resend = new Resend(env.RESEND_API_KEY);

type MailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail({ to, subject, text, html }: MailOptions) {
  const recipients = Array.isArray(to) ? to : [to];

  const response = await resend.emails.send({
    from: `${env.SMTP_FROM_NAME} <${env.SMTP_FROM_ADDRESS}>`,
    to: recipients,
    subject,
    text,
    html: html ?? text
  });

  if (response.error) {
    throw new Error(response.error.message ?? "Failed to send email via Resend");
  }
}
