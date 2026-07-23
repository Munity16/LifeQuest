import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, Flame, ScrollText, Sparkles, Swords } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { HeroAchievements } from "@/components/hero-achievements";
import { HeroCustomizationPanel } from "@/components/hero-customization-panel";
import { HeroPortrait, HeroTitle } from "@/components/hero-customization";
import { getAuthContext } from "@/lib/auth";
import { DEMO_CAMPAIGN_ID } from "@/lib/config";
import { getDemoCampaign } from "@/lib/demo-data";
import { getDemoCompletedQuestIds } from "@/lib/demo-session";
import { AppError } from "@/lib/errors";
import { normalizePage, pageRange, totalPages } from "@/lib/pagination";
import { profileAggregatesSchema, type ProfileAggregates } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hero profile" };
export const dynamic = "force-dynamic";

interface CampaignSummary {
  id: string;
  campaign_name: string;
  status: string;
  enemy_current_health: number;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const auth = await getAuthContext();
  if (auth.kind === "anonymous") redirect("/login");
  const requestedPage = normalizePage((await searchParams).page);

  if (auth.kind === "demo") {
    const campaign = getDemoCampaign(await getDemoCompletedQuestIds());
    const completed = campaign.quests.filter((quest) => quest.status === "completed").length;
    return (
      <ProfileView
        email={auth.email}
        displayName="Demo hero"
        aggregates={{
          totalCampaigns: 1,
          activeCampaigns: campaign.status === "active" ? 1 : 0,
          pausedCampaigns: 0,
          wonCampaigns: campaign.status === "won" ? 1 : 0,
          archivedCampaigns: 0,
          totalQuestsCompleted: completed,
          totalXp: campaign.totalXp,
          totalEnemyDamage: campaign.enemyMaxHealth - campaign.enemyCurrentHealth,
          currentLevel: campaign.currentLevel,
          currentStreak: completed,
          longestStreak: completed,
        }}
        campaigns={[{
          id: DEMO_CAMPAIGN_ID,
          campaign_name: campaign.campaignName,
          status: campaign.status,
          enemy_current_health: campaign.enemyCurrentHealth,
        }]}
        page={1}
        pageCount={1}
        isDemo
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { from, to } = pageRange(requestedPage);
  const [
    { data: profile, error: profileError },
    { data: campaigns, error: campaignsError },
    { data: aggregateData, error: aggregateError },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("campaigns")
      .select("id,campaign_name,status,enemy_current_health")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase.rpc("get_my_profile_aggregates"),
  ]);

  if (profileError || campaignsError || aggregateError) {
    console.error("Profile overview failed", { profileError, campaignsError, aggregateError });
    throw new AppError("Your hero profile could not be loaded.", 500, "PROFILE_LOAD_FAILED");
  }

  const aggregates = profileAggregatesSchema.parse(aggregateData);
  const pageCount = totalPages(aggregates.totalCampaigns);
  const page = Math.min(requestedPage, pageCount);
  if (page !== requestedPage) redirect(`/profile?page=${page}`);

  return (
    <ProfileView
      email={auth.user.email ?? "Adventurer"}
      displayName={profile?.display_name ?? "Adventurer"}
      aggregates={aggregates}
      campaigns={campaigns ?? []}
      page={page}
      pageCount={pageCount}
    />
  );
}

function ProfileView({
  email,
  displayName,
  aggregates,
  campaigns,
  page,
  pageCount,
  isDemo = false,
}: {
  email: string;
  displayName: string;
  aggregates: ProfileAggregates;
  campaigns: CampaignSummary[];
  page: number;
  pageCount: number;
  isDemo?: boolean;
}) {
  return (
    <div className="site-page app-page">
      <AppHeader email={email} campaignId={campaigns[0]?.id} isDemo={isDemo} />
      <main id="main-content" className="page-shell profile-page">
        <section className="profile-hero panel-glow">
          <span className="profile-avatar profile-avatar-art"><HeroPortrait alt={`${displayName} portrait`} size={76} /></span>
          <div><span className="eyebrow">Hero record</span><h1>{displayName}</h1><HeroTitle as="strong" className="profile-rank" level={aggregates.currentLevel} /><p>{email}</p></div>
          <dl>
            <div><dt><Sparkles size={16} /> Total XP</dt><dd>{aggregates.totalXp}</dd></div>
            <div><dt><Crown size={16} /> Current level</dt><dd>{aggregates.currentLevel}</dd></div>
            <div><dt><Swords size={16} /> Campaigns</dt><dd>{aggregates.totalCampaigns}</dd></div>
            <div><dt><Flame size={16} /> Current streak</dt><dd>{aggregates.currentStreak}</dd></div>
          </dl>
        </section>
        <HeroCustomizationPanel level={aggregates.currentLevel} displayName={displayName} isDemo={isDemo} />
        <HeroAchievements
          totalXp={aggregates.totalXp}
          level={aggregates.currentLevel}
          campaigns={aggregates.totalCampaigns}
          wonCampaigns={aggregates.wonCampaigns}
          woundedEnemies={aggregates.totalEnemyDamage > 0 ? 1 : 0}
        />
        <section className="profile-campaigns" aria-labelledby="profile-campaign-title">
          <div className="section-title-row"><div><span className="eyebrow"><ScrollText size={15} /> Save archive</span><h2 id="profile-campaign-title">Your adventures</h2></div><Link className="button button-secondary" href="/onboarding">New campaign</Link></div>
          {campaigns.length ? (
            <>
              <div className="profile-campaign-list">
                {campaigns.map((campaign) => (
                  <Link key={campaign.id} href={`/campaign/${campaign.id}`}>
                    <div><strong>{campaign.campaign_name}</strong><span>{campaign.status}</span></div>
                    <small>{campaign.enemy_current_health} enemy HP remains</small>
                  </Link>
                ))}
              </div>
              {pageCount > 1 && (
                <nav className="profile-pagination" aria-label="Campaign history pages">
                  {page > 1 ? <Link className="button button-secondary" href={`/profile?page=${page - 1}`}>Previous</Link> : <span />}
                  <span aria-current="page">Page {page} of {pageCount}</span>
                  {page < pageCount ? <Link className="button button-secondary" href={`/profile?page=${page + 1}`}>Next</Link> : <span />}
                </nav>
              )}
            </>
          ) : (
            <div className="state-card"><h2>No campaigns yet</h2><p>Forge your first campaign to begin earning XP.</p><Link className="button button-primary" href="/onboarding">Forge a campaign</Link></div>
          )}
        </section>
      </main>
    </div>
  );
}
