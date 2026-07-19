import { describe, expect, it } from "vitest";
import { RateLimitError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";

describe("server rate limiting", () => {
  it("blocks a repeated request after the configured limit", async () => {
    process.env.DEMO_MODE_ENABLED = "true";
    const request = new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": `198.51.100.${Date.now() % 200}` } });
    await expect(enforceRateLimit(request, { action: "auth.login", limit: 1, windowSeconds: 60 })).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(enforceRateLimit(request, { action: "auth.login", limit: 1, windowSeconds: 60 })).rejects.toBeInstanceOf(RateLimitError);
  });
});
