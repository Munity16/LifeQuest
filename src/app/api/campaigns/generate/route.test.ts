import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { POST } from "@/app/api/campaigns/generate/route";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  generateCampaignWithAI: vi.fn(),
  persistGeneratedCampaign: vi.fn(),
  claimCampaignGeneration: vi.fn(),
  failCampaignGeneration: vi.fn(),
  assertAiUsageAvailable: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/openai/services", () => ({ generateCampaignWithAI: mocks.generateCampaignWithAI }));
vi.mock("@/lib/data", () => ({ persistGeneratedCampaign: mocks.persistGeneratedCampaign }));
vi.mock("@/lib/generation-requests", () => ({
  claimCampaignGeneration: mocks.claimCampaignGeneration,
  failCampaignGeneration: mocks.failCampaignGeneration,
}));
vi.mock("@/lib/ai-usage", () => ({ assertAiUsageAvailable: mocks.assertAiUsageAvailable }));

const input = { goal: "Learn Python fundamentals", dailyMinutes: 30, mainObstacle: "procrastination", difficulty: "balanced" };
const generated = { campaignName: "Campaign", quests: [] };
const generationKey = "11111111-1111-4111-8111-111111111111";

function request(body: unknown = input, key: string | null = generationKey) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Idempotency-Key"] = key;
  return new Request("http://localhost/api/campaigns/generate", { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  mocks.getAuthContext.mockResolvedValue({ kind: "user", user: { id: "user-1" } });
  mocks.generateCampaignWithAI.mockResolvedValue(generated);
  mocks.persistGeneratedCampaign.mockResolvedValue("22222222-2222-4222-8222-222222222222");
  mocks.claimCampaignGeneration.mockResolvedValue({
    state: "processing",
    claimed: true,
    processingToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
});

describe("POST /api/campaigns/generate", () => {
  it("generates and atomically persists an authenticated campaign", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ campaignId: "22222222-2222-4222-8222-222222222222" });
    expect(mocks.persistGeneratedCampaign).toHaveBeenCalledWith("user-1", generationKey, input, generated);
    expect(mocks.claimCampaignGeneration).toHaveBeenCalledBefore(mocks.generateCampaignWithAI);
  });

  it("rejects an unauthenticated request before calling OpenAI", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "anonymous" });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.generateCampaignWithAI).not.toHaveBeenCalled();
  });

  it("requires an idempotency key", async () => {
    const response = await POST(request(input, null));
    expect(response.status).toBe(400);
    expect(mocks.generateCampaignWithAI).not.toHaveBeenCalled();
  });

  it("returns a validation error for invalid onboarding input", async () => {
    const response = await POST(request({ ...input, dailyMinutes: 20 }));
    expect(response.status).toBe(400);
    expect(mocks.generateCampaignWithAI).not.toHaveBeenCalled();
  });

  it("reports persistence failure without returning the generated campaign", async () => {
    mocks.persistGeneratedCampaign.mockRejectedValueOnce(new AppError("Campaign save failed", 500, "CAMPAIGN_SAVE_FAILED"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CAMPAIGN_SAVE_FAILED" } });
    expect(mocks.failCampaignGeneration).toHaveBeenCalled();
  });

  it("returns a saved result without calling OpenAI for a duplicate key", async () => {
    mocks.claimCampaignGeneration.mockResolvedValueOnce({
      state: "succeeded",
      claimed: false,
      campaignId: "22222222-2222-4222-8222-222222222222",
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.generateCampaignWithAI).not.toHaveBeenCalled();
  });

  it("returns retryable processing state for a concurrent duplicate", async () => {
    mocks.claimCampaignGeneration.mockResolvedValueOnce({ state: "processing", claimed: false });
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(mocks.generateCampaignWithAI).not.toHaveBeenCalled();
  });
});
