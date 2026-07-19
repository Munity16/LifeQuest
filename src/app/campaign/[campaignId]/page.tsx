import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flag, MapPinned, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CampaignHud } from "@/components/campaign-hud";
import { CampaignHero } from "@/components/campaign-hero";
import { DemoResetButton } from "@/components/demo-reset-button";
import { EmptyState } from "@/components/states";
import { QuestCard } from "@/components/quest-card";
import { QuestFocusBoard } from "@/components/quest-focus-board";
import { QuestMap } from "@/components/quest-map";
import { getAuthContext } from "@/lib/auth";
import { campaignProgress, getCampaign } from "@/lib/data";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await getAuthContext();
  if (auth.kind === "anonymous") redirect("/login");

  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  const coreQuests = campaign.quests.filter((quest) => !quest.isAdaptive);
  const adaptiveQuests = campaign.quests.filter((quest) => quest.isAdaptive);
  const completedQuests = campaign.quests.filter((quest) => quest.status === "completed");
  const readyQuests = coreQuests.filter((quest) => quest.status === "available" || quest.status === "in_progress");
  const progress = campaignProgress(campaign);

  return (
    <div className="site-page app-page">
      <AppHeader email={campaign.userEmail} campaignId={campaign.id} isDemo={campaign.isDemo} />
      <CampaignHud campaign={campaign} />
      <main id="main-content" className="page-shell campaign-page">
        {campaign.isDemo && <div className="demo-banner"><Sparkles size={16} /><span><strong>Seeded demo</strong> · Campaign generation and verification are simulated, never presented as live AI.</span><DemoResetButton /><Link href="/onboarding">New game</Link></div>}
        <CampaignHero campaign={campaign} />

        <section className="campaign-progress-card" aria-label={`Campaign ${progress}% complete`}>
          <div><span><Flag size={16} /> Campaign progress</span><strong>{coreQuests.filter((quest) => quest.status === "completed").length} of {coreQuests.length} core quests complete</strong></div>
          <div className="progress-track campaign-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        </section>

        <QuestFocusBoard readyQuests={readyQuests} completedCount={coreQuests.filter((quest) => quest.status === "completed").length} totalCount={coreQuests.length} />

        <section className="quest-section" aria-labelledby="quest-title">
          <div className="section-title-row"><div><span className="eyebrow"><MapPinned size={15} /> Adventure map</span><h2 id="quest-title">Follow the path to victory</h2></div><small>{readyQuests.length} quests ready</small></div>
          {coreQuests.length ? <QuestMap quests={coreQuests} /> : <EmptyState title="The campaign is won" message="Every quest on this path is complete. Your progress is safely recorded." actionHref="/onboarding" actionLabel="Forge another campaign" />}
        </section>

        {adaptiveQuests.length > 0 && <section className="history-section" aria-labelledby="adaptive-title"><div className="section-title-row"><div><span className="eyebrow"><Sparkles size={15} /> Newly discovered</span><h2 id="adaptive-title">Side paths</h2></div><small>{adaptiveQuests.length} adaptive</small></div><div className="quest-grid history-grid">{adaptiveQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />)}</div></section>}

        {completedQuests.length === 0 && <div className="campaign-tip"><MapPinned size={18} /><div><strong>Your first landmark awaits.</strong><span>Choose a glowing quest node, complete the practical task, and return with proof.</span></div></div>}
      </main>
    </div>
  );
}
