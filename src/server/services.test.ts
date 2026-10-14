import { beforeAll, describe, expect, it } from "vitest";
import { bookings } from "@/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import type { ServiceInput } from "@/lib/validation";
import { createService, listServices, removeService, updateService } from "./services";

let db: TestDb;
beforeAll(async () => {
  ({ db } = await createTestDb());
});

const input: ServiceInput = {
  name: "GCSE Maths",
  description: null,
  durationMin: 60,
  price: 4500,
  deposit: 1000,
  bufferMin: 15,
};

describe("services", () => {
  it("creates a service with a slug from its name", async () => {
    const provider = await makeProvider(db);
    const service = await createService(db, provider.id, input);
    expect(service).toMatchObject({ slug: "gcse-maths", priceCents: 4500, depositCents: 1000, active: true });
  });

  it("de-duplicates slugs per provider, not globally", async () => {
    const a = await makeProvider(db);
    const b = await makeProvider(db);
    const first = await createService(db, a.id, input);
    const second = await createService(db, a.id, input);
    const third = await createService(db, a.id, input);
    const other = await createService(db, b.id, input);
    expect([first.slug, second.slug, third.slug, other.slug]).toEqual([
      "gcse-maths",
      "gcse-maths-2",
      "gcse-maths-3",
      "gcse-maths",
    ]);
  });

  it("keeps the slug when a service is renamed, so shared links still work", async () => {
    const provider = await makeProvider(db);
    const service = await createService(db, provider.id, input);
    const updated = await updateService(db, provider.id, service.id, { ...input, name: "A-level Maths" });
    expect(updated).toMatchObject({ name: "A-level Maths", slug: "gcse-maths" });
  });

  it("refuses to update or remove another provider's service", async () => {
    const owner = await makeProvider(db);
    const intruder = await makeProvider(db);
    const service = await createService(db, owner.id, input);

    expect(await updateService(db, intruder.id, service.id, { ...input, name: "Hijacked" })).toBeNull();
    expect(await removeService(db, intruder.id, service.id)).toBe("not_found");
    expect((await listServices(db, owner.id))[0].name).toBe("GCSE Maths");
  });

  it("deletes a service with no bookings", async () => {
    const provider = await makeProvider(db);
    const service = await createService(db, provider.id, input);
    expect(await removeService(db, provider.id, service.id)).toBe("deleted");
    expect(await listServices(db, provider.id)).toHaveLength(0);
  });

  it("archives instead of deleting when bookings exist", async () => {
    const provider = await makeProvider(db);
    const service = await createService(db, provider.id, input);
    await db.insert(bookings).values({
      providerId: provider.id,
      serviceId: service.id,
      clientName: "Client",
      clientEmail: "client@example.com",
      startsAt: new Date("2026-10-20T09:00Z"),
      endsAt: new Date("2026-10-20T10:00Z"),
      blocksUntil: new Date("2026-10-20T10:15Z"),
      status: "confirmed",
    });

    expect(await removeService(db, provider.id, service.id)).toBe("archived");
    const [row] = await listServices(db, provider.id);
    expect(row.active).toBe(false);
  });
});
