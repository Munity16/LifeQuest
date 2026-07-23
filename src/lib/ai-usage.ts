import "server-only";

import { z } from "zod";
import { AppError, ConfigurationError } from "@/lib/errors";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const aiOperationSchema = z.enum([
  "campaign_generation",
  "proof_moderation",
  "proof_verification",
  "adaptive_generation",
  "realtime_narration",
]);

export type AiOperation = z.infer<typeof aiOperationSchema>;

const monthlyUsageSchema = z.object({
  campaignGeneration: z.number().int().nonnegative(),
  proofModeration: z.number().int().nonnegative(),
  proofVerification: z.number().int().nonnegative(),
  adaptiveGeneration: z.number().int().nonnegative(),
  realtimeNarration: z.number().int().nonnegative(),
  inputUnits: z.number().int().nonnegative(),
  outputUnits: z.number().int().nonnegative(),
  estimatedCostMicrousd: z.number().int().nonnegative(),
});

const usageKeys = {
  campaign_generation: "campaignGeneration",
  proof_moderation: "proofModeration",
  proof_verification: "proofVerification",
  adaptive_generation: "adaptiveGeneration",
  realtime_narration: "realtimeNarration",
} as const;

const defaultLimits: Record<AiOperation, number> = {
  campaign_generation: 20,
  proof_moderation: 120,
  proof_verification: 120,
  adaptive_generation: 30,
  realtime_narration: 120,
};

function configuredLimit(operation: AiOperation) {
  const environmentName = `AI_MONTHLY_${operation.toUpperCase()}_LIMIT`;
  const raw = process.env[environmentName];
  if (!raw) return defaultLimits[operation];
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000) {
    throw new ConfigurationError(`${environmentName} must be an integer from 1 to 100000.`);
  }
  return parsed;
}
export async function assertAiUsageAvailable(userId: string, operation: AiOperation) {
  if (!isSupabaseAdminConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigurationError("AI usage enforcement requires Supabase service credentials.");
    }
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_ai_usage_monthly_for_user", { p_user_id: userId });
  if (error) throw new ConfigurationError("AI usage totals are temporarily unavailable.");
  const usage = monthlyUsageSchema.parse(data);
  if (usage[usageKeys[operation]] >= configuredLimit(operation)) {
    throw new AppError(
      "This month’s AI allowance has been reached. Continue with saved campaign actions or try again next month.",
      429,
      "AI_USAGE_LIMIT_REACHED",
    );
  }
}

export async function recordAiUsage(input: {
  userId: string;
  operation: AiOperation;
  model: string;
  traceId: string;
  latencyMs: number;
  success: boolean;
  inputUnits?: number;
  outputUnits?: number;
  estimatedCostMicrousd?: number;
}) {
  if (!isSupabaseAdminConfigured()) return;
  const event = z.object({
    userId: z.uuid(),
    operation: aiOperationSchema,
    model: z.string().min(1).max(120),
    traceId: z.uuid(),
    latencyMs: z.number().int().nonnegative(),
    success: z.boolean(),
    inputUnits: z.number().int().nonnegative().optional(),
    outputUnits: z.number().int().nonnegative().optional(),
    estimatedCostMicrousd: z.number().int().nonnegative().optional(),
  }).parse(input);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("ai_usage_events").insert({
    user_id: event.userId,
    operation: event.operation,
    model: event.model,
    trace_id: event.traceId,
    latency_ms: event.latencyMs,
    success: event.success,
    input_units: event.inputUnits,
    output_units: event.outputUnits,
    estimated_cost_microusd: event.estimatedCostMicrousd,
  });
  if (error && process.env.NODE_ENV !== "test") {
    console.warn("AI usage persistence failed safely", { operation: event.operation, code: error.code });
  }
}
