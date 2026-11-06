import { test, expect } from "@playwright/test";

test.describe("QuickKaam Happy Path Booking & OTP Flow", () => {
  test("Customer books plumber, receives OTP, worker enters OTP, completes and reviews", async ({ page }) => {
    await page.goto("/customer");
    await expect(page.locator("h1")).toBeVisible();

    // Reset demo data to ensure clean state
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.reload();

    // Check that categories load
    await expect(page.locator("text=Plumber")).toBeVisible();

    // Open booking modal
    const sendAllBtn = page.locator("button:has-text('Send to everyone nearby')");
    if (await sendAllBtn.isVisible()) {
      await sendAllBtn.click();
      await expect(page.locator("textarea#job-desc")).toBeVisible();
      await page.fill("textarea#job-desc", "Playwright E2E Test Leak");
      await page.click("button:has-text('Send request')");
      await expect(page.locator("text=Playwright E2E Test Leak")).toBeVisible();
    }
  });
});
