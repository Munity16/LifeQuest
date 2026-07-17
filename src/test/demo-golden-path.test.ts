import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as generateCampaign } from "@/app/api/campaigns/generate/route";
import { POST as uploadProof } from "@/app/api/quests/[questId]/proof/route";
import { POST as verifyProof } from "@/app/api/quests/[questId]/verify/route";
import { DEMO_CAMPAIGN_ID } from "@/lib/config";
import { getDemoCampaign } from "@/lib/demo-data";

const state = vi.hoisted(() => ({ completedIds: [] as string[] }));

vi.mock("@/lib/auth", () => ({ getAuthContext: vi.fn(async () => ({ kind: "demo", email: "hero@lifequest.demo" })) }));
vi.mock("@/lib/demo-session", () => ({
  getDemoCompletedQuestIds: vi.fn(async () => [...state.completedIds]),
  encodeDemoProgress: (ids: string[]) => encodeURIComponent(JSON.stringify(ids)),
}));

beforeEach(() => {
  process.env.DEMO_MODE_ENABLED = "true";
  state.completedIds = [];
});

describe("seeded demo golden path", () => {
  it("runs goal submission through verification and retains progress after refresh", async () => {
    const generationResponse = await generateCampaign(new Request("http://localhost/api/campaigns/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "11111111-1111-4111-8111-111111111111" },
      body: JSON.stringify({ goal: "Learn Python fundamentals in seven days.", dailyMinutes: 30, mainObstacle: "procrastination", difficulty: "balanced" }),
    }));
    expect(generationResponse.status).toBe(200);
    await expect(generationResponse.json()).resolves.toMatchObject({ campaignId: DEMO_CAMPAIGN_ID, demoSeeded: true });

    const initialCampaign = getDemoCampaign();
    const quest = initialCampaign.quests.find((item) => item.status === "available");
    expect(quest).toBeDefined();

    const form = new FormData();
    form.set("proof", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "proof.png", { type: "image/png" }));
    const uploadResponse = await uploadProof(new Request(`http://localhost/api/quests/${quest!.id}/proof`, { method: "POST", body: form }), { params: Promise.resolve({ questId: quest!.id }) });
    expect(uploadResponse.status).toBe(201);
    await expect(uploadResponse.json()).resolves.toMatchObject({ submissionId: quest!.id, demoFallback: true });

    const verificationResponse = await verifyProof(new Request(`http://localhost/api/quests/${quest!.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: quest!.id }),
    }), { params: Promise.resolve({ questId: quest!.id }) });
    expect(verificationResponse.status).toBe(200);
    const completion = await verificationResponse.json();
    expect(completion).toMatchObject({ verified: true, duplicate: false, xpAwarded: quest!.xpReward, enemyDamage: quest!.enemyDamage, demoFallback: true });

    state.completedIds = [quest!.id];
    const refreshedCampaign = getDemoCampaign(state.completedIds);
    expect(refreshedCampaign.totalXp).toBe(quest!.xpReward);
    expect(refreshedCampaign.enemyCurrentHealth).toBe(100 - quest!.enemyDamage);
    expect(refreshedCampaign.quests.find((item) => item.id === quest!.id)?.status).toBe("completed");
  });
});
