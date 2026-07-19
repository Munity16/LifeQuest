import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/quests/[questId]/verify/route";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  getDemoCompletedQuestIds: vi.fn(),
  moderateProofImage: vi.fn(),
  verifyProofWithAI: vi.fn(),
  generateAdaptiveQuestWithAI: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getCampaign: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/demo-session", () => ({
  getDemoCompletedQuestIds: mocks.getDemoCompletedQuestIds,
  encodeDemoProgress: (ids: string[]) => encodeURIComponent(JSON.stringify(ids)),
}));
vi.mock("@/lib/openai/services", () => ({
  moderateProofImage: mocks.moderateProofImage,
  verifyProofWithAI: mocks.verifyProofWithAI,
  generateAdaptiveQuestWithAI: mocks.generateAdaptiveQuestWithAI,
}));
vi.mock("@/lib/openai/client", () => ({ getOpenAIModel: () => "gpt-5.6" }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  isSupabaseAdminConfigured: () => false,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/data", () => ({ campaignProgress: () => 14, getCampaign: mocks.getCampaign }));

const questId = "00000000-0000-4000-8000-000000000101";
const submissionId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

function request(id = submissionId, demoOutcome?: "accepted" | "rejected") {
  return new Request(`http://localhost/api/quests/${questId}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: id, demoOutcome }) });
}

function createDatabaseFakes({ rpcData, rpcError = null, rejectionError = null }: { rpcData?: unknown; rpcError?: unknown; rejectionError?: unknown } = {}) {
  const submission = { id: submissionId, quest_id: questId, campaign_id: "55555555-5555-4555-8555-555555555555", user_id: userId, storage_path: `${userId}/campaign/quest/proof.png` };
  const quest = { id: questId, campaign_id: submission.campaign_id, user_id: userId, title: "Run Python", description: "Run a Python file.", success_requirements: ["Code and output are visible"], day_number: 1, sequence_number: 1, story_intro: "A test quest", difficulty: "balanced", estimated_minutes: 30, xp_reward: 30, enemy_damage: 15, is_adaptive: false };

  const submissionQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  submissionQuery.select.mockReturnValue(submissionQuery);
  submissionQuery.eq.mockReturnValue(submissionQuery);
  submissionQuery.maybeSingle.mockResolvedValue({ data: submission, error: null });
  const rejectionQuery = { update: vi.fn(), eq: vi.fn() };
  rejectionQuery.update.mockReturnValue(rejectionQuery);
  rejectionQuery.eq.mockResolvedValue({ error: rejectionError });
  const admin = {
    from: vi.fn(() => ({ ...submissionQuery, ...rejectionQuery })),
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
  };

  const questQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  questQuery.select.mockReturnValue(questQuery);
  questQuery.eq.mockReturnValue(questQuery);
  questQuery.maybeSingle.mockResolvedValue({ data: quest, error: null });
  const server = {
    from: vi.fn(() => questQuery),
    storage: { from: vi.fn(() => ({ download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), error: null }) })) },
  };

  mocks.createSupabaseAdminClient.mockReturnValue(admin);
  mocks.createSupabaseServerClient.mockResolvedValue(server);
  return { admin, rejectionQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEMO_MODE_ENABLED = "true";
  mocks.getAuthContext.mockResolvedValue({ kind: "user", user: { id: userId } });
  mocks.getDemoCompletedQuestIds.mockResolvedValue([]);
  mocks.moderateProofImage.mockResolvedValue({ flagged: false, categories: [], requestId: "modr_safe", model: "omni-moderation-latest" });
  mocks.generateAdaptiveQuestWithAI.mockResolvedValue(null);
  mocks.getCampaign.mockResolvedValue(null);
});

describe("POST /api/quests/:questId/verify", () => {
  it("rejects unauthorized verification", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "anonymous" });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(401);
  });

  it("persists a rejected AI result without awarding progress", async () => {
    const { rejectionQuery, admin } = createDatabaseFakes();
    mocks.verifyProofWithAI.mockResolvedValueOnce({ verified: false, confidence: 0.4, reason: "The output is unreadable.", requirementsAssessment: [{ requirement: "Code and output are visible", satisfied: false, explanation: "No readable output is visible." }] });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: false, xpAwarded: 0, enemyDamage: 0 });
    expect(rejectionQuery.update).toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("stops flagged proof at the safety gate without calling verification", async () => {
    const { admin } = createDatabaseFakes();
    mocks.moderateProofImage.mockResolvedValueOnce({ flagged: true, categories: ["violence"], requestId: "modr_flagged", model: "omni-moderation-latest" });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: false, xpAwarded: 0, aiReceipt: { safety: "flagged", schemaValidated: false } });
    expect(mocks.verifyProofWithAI).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("normalizes a low-confidence model acceptance to rejection", async () => {
    const { admin } = createDatabaseFakes();
    mocks.verifyProofWithAI.mockResolvedValueOnce({ verified: true, confidence: 0.6, reason: "The image may show the result, but it is not clear enough.", requirementsAssessment: [{ requirement: "Code and output are visible", satisfied: true, explanation: "Some code and output appear in the image." }] });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    await expect(response.json()).resolves.toMatchObject({ verified: false, xpAwarded: 0, enemyDamage: 0 });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("uses the server-only RPC after accepted proof", async () => {
    const completion = { duplicate: false, xpAwarded: 30, enemyDamage: 15, totalXp: 130, currentLevel: 2, enemyCurrentHealth: 70, levelledUp: true };
    const { admin } = createDatabaseFakes({ rpcData: completion });
    mocks.verifyProofWithAI.mockResolvedValueOnce({ verified: true, confidence: 0.94, reason: "Code and output are visible.", requirementsAssessment: [{ requirement: "Code and output are visible", satisfied: true, explanation: "Both are legible in the image." }] });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: true, xpAwarded: 30, currentLevel: 2 });
    expect(admin.rpc).toHaveBeenCalledWith("complete_quest", expect.objectContaining({ p_submission_id: submissionId }));
  });

  it("awards nothing for a duplicate demo completion", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "demo", email: "hero@lifequest.demo" });
    mocks.getDemoCompletedQuestIds.mockResolvedValueOnce([questId]);
    const response = await POST(request(questId), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: true, duplicate: true, xpAwarded: 0, enemyDamage: 0, demoFallback: true });
  });

  it("demonstrates a rejected sample without changing demo progress", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "demo", email: "hero@lifequest.demo" });
    const response = await POST(request(questId, "rejected"), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      verified: false,
      xpAwarded: 0,
      enemyDamage: 0,
      aiReceipt: { mode: "demo", safety: "simulated" },
    });
    expect(payload.requirementsAssessment).not.toHaveLength(0);
    expect(payload.requirementsAssessment.every((item: { satisfied: boolean }) => !item.satisfied)).toBe(true);
  });

  it("reports progression persistence failure safely", async () => {
    createDatabaseFakes({ rpcError: { message: "database unavailable" } });
    mocks.verifyProofWithAI.mockResolvedValueOnce({ verified: true, confidence: 0.94, reason: "Code and output are visible.", requirementsAssessment: [{ requirement: "Code and output are visible", satisfied: true, explanation: "Both are legible in the image." }] });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "PROGRESSION_FAILED" } });
  });
});
