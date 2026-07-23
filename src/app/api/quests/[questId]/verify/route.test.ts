import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { POST } from "@/app/api/quests/[questId]/verify/route";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  getDemoCompletedQuestIds: vi.fn(),
  moderateProofImage: vi.fn(),
  verifyProofWithAI: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  claimVerification: vi.fn(),
  saveVerificationAssessment: vi.fn(),
  finalizeRejectedVerification: vi.fn(),
  markVerificationFailed: vi.fn(),
  assertAiUsageAvailable: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/demo-session", () => ({
  getDemoCompletedQuestIds: mocks.getDemoCompletedQuestIds,
  encodeDemoProgress: (ids: string[]) => encodeURIComponent(JSON.stringify(ids)),
}));
vi.mock("@/lib/openai/services", () => ({
  moderateProofImage: mocks.moderateProofImage,
  verifyProofWithAI: mocks.verifyProofWithAI,
}));
vi.mock("@/lib/openai/client", () => ({ getOpenAIModel: () => "gpt-5.6" }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  isSupabaseAdminConfigured: () => false,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/verification-state", () => ({
  claimVerification: mocks.claimVerification,
  saveVerificationAssessment: mocks.saveVerificationAssessment,
  finalizeRejectedVerification: mocks.finalizeRejectedVerification,
  markVerificationFailed: mocks.markVerificationFailed,
}));
vi.mock("@/lib/ai-usage", () => ({ assertAiUsageAvailable: mocks.assertAiUsageAvailable }));

const questId = "00000000-0000-4000-8000-000000000101";
const submissionId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const processingToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const campaignId = "55555555-5555-4555-8555-555555555555";
const requirement = "Code and output are visible";

const acceptedAssessment = {
  verified: true,
  confidence: 0.94,
  reason: "Code and output are visible.",
  requirementsAssessment: [{ requirement, satisfied: true, explanation: "Both are legible in the image." }],
  aiReceipt: {
    traceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    mode: "live" as const,
    model: "gpt-5.6",
    latencyMs: 120,
    safety: "passed" as const,
    schemaValidated: true,
  },
};

function completion(verified = true) {
  return {
    submissionId,
    verifiedAt: "2026-07-23T00:00:00.000Z",
    verified,
    duplicate: false,
    confidence: verified ? 0.94 : 0.4,
    reason: verified ? "Code and output are visible." : "The output is unreadable.",
    requirementsAssessment: [{
      requirement,
      satisfied: verified,
      explanation: verified ? "Both are legible in the image." : "No readable output is visible.",
    }],
    xpAwarded: verified ? 30 : 0,
    enemyDamage: verified ? 15 : 0,
    totalXp: verified ? 130 : 100,
    currentLevel: verified ? 2 : 1,
    enemyCurrentHealth: verified ? 70 : 85,
    levelledUp: verified,
    adaptiveQuestCreated: false,
    aiReceipt: acceptedAssessment.aiReceipt,
  };
}

