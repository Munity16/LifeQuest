import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { DEMO_PROGRESS_COOKIE, isDemoEnabled } from "@/lib/config";
import { encodeDemoProgress } from "@/lib/demo-session";

export async function POST() {
  if (!isDemoEnabled()) {
    return NextResponse.json({ error: { code: "DEMO_DISABLED", message: "Demo mode is disabled." } }, { status: 403 });
  }

  const auth = await getAuthContext();
  if (auth.kind !== "demo") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "A demo session is required." } }, { status: 401 });
  }

  const response = NextResponse.json({ reset: true });
  response.cookies.set(DEMO_PROGRESS_COOKIE, encodeDemoProgress([]), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
