import "server-only";

import { z } from "zod";
import { AppError, RateLimitError } from "@/lib/errors";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

const telemetryEventSchema = z.object({
  eventName: z.enum([
    "auth.login",
    "auth.signup",
    "campaign.generate",
    "proof.upload",
    "proof.verify",
    "proof.delete",
    "proof.retention",
    "narration.connect",
  ]),
  traceId: z.uuid(),
  status: z.enum(["success", "rejected", "error", "rate_limited"]),
  latencyMs: z.number().int().nonnegative().optional(),
  errorCode: z.string().max(80).optional(),
  model: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.union([z.boolean(), z.number().finite()])).default({}),
});

export type OperationalEvent = z.input<typeof telemetryEventSchema>;

export function operationalErrorCode(error: unknown) {
  return error instanceof AppError ? error.code : "UNEXPECTED_ERROR";
}

export async function recordOperationalEvent(input: OperationalEvent) {
  if (process.env.TELEMETRY_ENABLED === "false") return;
  const event = telemetryEventSchema.parse(input);
  if (process.env.NODE_ENV !== "test") {
    console.info(JSON.stringify({ type: "lifequest.operation", ...event }));
  }
  if (!isSupabaseAdminConfigured()) return;

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("operational_events").insert({
      event_name: event.eventName,
      trace_id: event.traceId,
      status: event.status,
      latency_ms: event.latencyMs,
      error_code: event.errorCode,
      model: event.model,
      metadata: event.metadata,
    });
    if (error && process.env.NODE_ENV !== "test") {
      console.warn("Operational event persistence failed", { eventName: event.eventName, code: error.code });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Operational telemetry failed safely", { code: operationalErrorCode(error) });
    }
  }
}

export function operationalStatus(error: unknown) {
  return error instanceof RateLimitError ? "rate_limited" as const : "error" as const;
}
