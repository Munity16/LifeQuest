import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { isHeroTitleUnlocked, normalizeAppearancePreferences } from "@/lib/customization";
import { DEMO_PREFERENCES_COOKIE } from "@/lib/config";
import { encodeDemoAppearancePreferences, getDemoAppearancePreferences } from "@/lib/demo-session";
import { AppError, errorResponse } from "@/lib/errors";
import { appearancePreferencesSchema } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
};

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (auth.kind === "demo") return Response.json({ preferences: await getDemoAppearancePreferences() });
    if (auth.kind !== "user") throw new AppError("Sign in to customize your hero.", 401, "UNAUTHORIZED");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("profiles").select("appearance_preferences").eq("id", auth.user.id).single();
    if (error) throw new AppError("Your hero settings could not be loaded.", 500, "PREFERENCES_LOAD_FAILED");
    return Response.json({ preferences: normalizeAppearancePreferences(data.appearance_preferences) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const preferences = appearancePreferencesSchema.parse(await request.json());
    const auth = await getAuthContext();
    if (auth.kind === "anonymous") throw new AppError("Sign in to customize your hero.", 401, "UNAUTHORIZED");

    if (auth.kind === "demo") {
      const response = NextResponse.json({ preferences });
      response.cookies.set(DEMO_PREFERENCES_COOKIE, encodeDemoAppearancePreferences(preferences), cookieOptions);
      return response;
    }

    const supabase = await createSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("current_level").eq("id", auth.user.id).single();
    if (profileError) throw new AppError("Your hero settings could not be saved.", 500, "PREFERENCES_SAVE_FAILED");
    if (!isHeroTitleUnlocked(preferences.heroTitle, profile.current_level)) {
      throw new AppError("Complete more quests to unlock that title.", 400, "TITLE_LOCKED");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ appearance_preferences: preferences as unknown as Json })
      .eq("id", auth.user.id);
    if (error) throw new AppError("Your hero settings could not be saved.", 500, "PREFERENCES_SAVE_FAILED");
    return Response.json({ preferences });
  } catch (error) {
    return errorResponse(error);
  }
}
