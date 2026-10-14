import { Resend } from "resend";

type Email = { to: string; subject: string; html: string; text: string };

/**
 * Sends through Resend when RESEND_API_KEY is set. Without a key (local dev,
 * CI) the email is printed to the server console instead, so every flow can
 * be clicked through with no third-party account.
 */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.info(`\n[email] to=${email.to} subject="${email.subject}"\n${email.text}\n`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "Slotwise <onboarding@resend.dev>";
  const { error } = await new Resend(apiKey).emails.send({ from, ...email });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
