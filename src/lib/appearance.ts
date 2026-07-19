import "server-only";

import { cache } from "react";
import { getAuthContext } from "@/lib/auth";
import { DEFAULT_APPEARANCE_PREFERENCES, normalizeAppearancePreferences } from "@/lib/customization";
import { getDemoAppearancePreferences } from "@/lib/demo-session";
import type { AppearancePreferences } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getAppearancePreferences = cache(async (): Promise<AppearancePreferences> => {
  const auth = await getAuthContext();
  if (auth.kind === "demo") return getDemoAppearancePreferences();
  if (auth.kind !== "user") return DEFAULT_APPEARANCE_PREFERENCES;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("appearance_preferences")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("Appearance preferences could not be loaded", error);
    return DEFAULT_APPEARANCE_PREFERENCES;
  }
  return normalizeAppearancePreferences(data?.appearance_preferences);
});
