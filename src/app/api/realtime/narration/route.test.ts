import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/realtime/narration/route";

const mocks = vi.hoisted(() => ({ getAuthContext: vi.fn(), getQuest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/data", () => ({ getQuest: mocks.getQuest }));

const campaignId = "55555555-5555-4555-8555-555555555555";
const questId = "66666666-6666-4666-8666-666666666666";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  mocks.getAuthContext.mockReset();
  mocks.getAuthContext.mockResolvedValue({ kind: "user", user: { id: "user-123" } });
  mocks.getQuest.mockReset();
  mocks.getQuest.mockResolvedValue({ campaign: { isDemo: false }, quest: { title: "Test quest", storyIntro: "A path opens.", description: "Complete the task." } });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.OPENAI_API_KEY;
});

function request(body = "v=0\r\no=- test-offer") {
  return new Request(`http://localhost/api/realtime/narration?campaignId=${campaignId}&questId=${questId}`, { method: "POST", headers: { "Content-Type": "application/sdp" }, body });
}

describe("POST /api/realtime/narration", () => {
  it("keeps the seeded demo off the live OpenAI path", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "demo", email: "hero@lifequest.demo" });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed SDP before creating a session", async () => {
    const response = await POST(request("not-sdp"));
    expect(response.status).toBe(400);
  });

  it("exchanges a valid offer without exposing the API key to the browser", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("v=0\r\no=- answer", { status: 200 }));
    globalThis.fetch = fetchSpy;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/sdp");
    expect(fetchSpy).toHaveBeenCalledWith("https://api.openai.com/v1/realtime/calls", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key", "OpenAI-Safety-Identifier": expect.any(String) }),
      body: expect.any(FormData),
    }));
  });
});
