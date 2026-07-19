import { authSchema } from "@/lib/schemas";
import { AppError, errorResponse } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { operationalErrorCode, operationalStatus, recordOperationalEvent } from "@/lib/telemetry";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  try {
    await enforceRateLimit(request, { action: "auth.login", limit: 8, windowSeconds: 10 * 60 });
    const input = authSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (error) throw new AppError("Email or password was not recognised.", 401, "INVALID_CREDENTIALS");
    await recordOperationalEvent({ eventName: "auth.login", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt) });
    return Response.json({ success: true, redirectTo: "/onboarding" });
  } catch (error) {
    await recordOperationalEvent({ eventName: "auth.login", traceId, status: operationalStatus(error), latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}
