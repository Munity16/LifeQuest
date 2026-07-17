import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { OnboardingForm } from "@/components/onboarding-form";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = { title: "Forge a campaign" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const auth = await getAuthContext();
  if (auth.kind === "anonymous") redirect("/login");

  const isDemo = auth.kind === "demo";
  const email = auth.kind === "user" ? auth.user.email : auth.email;

  return (
    <div className="site-page app-page">
      <AppHeader email={email} isDemo={isDemo} />
      <main id="main-content" className="page-shell onboarding-page">
        <header className="page-intro centered-intro">
          <span className="eyebrow">Campaign forge</span>
          <h1>Turn your goal into a questline.</h1>
          <p>Give LifeQuest the practical constraints. The story will serve the work—not distract from it.</p>
        </header>
        <OnboardingForm isDemo={isDemo} />
      </main>
    </div>
  );
}
