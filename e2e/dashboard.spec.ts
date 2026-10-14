import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("the demo dashboard shows upcoming bookings and payments", async ({ page }) => {
  await expect(page.getByText("You're in the shared demo account.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming bookings" })).toBeVisible();
  await expect(page.getByText("Lena K.")).toBeVisible();

  await page.getByRole("link", { name: "Payments" }).click();
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await expect(page.getByRole("row")).not.toHaveCount(1);
});

test("service form validates the deposit against the price", async ({ page }) => {
  await page.getByRole("link", { name: "Services" }).click();
  await page.getByRole("button", { name: "+ Add a service" }).click();
  await page.getByLabel("Name").fill("Bad deposit");
  await page.getByLabel("Price (USD)").fill("20");
  await page.getByLabel("Deposit (USD)").fill("30");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("Deposit can't be more than the price")).toBeVisible();
});

test("weekly hours reject overlapping ranges", async ({ page }) => {
  await page.getByRole("link", { name: "Availability" }).click();
  await page.getByRole("button", { name: "+ Add hours" }).first().click();
  await page.getByLabel("Monday range 2 start").selectOption("19:00");
  await page.getByRole("button", { name: "Save weekly hours" }).click();
  await expect(page.getByText("Time ranges overlap")).toBeVisible();
});
