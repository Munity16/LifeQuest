import { expect, test, type Page } from "@playwright/test";

const liveEnabled = process.env.LIVE_E2E === "true";
const primary = {
  email: process.env.LIVE_E2E_USER_EMAIL,
  password: process.env.LIVE_E2E_USER_PASSWORD,
};
const secondary = {
  email: process.env.LIVE_E2E_OTHER_USER_EMAIL,
  password: process.env.LIVE_E2E_OTHER_USER_PASSWORD,
};

async function login(page: Page, credentials: typeof primary) {
  if (!credentials.email || !credentials.password) throw new Error("Live staging credentials are missing.");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Enter LifeQuest" }).click();
  await expect(page).toHaveURL(/\/(onboarding|campaign|today|profile)/);
}

test.describe("@live staging readiness", () => {
  test.skip(!liveEnabled, "Set LIVE_E2E=true only against an isolated staging deployment.");

  test("a confirmed user can authenticate and persist an AI-generated campaign", async ({ page }) => {
    test.skip(!primary.email || !primary.password, "Primary staging credentials are required.");
    await login(page, primary);
    await page.goto("/onboarding");
    await expect(page.getByText(/Demo mode uses the pre-generated/i)).toHaveCount(0);

    await page.getByLabel("Your goal").fill(`Build a focused TypeScript practice routine ${Date.now()}`);
    await page.getByRole("button", { name: "Forge my campaign" }).click();
    await expect(page).toHaveURL(/\/campaign\/[0-9a-f-]{36}$/, { timeout: 120_000 });
    const campaignUrl = page.url();
    const campaignHeading = page.getByRole("heading", { level: 1 }).first();
    const campaignName = await campaignHeading.textContent();

    await page.reload();
    await expect(page).toHaveURL(campaignUrl);
    await expect(page.getByRole("heading", { level: 1, name: campaignName || undefined })).toBeVisible();
    await expect(page.locator("main")).toContainText("Day 7");
  });

  test("profile appearance persists across a fresh page load", async ({ page }) => {
    test.skip(!primary.email || !primary.password, "Primary staging credentials are required.");
    await login(page, primary);
    await page.goto("/profile");
    const theme = page.getByRole("button", { name: /Moonlit/i });
    await theme.click();
    await page.getByRole("button", { name: /Save appearance/i }).click();
    await expect(page.getByRole("status")).toContainText(/saved/i);
    await page.reload();
    await expect(theme).toHaveAttribute("aria-pressed", "true");
  });

  test("a second user cannot open the first user's campaign", async ({ browser }) => {
    test.skip(
      !primary.email || !primary.password || !secondary.email || !secondary.password,
      "Two isolated staging users are required for cross-user authorization.",
    );
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, primary);
    await ownerPage.goto("/profile");
    const ownerCampaign = ownerPage.locator('a[href^="/campaign/"]').first();
    test.skip(await ownerCampaign.count() === 0, "The owner needs an existing staging campaign.");
    const campaignPath = await ownerCampaign.getAttribute("href");
    await ownerContext.close();
    if (!campaignPath) return;

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await login(otherPage, secondary);
    await otherPage.goto(campaignPath);
    await expect(otherPage.getByRole("heading", { name: /not found|path is lost/i })).toBeVisible();
    await otherContext.close();
  });
});
