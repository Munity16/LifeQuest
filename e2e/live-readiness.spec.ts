import { expect, test } from "@playwright/test";

test.describe("@live production readiness", () => {
  test.skip(process.env.LIVE_E2E !== "true", "Set LIVE_E2E=true with staging credentials to run live checks.");

  test("a confirmed user can authenticate and persist an AI-generated campaign", async ({ page }) => {
    const email = process.env.LIVE_E2E_USER_EMAIL;
    const password = process.env.LIVE_E2E_USER_PASSWORD;
    test.skip(!email || !password, "Live test credentials are required.");
    if (!email || !password) return;

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Enter LifeQuest" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText(/Demo mode uses the pre-generated/i)).toHaveCount(0);

    await page.getByLabel("Your goal").fill(`Build a focused TypeScript practice routine ${Date.now()}`);
    await page.getByRole("button", { name: "Forge my campaign" }).click();
    await expect(page).toHaveURL(/\/campaign\/[0-9a-f-]{36}$/, { timeout: 120_000 });
    const campaignHeading = page.getByRole("heading", { level: 1 }).first();
    await expect(campaignHeading).toBeVisible();
    const campaignName = await campaignHeading.textContent();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: campaignName || undefined })).toBeVisible();
  });
});
