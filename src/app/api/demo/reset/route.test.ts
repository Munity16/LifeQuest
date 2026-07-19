import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/reset/route";

const mocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));

beforeEach(() => {
  process.env.DEMO_MODE_ENABLED = "true";
  mocks.getAuthContext.mockReset();
  mocks.getAuthContext.mockResolvedValue({ kind: "demo", email: "hero@lifequest.demo" });
});

describe("POST /api/demo/reset", () => {
  it("clears seeded progress for an active demo session", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reset: true });
    expect(response.headers.get("set-cookie")).toContain("lifequest_demo_progress=%255B%255D");
  });

  it("does not reset progress for a real user", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "user", user: { id: "user-id" } });
    const response = await POST();
    expect(response.status).toBe(401);
  });
});
