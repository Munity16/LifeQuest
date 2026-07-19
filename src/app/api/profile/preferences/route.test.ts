import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APPEARANCE_PREFERENCES } from "@/lib/customization";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  getDemoAppearancePreferences: vi.fn(),
  encodeDemoAppearancePreferences: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.getAuthContext }));
vi.mock("@/lib/demo-session", () => ({
  getDemoAppearancePreferences: mocks.getDemoAppearancePreferences,
  encodeDemoAppearancePreferences: mocks.encodeDemoAppearancePreferences,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { PUT } from "@/app/api/profile/preferences/route";

beforeEach(() => {
  mocks.getAuthContext.mockReset();
  mocks.getDemoAppearancePreferences.mockReset();
  mocks.encodeDemoAppearancePreferences.mockReset();
  mocks.createSupabaseServerClient.mockReset();
  mocks.getAuthContext.mockResolvedValue({ kind: "demo", email: "hero@lifequest.demo" });
  mocks.encodeDemoAppearancePreferences.mockReturnValue("encoded-preferences");
});

describe("PUT /api/profile/preferences", () => {
  it("stores validated demo preferences in an HTTP-only cookie", async () => {
    const preferences = { ...DEFAULT_APPEARANCE_PREFERENCES, theme: "moonlit" as const, archetype: "mage" as const };
    const response = await PUT(new Request("http://localhost/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ preferences });
    expect(response.headers.get("set-cookie")).toContain("lifequest_demo_preferences=encoded-preferences");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects incomplete or invented appearance values", async () => {
    const response = await PUT(new Request("http://localhost/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "neon" }),
    }));
    expect(response.status).toBe(400);
  });

  it("requires an authenticated hero", async () => {
    mocks.getAuthContext.mockResolvedValueOnce({ kind: "anonymous" });
    const response = await PUT(new Request("http://localhost/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_APPEARANCE_PREFERENCES),
    }));
    expect(response.status).toBe(401);
  });
});