function request(id = submissionId, demoOutcome?: "accepted" | "rejected") {
  return new Request(`http://localhost/api/quests/${questId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId: id, demoOutcome }),
  });
}

function createDatabaseFakes({
  rpcData = completion(),
  rpcError = null,
  storagePath = `${userId}/${campaignId}/${questId}/proof.jpg`,
}: {
  rpcData?: unknown;
  rpcError?: unknown;
  storagePath?: string | null;
} = {}) {
  const submission = {
    id: submissionId,
    storage_path: storagePath,
    proof_deleted_at: storagePath ? null : new Date().toISOString(),
  };
  const quest = { id: questId, title: "Run Python", description: "Run a Python file.", success_requirements: [requirement] };

  const submissionQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  submissionQuery.select.mockReturnValue(submissionQuery);
  submissionQuery.eq.mockReturnValue(submissionQuery);
  submissionQuery.maybeSingle.mockResolvedValue({ data: submission, error: null });
  const admin = {
    from: vi.fn(() => submissionQuery),
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
  };

  const questQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  questQuery.select.mockReturnValue(questQuery);
  questQuery.eq.mockReturnValue(questQuery);
  questQuery.maybeSingle.mockResolvedValue({ data: quest, error: null });
  const server = {
    from: vi.fn(() => questQuery),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
          error: null,
        }),
      })),
    },
  };

  mocks.createSupabaseAdminClient.mockReturnValue(admin);
  mocks.createSupabaseServerClient.mockResolvedValue(server);
  return { admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEMO_MODE_ENABLED = "true";
  mocks.getAuthContext.mockResolvedValue({ kind: "user", user: { id: userId } });
  mocks.getDemoCompletedQuestIds.mockResolvedValue([]);
  mocks.claimVerification.mockResolvedValue({
    state: "processing",
    claimed: true,
    processingToken,
    rawResult: null,
    completionResult: { success: false },
  });
  mocks.moderateProofImage.mockResolvedValue({
    flagged: false,
    categories: [],
    requestId: "modr_safe",
    model: "omni-moderation-latest",
  });
  mocks.verifyProofWithAI.mockResolvedValue(acceptedAssessment);
  mocks.finalizeRejectedVerification.mockResolvedValue(completion(false));
  createDatabaseFakes();
});

describe("POST /api/quests/:questId/verify", () => {
  it("rejects unauthorized verification before claiming work", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "anonymous" });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(401);
    expect(mocks.claimVerification).not.toHaveBeenCalled();
  });

  it("persists a rejected assessment without awarding progress", async () => {
    mocks.verifyProofWithAI.mockResolvedValueOnce({
      verified: false,
      confidence: 0.4,
      reason: "The output is unreadable.",
      requirementsAssessment: [{ requirement, satisfied: false, explanation: "No readable output is visible." }],
    });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: false, xpAwarded: 0, enemyDamage: 0 });
    expect(mocks.saveVerificationAssessment).toHaveBeenCalled();
    expect(mocks.finalizeRejectedVerification).toHaveBeenCalled();
  });

  it("stops flagged proof at the safety gate", async () => {
    mocks.moderateProofImage.mockResolvedValueOnce({
      flagged: true,
      categories: ["violence"],
      requestId: "modr_flagged",
      model: "omni-moderation-latest",
    });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    expect(mocks.verifyProofWithAI).not.toHaveBeenCalled();
    expect(mocks.finalizeRejectedVerification).toHaveBeenCalled();
  });

  it("normalizes a low-confidence acceptance to rejection", async () => {
    mocks.verifyProofWithAI.mockResolvedValueOnce({ ...acceptedAssessment, confidence: 0.6 });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    expect(mocks.finalizeRejectedVerification).toHaveBeenCalled();
  });

  it("uses the server-only progression RPC after accepted proof", async () => {
    const { admin } = createDatabaseFakes();
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: true, xpAwarded: 30, currentLevel: 2 });
    expect(admin.rpc).toHaveBeenCalledWith("complete_quest", expect.objectContaining({
      p_submission_id: submissionId,
      p_processing_token: processingToken,
    }));
  });

  it("returns an immutable terminal receipt without re-running AI", async () => {
    const saved = completion();
    mocks.claimVerification.mockResolvedValueOnce({
      state: "accepted",
      claimed: false,
      rawResult: saved,
      completionResult: { success: true, data: saved },
    });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(saved);
    expect(mocks.moderateProofImage).not.toHaveBeenCalled();
    expect(mocks.verifyProofWithAI).not.toHaveBeenCalled();
  });

  it("returns retryable processing state for a concurrent request", async () => {
    mocks.claimVerification.mockResolvedValueOnce({
      state: "processing",
      claimed: false,
      rawResult: null,
      completionResult: { success: false },
    });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(202);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(mocks.moderateProofImage).not.toHaveBeenCalled();
  });

  it("resumes a saved accepted assessment without another AI call", async () => {
    const { admin } = createDatabaseFakes();
    mocks.claimVerification.mockResolvedValueOnce({
      state: "processing",
      claimed: true,
      processingToken,
      rawResult: acceptedAssessment,
      completionResult: { success: false },
    });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(200);
    expect(mocks.moderateProofImage).not.toHaveBeenCalled();
    expect(mocks.verifyProofWithAI).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith("complete_quest", expect.any(Object));
  });

  it("fails safely when proof was deleted and records the failed lease", async () => {
    createDatabaseFakes({ storagePath: null });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(410);
    expect(mocks.markVerificationFailed).toHaveBeenCalledWith(submissionId, processingToken, "PROOF_DELETED");
    expect(mocks.moderateProofImage).not.toHaveBeenCalled();
  });

  it("records an AI timeout without awarding progress", async () => {
    mocks.verifyProofWithAI.mockRejectedValueOnce(new AppError("AI timed out", 502, "AI_VERIFICATION_FAILED"));
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(502);
    expect(mocks.markVerificationFailed).toHaveBeenCalled();
  });

  it("keeps an accepted assessment retryable when progression persistence fails", async () => {
    createDatabaseFakes({ rpcError: { code: "DATABASE_UNAVAILABLE" } });
    const response = await POST(request(), { params: Promise.resolve({ questId }) });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "PROGRESSION_FAILED" } });
    expect(mocks.saveVerificationAssessment).toHaveBeenCalled();
    expect(mocks.markVerificationFailed).toHaveBeenCalled();
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
    await expect(response.json()).resolves.toMatchObject({
      verified: false,
      xpAwarded: 0,
      enemyDamage: 0,
      aiReceipt: { mode: "demo", safety: "simulated" },
    });
  });
});
