import { Resend } from "resend";

export type EmailAttachment = { filename: string; content: string; contentType: string };
export type Email = { to: string; subject: string; html: string; text: string; attachments?: EmailAttachment[] };

/**
 * Sends through Resend when RESEND_API_KEY is set. Without a key (local dev,
 * end-to-end tests) the email is printed to the server console instead, so
 * every flow can be clicked through with no third-party account.
 */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Production must not silently drop emails; end-to-end tests opt in to console output.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_CONSOLE_EMAIL !== "true") {
      throw new Error("RESEND_API_KEY is not set");
    }
    const files = email.attachments?.map((a) => a.filename).join(", ");
    console.info(`\n[email] to=${email.to} subject="${email.subject}"${files ? ` attachments=${files}` : ""}\n${email.text}\n`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "Slotwise <onboarding@resend.dev>";
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString("base64"),
      contentType: a.contentType,
    })),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

/** Public origin for links in emails and webhooks, where there's no browser request to read it from. */
export function appUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
