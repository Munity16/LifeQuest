import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { BrandMark } from "@/components/brand-mark";
import { getAuthContext } from "@/lib/auth";
import { isDemoEnabled } from "@/lib/config";

export const metadata: Metadata = { title: "Create your hero" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const auth = await getAuthContext();
  if (auth.kind !== "anonymous") redirect("/onboarding");

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-ambient" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <BrandMark />
        <div className="auth-heading"><span>Begin a new adventure</span><h1 id="auth-title">Create your hero.</h1><p>Turn one real goal into a campaign you can finish.</p></div>
        <AuthForm mode="signup" demoEnabled={isDemoEnabled()} />
      </section>
    </main>
  );
}
