import { db } from "@/db";
import { isAuthorizedCron } from "@/server/cron-auth";
import { resetDemo } from "@/server/demo";

/** Called nightly by .github/workflows/cron.yml. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  const email = process.env.DEMO_EMAIL;
  if (!email) return new Response("DEMO_EMAIL is not set", { status: 500 });
  return Response.json(await resetDemo(db, email, new Date()));
}
