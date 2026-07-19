import { expect, test } from "@playwright/test";

const campaignId = "00000000-0000-4000-8000-000000000001";

test("goal to verified progression golden path", async ({ page }) => {
  await page.goto("/api/demo/start");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Turn your goal into a questline." })).toBeVisible();

  await page.getByRole("button", { name: "Enter the seeded campaign" }).click();
  await expect(page).toHaveURL(new RegExp(`/campaign/${campaignId}$`));
  await expect(page.getByRole("heading", { name: "The Kingdom of Python" })).toBeVisible();

  await page.getByRole("link", { name: /Begin mission/ }).click();
  await expect(page).toHaveURL(/\/quest\/00000000-0000-4000-8000-000000000101$/);
  await expect(page.getByRole("heading", { level: 1, name: "Forge Your First Variables" })).toBeVisible();

  await page.getByRole("button", { name: "Load rejected proof" }).click();
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText("Not quite yet")).toBeVisible();
  await expect(page.getByText("Attack blocked")).toBeVisible();

  await page.getByRole("button", { name: "Try another image" }).click();
  await page.getByRole("button", { name: "Load passing proof" }).click();
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByRole("dialog", { name: "Victory is yours." })).toBeVisible();
  await expect(page.getByText("+20", { exact: true })).toBeVisible();
  await expect(page.getByText("-10", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Continue adventure/ }).click();
  await expect(page.getByRole("progressbar", { name: /20 of 100 XP/ })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /90 of 100 health/ })).toBeVisible();
});

test("campaign and quest stay within a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/api/demo/start");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Turn your goal into a questline." })).toBeVisible();
  await page.goto(`/campaign/${campaignId}`);

  await expect(page.getByRole("heading", { name: "The Kingdom of Python" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto(`/campaign/${campaignId}/quest/00000000-0000-4000-8000-000000000101`);
  await expect(page.getByRole("heading", { level: 1, name: "Forge Your First Variables" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
