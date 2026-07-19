import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { isDemoEnabled } from "@/lib/config";
import { ConfigurationError, RateLimitError } from "@/lib/errors";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type RateLimitAction =
  | "auth.login"
  | "auth.signup"
  | "campaign.generate"
  | "proof.upload"
  | "proof.verify"
  | "proof.delete"
  | "narration.connect";

const resultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().int().nonnegative(),
  retryAfterSeconds: z.number().int().positive(),
});

type MemoryEntry = { count: number; expiresAt: number };
const memoryLimits = new Map<string, MemoryEntry>();

function getRequestIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local-client";
}

function hashIdentifier(action: RateLimitAction, identifier: string) {
  const salt = process.env.RATE_LIMIT_SALT;
  if (process.env.NODE_ENV === "production" && !isDemoEnabled() && (!salt || salt.length < 32)) {
    throw new ConfigurationError("Production rate limiting requires a strong RATE_LIMIT_SALT.");
  }
  return createHash("sha256").update(`${salt || "lifequest-local-only"}:${action}:${identifier}`).digest("hex");
}

function consumeMemoryLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const existing = memoryLimits.get(key);
  const entry = !existing || existing.expiresAt <= now
    ? { count: 1, expiresAt: now + windowSeconds * 1000 }
    : { count: existing.count + 1, expiresAt: existing.expiresAt };
  memoryLimits.set(key, entry);
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
  };
}

export async function enforceRateLimit(
  request: Request,
  options: { action: RateLimitAction; limit: number; windowSeconds: number; subject?: string },
) {
  const identifier = options.subject || getRequestIdentifier(request);
  const identifierHash = hashIdentifier(options.action, identifier);
  let result;

  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_api_rate_limit", {
      p_identifier_hash: identifierHash,
      p_action: options.action,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });
    if (error) throw new ConfigurationError("The production rate limiter is unavailable.");
    result = resultSchema.parse(data);
  } else {
    if (process.env.NODE_ENV === "production" && !isDemoEnabled()) {
      throw new ConfigurationError("Production rate limiting requires Supabase service credentials.");
    }
    result = consumeMemoryLimit(identifierHash, options.limit, options.windowSeconds);
  }

  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
  return result;
}
