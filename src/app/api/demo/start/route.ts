import { NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_PREFERENCES_COOKIE, DEMO_PROGRESS_COOKIE, isDemoEnabled } from "@/lib/config";
import { DEFAULT_APPEARANCE_PREFERENCES } from "@/lib/customization";
import { encodeDemoAppearancePreferences } from "@/lib/demo-session";

export async function GET(request: Request) {
  if (!isDemoEnabled()) {
    return NextResponse.redirect(new URL("/?demo=disabled", request.url));
  }

  const response = NextResponse.redirect(new URL("/onboarding", request.url));
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
  response.cookies.set(DEMO_COOKIE, "active", cookieOptions);
  response.cookies.set(DEMO_PROGRESS_COOKIE, encodeURIComponent("[]"), cookieOptions);
  response.cookies.set(DEMO_PREFERENCES_COOKIE, encodeDemoAppearancePreferences(DEFAULT_APPEARANCE_PREFERENCES), cookieOptions);
  return response;
}
