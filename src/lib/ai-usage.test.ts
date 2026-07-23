import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAiUsageAvailable, recordAiUsage } from "@/lib/ai-usage";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseAdminConfigured: () => true,
  createSupabaseAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ insert: mocks.insert }),
  }),
}));

const userId = "44444444-4444-4444-8444-444444444444";
const emptyUsage = {
  campaignGeneration: 0,
  proofModeration: 0,
  proofVerification: 0,
  adaptiveGeneration: 0,
  realtimeNarration: 0,
  inputUnits: 0,
  outputUnits: 0,
  estimatedCostMicrousd: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AI_MONTHLY_CAMPAIGN_GENERATION_LIMIT;
  mocks.rpc.mockResolvedValue({ data: emptyUsage, error: null });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("AI usage controls", () => {
  it("allows an operation below its configured monthly limit", async () => {
    process.env.AI_MONTHLY_CAMPAIGN_GENERATION_LIMIT = "2";
    await expect(assertAiUsageAvailable(userId, "campaign_generation")).resolves.toBeUndefined();
  });

  it("rejects an operation at its monthly limit", async () => {
    process.env.AI_MONTHLY_CAMPAIGN_GENERATION_LIMIT = "2";
    mocks.rpc.mockResolvedValueOnce({
      data: { ...emptyUsage, campaignGeneration: 2 },
      error: null,
    });
    await expect(assertAiUsageAvailable(userId, "campaign_generation")).rejects.toMatchObject({
      status: 429,
      code: "AI_USAGE_LIMIT_REACHED",
    });
  });

  it("records only the privacy-safe usage fields", async () => {
    await recordAiUsage({
      userId,
      operation: "proof_verification",
      model: "gpt-5.6",
      traceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      latencyMs: 480,
      success: true,
      inputUnits: 120,
      outputUnits: 40,
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: userId,
      operation: "proof_verification",
      model: "gpt-5.6",
      trace_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      latency_ms: 480,
      success: true,
      input_units: 120,
      output_units: 40,
      estimated_cost_microusd: undefined,
    });
  });
});
