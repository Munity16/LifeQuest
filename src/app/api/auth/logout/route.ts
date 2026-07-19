import { NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_PREFERENCES_COOKIE, DEMO_PROGRESS_COOKIE } from "@/lib/config";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(DEMO_COOKIE);
  response.cookies.delete(DEMO_PROGRESS_COOKIE);
  response.cookies.delete(DEMO_PREFERENCES_COOKIE);
  return response;
}
