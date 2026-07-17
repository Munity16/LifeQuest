import { authSchema } from "@/lib/schemas";
import { AppError, errorResponse } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const input = authSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      ...input,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback` },
    });
    if (error) throw new AppError(error.message, 400, "SIGNUP_FAILED");
    return Response.json({
      success: true,
      requiresConfirmation: !data.session,
      redirectTo: data.session ? "/onboarding" : "/login?checkEmail=true",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
