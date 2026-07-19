import { authSchema } from "@/lib/schemas";
import { AppError, errorResponse } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { operationalErrorCode, operationalStatus, recordOperationalEvent } from "@/lib/telemetry";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  try {
    await enforceRateLimit(request, { action: "auth.signup", limit: 5, windowSeconds: 60 * 60 });
    const input = authSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      ...input,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback` },
    });
    if (error) throw new AppError(error.message, 400, "SIGNUP_FAILED");
    await recordOperationalEvent({ eventName: "auth.signup", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt) });
    return Response.json({
      success: true,
      requiresConfirmation: !data.session,
      redirectTo: data.session ? "/onboarding" : "/login?checkEmail=true",
    });
  } catch (error) {
    await recordOperationalEvent({ eventName: "auth.signup", traceId, status: operationalStatus(error), latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}
