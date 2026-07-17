import { getAuthContext } from "@/lib/auth";
import { getDemoCampaign } from "@/lib/demo-data";
import { getDemoCompletedQuestIds } from "@/lib/demo-session";
import { AppError, errorResponse } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (auth.kind === "demo") {
      return Response.json({ campaign: getDemoCampaign(await getDemoCompletedQuestIds()) });
    }
    if (auth.kind !== "user") throw new AppError("Sign in to view progress.", 401, "UNAUTHORIZED");

    const supabase = await createSupabaseServerClient();
    const [{ data: profile }, { data: campaign }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
      supabase.from("campaigns").select("id,campaign_name,status,enemy_current_health").eq("user_id", auth.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return Response.json({ profile, campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
