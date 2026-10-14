/** Creates or resets the demo account behind the "Try the demo" button. Safe to re-run. */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { resetDemo } from "../src/server/demo";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.DEMO_EMAIL;
  if (!url || !email) throw new Error("DATABASE_URL and DEMO_EMAIL must be set");

  const client = postgres(url, { max: 1, prepare: false });
  const result = await resetDemo(drizzle(client, { schema, casing: "snake_case" }), email, new Date());
  await client.end();
  console.log(`Demo account ready: ${email} → /book/demo-tutor (${result.sampleBookings} sample bookings)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
