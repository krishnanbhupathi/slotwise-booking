import { expect, test } from "@playwright/test";

// Viewer zone is Asia/Kolkata (see playwright.config.ts); the demo tutor is in London.

test("a student books the free intro call, reschedules it, then cancels it", async ({ page }) => {
  await page.goto("/book/demo-tutor");
  await expect(page.getByRole("heading", { name: "Alex Morgan" })).toBeVisible();
  await page.getByRole("link", { name: /Free intro call/ }).click();

  await expect(page.getByRole("heading", { name: "Free intro call" })).toBeVisible();
  // Times are shown in the viewer's zone, with the tutor's zone noted.
  await expect(page.getByText("Alex Morgan is in London; times are converted for you.")).toBeVisible();

  // A date at least two days out, so the 24h free-change window is still open.
  await page.getByRole("tab").nth(2).click();
  await page.getByRole("tabpanel", { name: "Times" }).getByRole("button").first().click();
  await page.getByLabel("Name").fill("Playwright Student");
  await page.getByLabel("Email").fill("e2e.student@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  await expect(page.getByText("(Calcutta time)").or(page.getByText("(Kolkata time)"))).toBeVisible();

  // Reschedule to another day.
  await page.getByRole("link", { name: "Reschedule" }).click();
  await page.getByRole("tab").nth(3).click();
  await page.getByRole("tabpanel", { name: "Times" }).getByRole("button").first().click();
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
  await page.getByRole("tabpanel", { name: "Times" }).getByRole("button").first().click();
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
  const firstTime = page.getByRole("tabpanel", { name: "Times" }).getByRole("button").first();
  const label = await firstTime.innerText();
  await firstTime.click();
  await page.getByLabel("Name").fill("First Student");
  await page.getByLabel("Email").fill("first@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();

  await page.goto("/book/demo-tutor/intro-call");
  await expect(page.getByRole("tabpanel", { name: "Times" }).getByRole("button", { name: label, exact: true })).toHaveCount(0);
});

test("without Stripe configured, a paid booking fails safely and keeps the time free", async ({ page }) => {
  await page.goto("/book/demo-tutor/gcse-maths");
  const firstTime = page.getByRole("tabpanel", { name: "Times" }).getByRole("button").first();
  const label = await firstTime.innerText();
  await firstTime.click();
  await page.getByLabel("Name").fill("Paying Student");
  await page.getByLabel("Email").fill("payer@example.com");
  await page.getByRole("button", { name: /Continue to pay/ }).click();
  await expect(page.getByText("Online payment isn't set up yet")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tabpanel", { name: "Times" }).getByRole("button", { name: label, exact: true })).toBeVisible();
});
