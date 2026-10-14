import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { services, type IntakeFormRef } from "@/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { makeProvider } from "@/test/fixtures";
import type { FormSchema } from "@/vendor/formwise/core";
import { formatIntakeValue } from "@/lib/intake";
import { attachIntakeForm, checkIntake, fetchPublishedForm, parseShareLink, removeIntakeForm } from "./intake";

const ORIGIN = "https://forms.example";
const intakeForm: FormSchema = {
  version: 1,
  id: "abcdefghjk",
  title: "Student intake",
  fields: [
    { id: "year", type: "select", label: "School year", required: true, options: [{ id: "y11", label: "Year 11" }, { id: "y12", label: "Year 12" }] },
    { id: "board", type: "text", label: "Exam board", required: true, showIf: { fieldId: "year", equals: "y12" } },
    { id: "goals", type: "textarea", label: "Goals", required: false },
    { id: "consent", type: "checkbox", label: "Parent consents", required: true },
  ],
};
const ref: IntakeFormRef = { formId: "abcdefghjk", version: 3, sourceUrl: `${ORIGIN}/f/abcdefghjk`, fetchedAt: "2026-10-20T00:00:00.000Z", schema: intakeForm };

const json = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("parseShareLink", () => {
  it.each([
    [`${ORIGIN}/f/abcdefghjk`, true],
    [`${ORIGIN}/f/abcdefghjk/`, true],
    [`  ${ORIGIN}/f/abcdefghjk?utm=x  `, true],
    [`${ORIGIN}/edit/abcdefghjk`, false],
    [`https://evil.example/f/abcdefghjk`, false],
    [`${ORIGIN}.evil.example/f/abcdefghjk`, false],
    ["http://169.254.169.254/latest/meta-data", false],
    ["not a url", false],
  ])("%s → %s", (input, ok) => {
    expect(parseShareLink(input, ORIGIN).ok).toBe(ok);
  });
});

describe("fetchPublishedForm", () => {
  const now = new Date("2026-10-21T09:00:00Z");

  it("fetches the published version from the Formwise API and keeps a validated copy", async () => {
    const fetch = json({ form: intakeForm, version: 3 });
    const result = await fetchPublishedForm(`${ORIGIN}/f/abcdefghjk`, { fetch, origin: ORIGIN, now });
    expect(fetch).toHaveBeenCalledWith(`${ORIGIN}/api/public/forms/abcdefghjk`, expect.anything());
    expect(result).toEqual({ ok: true, ref: { ...ref, fetchedAt: now.toISOString() } });
  });

  it("never fetches a link to another host", async () => {
    const fetch = vi.fn();
    expect((await fetchPublishedForm("https://evil.example/f/abcdefghjk", { fetch, origin: ORIGIN })).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains unpublished forms, outages, and unreadable schemas", async () => {
    const link = `${ORIGIN}/f/abcdefghjk`;
    expect(await fetchPublishedForm(link, { fetch: json({ error: "x" }, 404), origin: ORIGIN })).toEqual({ ok: false, error: "That form isn't published yet. Publish it in Formwise first." });
    expect((await fetchPublishedForm(link, { fetch: json({}, 500), origin: ORIGIN })).ok).toBe(false);
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchPublishedForm(link, { fetch: down, origin: ORIGIN })).toEqual({ ok: false, error: "Couldn't reach Formwise. Try again in a moment." });
    expect(await fetchPublishedForm(link, { fetch: json({ form: { version: 9 }, version: 1 }), origin: ORIGIN })).toEqual({
      ok: false,
      error: "Formwise sent a form this version of Slotwise can't read.",
    });
  });
});

describe("attach / remove", () => {
  let db: TestDb;
  beforeAll(async () => {
    ({ db } = await createTestDb());
  });

  async function serviceFor(providerId: string) {
    const [s] = await db.insert(services).values({ providerId, slug: `s-${crypto.randomUUID().slice(0, 6)}`, name: "Maths", durationMin: 60, priceCents: 0, depositCents: 0 }).returning();
    return s!;
  }

  it("stores the copy on the tutor's own service only", async () => {
    const tutor = await makeProvider(db);
    const other = await makeProvider(db);
    const service = await serviceFor(tutor.id);
    const deps = { fetch: json({ form: intakeForm, version: 3 }), origin: ORIGIN };

    expect((await attachIntakeForm(db, other.id, service.id, `${ORIGIN}/f/abcdefghjk`, deps)).ok).toBe(false);
    expect((await attachIntakeForm(db, tutor.id, service.id, `${ORIGIN}/f/abcdefghjk`, deps)).ok).toBe(true);
    const row = await db.query.services.findFirst({ where: eq(services.id, service.id) });
    expect(row!.intakeForm).toMatchObject({ formId: "abcdefghjk", version: 3, schema: { title: "Student intake" } });

    await removeIntakeForm(db, other.id, service.id);
    expect((await db.query.services.findFirst({ where: eq(services.id, service.id) }))!.intakeForm).not.toBeNull();
    await removeIntakeForm(db, tutor.id, service.id);
    expect((await db.query.services.findFirst({ where: eq(services.id, service.id) }))!.intakeForm).toBeNull();
  });
});

describe("checkIntake", () => {
  it("passes when the service has no intake form", () => {
    expect(checkIntake(null, "garbage")).toEqual({ ok: true, intake: null });
  });

  it("validates on the server with Formwise's rules, including conditional questions", () => {
    const result = checkIntake(ref, JSON.stringify({ year: "Year 12", consent: false }));
    expect(result).toMatchObject({ ok: false, errors: { board: "This field is required", consent: "This field is required" } });
  });

  it("stores visible answers with their labels, dropping hidden ones", () => {
    const result = checkIntake(ref, JSON.stringify({ year: "Year 11", board: "AQA (hidden)", goals: "", consent: true }));
    expect(result).toEqual({
      ok: true,
      intake: {
        formId: "abcdefghjk",
        version: 3,
        title: "Student intake",
        answers: [
          { id: "year", label: "School year", value: "Year 11" },
          { id: "goals", label: "Goals", value: null },
          { id: "consent", label: "Parent consents", value: true },
        ],
      },
    });
  });

  it("treats malformed JSON as no answers", () => {
    expect(checkIntake(ref, "{not json")).toMatchObject({ ok: false, errors: { year: "This field is required" } });
  });

  it("formats answers for people", () => {
    expect([true, false, null, "x", 3, { name: "a.pdf", size: 2048, type: "application/pdf" }].map((v) => formatIntakeValue(v))).toEqual(["Yes", "No", "—", "x", "3", "a.pdf (2 KB)"]);
  });
});
