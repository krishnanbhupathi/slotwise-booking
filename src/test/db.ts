import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

/**
 * A fresh in-process Postgres (PGlite) with every migration applied.
 * Tests run against the real constraints — exclusion, checks, FKs — with no
 * database server, so CI needs nothing but Node.
 */
export async function createTestDb() {
  const client = new PGlite({ extensions: { btree_gist } });
  const dir = path.join(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    for (const statement of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  const db = drizzle(client, { schema, casing: "snake_case" });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
