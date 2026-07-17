import "server-only";

import type { User } from "@supabase/supabase-js";
import { hasDemoSession } from "@/lib/demo-session";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AuthContext =
  | { kind: "demo"; email: "hero@lifequest.demo" }
  | { kind: "user"; user: User }
  | { kind: "anonymous" };

export async function getAuthContext(): Promise<AuthContext> {
  if (await hasDemoSession()) {
    return { kind: "demo", email: "hero@lifequest.demo" };
  }

  if (!isSupabaseConfigured()) return { kind: "anonymous" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: "anonymous" };
  return { kind: "user", user: data.user };
}
