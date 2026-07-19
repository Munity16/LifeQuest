import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, ScrollText, Sparkles, Swords } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { HeroAchievements } from "@/components/hero-achievements";
import { getAuthContext } from "@/lib/auth";
import { DEMO_CAMPAIGN_ID } from "@/lib/config";
import { getDemoCampaign } from "@/lib/demo-data";
import { getDemoCompletedQuestIds } from "@/lib/demo-session";
import { AppError } from "@/lib/errors";
import { getHeroRank } from "@/lib/gameplay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hero profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const auth = await getAuthContext();
  if (auth.kind === "anonymous") redirect("/login");

  if (auth.kind === "demo") {
    const campaign = getDemoCampaign(await getDemoCompletedQuestIds());
    return <ProfileView email={auth.email} displayName="Demo hero" totalXp={campaign.totalXp} level={campaign.currentLevel} campaigns={[{ id: DEMO_CAMPAIGN_ID, campaign_name: campaign.campaignName, status: campaign.status, enemy_current_health: campaign.enemyCurrentHealth }]} isDemo />;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: profile, error: profileError }, { data: campaigns, error: campaignsError }] = await Promise.all([
    supabase.from("profiles").select("display_name,total_xp,current_level").eq("id", auth.user.id).maybeSingle(),
    supabase.from("campaigns").select("id,campaign_name,status,enemy_current_health").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(6),
  ]);

  if (profileError || campaignsError) {
    console.error("Profile overview failed", { profileError, campaignsError });
    throw new AppError("Your hero profile could not be loaded.", 500, "PROFILE_LOAD_FAILED");
  }

  return <ProfileView email={auth.user.email ?? "Adventurer"} displayName={profile?.display_name ?? "Adventurer"} totalXp={profile?.total_xp ?? 0} level={profile?.current_level ?? 1} campaigns={campaigns ?? []} />;
}

function ProfileView({ email, displayName, totalXp, level, campaigns, isDemo = false }: { email: string; displayName: string; totalXp: number; level: number; campaigns: { id: string; campaign_name: string; status: string; enemy_current_health: number }[]; isDemo?: boolean }) {
  const rank = getHeroRank(level);
  return (
    <div className="site-page app-page">
      <AppHeader email={email} campaignId={campaigns[0]?.id} isDemo={isDemo} />
      <main id="main-content" className="page-shell profile-page">
        <section className="profile-hero panel-glow">
          <span className="profile-avatar profile-avatar-art"><Image src="/art/code-apprentice.webp" alt="Code Apprentice portrait" width={76} height={76} sizes="76px" /></span>
          <div><span className="eyebrow">Hero record</span><h1>{displayName}</h1><strong className="profile-rank">{rank}</strong><p>{email}</p></div>
          <dl><div><dt><Sparkles size={16} /> Total XP</dt><dd>{totalXp}</dd></div><div><dt><Crown size={16} /> Current level</dt><dd>{level}</dd></div><div><dt><Swords size={16} /> Campaigns</dt><dd>{campaigns.length}</dd></div></dl>
        </section>
        <HeroAchievements totalXp={totalXp} level={level} campaigns={campaigns.length} wonCampaigns={campaigns.filter((campaign) => campaign.status === "won").length} woundedEnemies={campaigns.filter((campaign) => campaign.enemy_current_health < 100).length} />
        <section className="profile-campaigns" aria-labelledby="profile-campaign-title">
          <div className="section-title-row"><div><span className="eyebrow"><ScrollText size={15} /> Save archive</span><h2 id="profile-campaign-title">Your adventures</h2></div><Link className="button button-secondary" href="/onboarding">New campaign</Link></div>
          {campaigns.length ? <div className="profile-campaign-list">{campaigns.map((campaign) => <Link key={campaign.id} href={`/campaign/${campaign.id}`}><div><strong>{campaign.campaign_name}</strong><span>{campaign.status}</span></div><small>{campaign.enemy_current_health} enemy HP remains</small></Link>)}</div> : <div className="state-card"><h2>No campaigns yet</h2><p>Forge your first campaign to begin earning XP.</p><Link className="button button-primary" href="/onboarding">Forge a campaign</Link></div>}
        </section>
      </main>
    </div>
  );
}
