import { db } from "@/db";
import { appUrl, sendEmail } from "@/lib/email";
import { loadBookingContext } from "@/server/booking-context";
import { isAuthorizedCron } from "@/server/cron-auth";
import { reminderEmail } from "@/server/email-templates";
import { claimDueReminders, expireLapsedHolds, releaseReminder } from "@/server/reminders";

/** Called hourly by .github/workflows/cron.yml. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const expiredHolds = await expireLapsedHolds(db, now);
  const claimed = await claimDueReminders(db, now);

  let sent = 0;
  let failed = 0;
  for (const reminder of claimed) {
    try {
      const ctx = await loadBookingContext(db, reminder.bookingId);
      if (ctx) await sendEmail(reminderEmail(ctx, appUrl()));
      sent++;
    } catch (error) {
      failed++;
      console.error(`[cron] reminder ${reminder.id} failed; will retry next run`, error);
      await releaseReminder(db, reminder.id);
    }
  }
  return Response.json({ sent, failed, expiredHolds });
}
