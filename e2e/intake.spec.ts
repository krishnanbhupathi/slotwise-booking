import { expect, test } from "@playwright/test";

// The demo's Physics service has a Formwise intake form (see src/server/demo-intake.ts).

test("intake questions are validated on the server before any hold or payment", async ({ page }) => {
  await page.goto("/book/demo-tutor/a-level-physics");
  const intake = page.getByRole("group", { name: "Before your first lesson" });
  await expect(intake.getByLabel(/School year/)).toBeVisible();
  await expect(intake.getByLabel(/Exam board/)).toHaveCount(0);

  await page.getByRole("tabpanel", { name: "Times" }).getByRole("button").first().click();
  await page.getByLabel("Name").fill("Intake Student");
  await page.getByLabel("Email").fill("intake@example.com");

  // Nothing answered: the server (Formwise's validateSubmission) rejects it, no hold is placed.
  await page.getByRole("button", { name: /Continue to pay/ }).click();
  await expect(page.getByText("Some answers need attention.")).toBeVisible();
  await expect(intake.getByText("This field is required")).toHaveCount(2); // year + consent

  // Conditional question appears, and a valid set of answers gets past validation
  // (to the payment step, which isn't configured in e2e).
  await intake.getByLabel(/School year/).selectOption("Year 12");
  await intake.getByLabel(/Preparing for an exam/).check();
  await expect(intake.getByLabel(/Exam board/)).toBeVisible();
  await intake.getByLabel(/Exam board/).selectOption("AQA");
  await intake.getByLabel(/parent or guardian agrees/).check();
  await page.getByRole("button", { name: /Continue to pay/ }).click();
  await expect(page.getByText("Online payment isn't set up yet")).toBeVisible();
  await expect(page.getByText("Some answers need attention.")).toHaveCount(0);
});

test("the tutor sees intake answers on the booking and the attached form on the service", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByText(/Before your first lesson \(5\)/).click();
  await expect(page.getByText("Exam board", { exact: true })).toBeVisible();
  await expect(page.getByText("OCR", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Services" }).click();
  await expect(page.getByText(/· 5 questions · version 1/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Before your first lesson" })).toHaveAttribute("href", /\/f\/[2-9a-z]{10}$/);
  // Services without a form offer to attach one.
  await expect(page.getByLabel("Formwise share link for GCSE Maths – 1:1")).toBeVisible();
});
