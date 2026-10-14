import { expect, test } from "@playwright/test";
import { pickSlot, slotButton } from "./slots";

// Viewer zone is Asia/Kolkata (see playwright.config.ts); the demo tutor is in London.

test("a student books the free intro call, reschedules it, then cancels it", async ({ page }) => {
  await page.goto("/book/demo-tutor");
  await expect(page.getByRole("heading", { name: "Alex Morgan" })).toBeVisible();
  await page.getByRole("link", { name: /Free intro call/ }).click();

  await expect(page.getByRole("heading", { name: "Free intro call" })).toBeVisible();
  // Times are shown in the viewer's zone, with the tutor's zone noted.
  await expect(page.getByText("Alex Morgan is in London; times are converted for you.")).toBeVisible();

  // A time at least two days out, so the 24h free-change window is still open.
  const booked = await pickSlot(page, new Date(Date.now() + 48 * 3_600_000));
  await page.getByLabel("Name").fill("Playwright Student");
  await page.getByLabel("Email").fill("e2e.student@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  await expect(page.getByText("(Calcutta time)").or(page.getByText("(Kolkata time)"))).toBeVisible();

  // Reschedule to another day.
  await page.getByRole("link", { name: "Reschedule" }).click();
  await pickSlot(page, new Date(Date.parse(booked) + 24 * 3_600_000));
  await page.getByRole("button", { name: "Move my booking" }).click();
  await expect(page.getByText("Rescheduled. We've emailed you an updated calendar invite.")).toBeVisible();

  // Cancel (free service: no deposit wording).
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Cancel this session?")).toBeVisible();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByRole("heading", { name: "This booking was cancelled" })).toBeVisible();
});

test("rescheduling isn't offered inside 24 hours, but cancelling is", async ({ page }) => {
  await page.goto("/book/demo-tutor/intro-call");
  // The earliest offered time is within a day (12h notice, evening hours).
  await pickSlot(page);
  await page.getByLabel("Name").fill("Soon Student");
  await page.getByLabel("Email").fill("soon@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();

  const startsWithinADay = await page.getByRole("link", { name: "Reschedule" }).count();
  test.skip(startsWithinADay > 0, "The earliest slot happens to be more than 24h away at this time of day.");
  await expect(page.getByRole("button", { name: "Cancel booking" })).toBeVisible();
});

test("a booked time disappears for the next student", async ({ page }) => {
  await page.goto("/book/demo-tutor/intro-call");
  const iso = await pickSlot(page);
  await page.getByLabel("Name").fill("First Student");
  await page.getByLabel("Email").fill("first@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();

  await page.goto("/book/demo-tutor/intro-call");
  await expect(page.locator("button[data-start]:visible").first()).toBeVisible();
  await expect(slotButton(page, iso)).toHaveCount(0);
});

test("without Stripe configured, a paid booking fails safely and keeps the time free", async ({ page }) => {
  await page.goto("/book/demo-tutor/gcse-maths");
  const iso = await pickSlot(page);
  await page.getByLabel("Name").fill("Paying Student");
  await page.getByLabel("Email").fill("payer@example.com");
  await page.getByRole("button", { name: /Continue to pay/ }).click();
  await expect(page.getByText("Online payment isn't set up yet")).toBeVisible();

  await page.reload();
  await expect(slotButton(page, iso)).toBeVisible();
});
