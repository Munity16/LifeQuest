import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { BrandMark } from "@/components/brand-mark";
import { getAuthContext } from "@/lib/auth";
import { isDemoEnabled } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ checkEmail?: string; authError?: string }> }) {
  const auth = await getAuthContext();
  if (auth.kind !== "anonymous") redirect("/onboarding");
  const query = await searchParams;

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-ambient" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <BrandMark />
        <div className="auth-heading"><span>Welcome back, adventurer</span><h1 id="auth-title">Continue your campaign.</h1><p>Your quests and progress are waiting.</p></div>
        {query.checkEmail === "true" && <div className="auth-notice" role="status">Check your inbox to confirm your email, then return here to sign in.</div>}
        {query.authError && <div className="form-error" role="alert">The sign-in link could not be completed. Please request a new link or sign in again.</div>}
        <AuthForm mode="login" demoEnabled={isDemoEnabled()} />
      </section>
    </main>
  );
}
