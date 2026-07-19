import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/quests/[questId]/proof/route";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  isSupabaseAdminConfigured: () => false,
}));

const questId = "00000000-0000-4000-8000-000000000101";
const submissionId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEMO_MODE_ENABLED = "true";
  mocks.getAuthContext.mockResolvedValue({ kind: "user", user: { id: userId } });
});

describe("DELETE /api/quests/:questId/proof", () => {
  it("removes only the authenticated user's object and retains a deletion receipt", async () => {
    const selectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    selectQuery.select.mockReturnValue(selectQuery);
    selectQuery.eq.mockReturnValue(selectQuery);
    selectQuery.maybeSingle.mockResolvedValue({ data: { id: submissionId, storage_path: `${userId}/campaign/quest/proof.png`, proof_deleted_at: null }, error: null });

    const updateQuery = { update: vi.fn(), eq: vi.fn() };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValueOnce(updateQuery).mockResolvedValueOnce({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn().mockReturnValueOnce(selectQuery).mockReturnValueOnce(updateQuery),
      storage: { from: vi.fn(() => ({ remove })) },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(admin);

    const response = await DELETE(new Request(`http://localhost/api/quests/${questId}/proof`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    }), { params: Promise.resolve({ questId }) });

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith([`${userId}/campaign/quest/proof.png`]);
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ storage_path: null, proof_deleted_at: expect.any(String) }));
    await expect(response.json()).resolves.toMatchObject({ deleted: true, duplicate: false });
  });
});
