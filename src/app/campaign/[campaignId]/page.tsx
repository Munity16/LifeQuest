import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Flag, ScrollText, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CampaignHero } from "@/components/campaign-hero";
import { EmptyState } from "@/components/states";
import { QuestCard } from "@/components/quest-card";
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

  const activeQuests = campaign.quests.filter((quest) => quest.status !== "completed");
  const completedQuests = campaign.quests.filter((quest) => quest.status === "completed");
  const progress = campaignProgress(campaign);

  return (
    <div className="site-page app-page">
      <AppHeader email={campaign.userEmail} campaignId={campaign.id} isDemo={campaign.isDemo} />
      <main id="main-content" className="page-shell campaign-page">
        {campaign.isDemo && <div className="demo-banner"><Sparkles size={16} /><span>Seeded demo campaign. AI generation and verification are simulated and clearly labelled in this mode.</span><Link href="/onboarding">Reset goal</Link></div>}
        <CampaignHero campaign={campaign} />

        <section className="campaign-progress-card" aria-label={`Campaign ${progress}% complete`}>
          <div><span><Flag size={16} /> Campaign progress</span><strong>{completedQuests.length} of {campaign.quests.filter((quest) => !quest.isAdaptive).length} core quests complete</strong></div>
          <div className="progress-track campaign-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        </section>

        <section className="quest-section" aria-labelledby="quest-title">
          <div className="section-title-row"><div><span className="eyebrow"><ScrollText size={15} /> Quest log</span><h2 id="quest-title">Choose the next move</h2></div><small>{activeQuests.filter((quest) => quest.status !== "locked").length} ready</small></div>
          {activeQuests.length ? <div className="quest-grid">{activeQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />)}</div> : <EmptyState title="The campaign is won" message="Every quest on this path is complete. Your progress is safely recorded." actionHref="/onboarding" actionLabel="Forge another campaign" />}
        </section>

        <section className="history-section" aria-labelledby="history-title">
          <div className="section-title-row"><div><span className="eyebrow"><CheckCircle2 size={15} /> Victory archive</span><h2 id="history-title">Completed quests</h2></div><small>{completedQuests.length} recorded</small></div>
          {completedQuests.length ? <div className="quest-grid history-grid">{completedQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />)}</div> : <EmptyState title="No victories recorded yet" message="Open an available quest, complete the practical task, and submit clear image proof." />}
        </section>
      </main>
    </div>
  );
}
