import { authSchema } from "@/lib/schemas";
import { AppError, errorResponse } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const input = authSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (error) throw new AppError("Email or password was not recognised.", 401, "INVALID_CREDENTIALS");
    return Response.json({ success: true, redirectTo: "/onboarding" });
  } catch (error) {
    return errorResponse(error);
  }
}
