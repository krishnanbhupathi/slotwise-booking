import type { Page } from "@playwright/test";

/**
 * Picks the earliest open time at or after `after`, in whichever view is
 * showing: the week timetable (desktop) or the one-day list (phones).
 * Returns the slot's ISO start.
 */
export async function pickSlot(page: Page, after = new Date(0)): Promise<string> {
  const minIso = after.toISOString();
  // Wait for the times to render (the picker mounts after the browser zone is known).
  await page.locator("button[data-start]:visible").first().waitFor();
  for (let step = 0; step < 40; step++) {
    const starts = await page.locator("button[data-start]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("data-start")!));
    const match = starts.filter((s) => s >= minIso).sort()[0];
    if (match) {
      await page.locator(`button[data-start="${match}"]:visible`).click();
      return match;
    }
    const nextWeek = page.getByRole("button", { name: "Next week" });
    if (await nextWeek.isVisible()) {
      if (await nextWeek.isDisabled()) break;
      await nextWeek.click();
      continue;
    }
    const tab = page.getByRole("tab").nth(step + 1);
    if (!(await tab.count())) break;
    await tab.click();
  }
  throw new Error(`No open time at or after ${minIso}`);
}

/** The open-time button for a start, if it's showing. */
export const slotButton = (page: Page, iso: string) => page.locator(`button[data-start="${iso}"]:visible`);
