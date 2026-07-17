import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Clock3, ImageUp, LockKeyhole, ScrollText, Swords, Zap } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ProofUploader } from "@/components/proof-uploader";
import { QuestStatusBadge } from "@/components/quest-status-badge";
import { getAuthContext } from "@/lib/auth";
import { getQuest } from "@/lib/data";

export const metadata: Metadata = { title: "Quest" };
export const dynamic = "force-dynamic";

export default async function QuestPage({ params }: { params: Promise<{ campaignId: string; questId: string }> }) {
  const auth = await getAuthContext();
  if (auth.kind === "anonymous") redirect("/login");

  const { campaignId, questId } = await params;
  const result = await getQuest(campaignId, questId);
  if (!result) notFound();
  const { campaign, quest } = result;
  const locked = quest.status === "locked";

  return (
    <div className="site-page app-page">
      <AppHeader email={campaign.userEmail} campaignId={campaign.id} isDemo={campaign.isDemo} />
      <main id="main-content" className="page-shell quest-page">
        <Link className="back-link" href={`/campaign/${campaign.id}`}><ArrowLeft size={16} /> Back to campaign</Link>
        <div className="quest-layout">
          <article className="quest-detail panel-glow">
            <div className="quest-detail-top"><span className="eyebrow"><ScrollText size={15} /> {quest.isAdaptive ? "Adaptive quest" : `Quest ${String(quest.sequenceNumber).padStart(2, "0")}`}</span><QuestStatusBadge status={quest.status} adaptive={quest.isAdaptive} /></div>
            <h1>{quest.title}</h1>
            <p className="quest-story-intro">{quest.storyIntro}</p>
            <div className="practical-task"><span>Practical objective</span><p>{quest.description}</p></div>
            <dl className="quest-reward-row">
              <div><dt><Clock3 size={15} /> Time</dt><dd>{quest.estimatedMinutes} min</dd></div>
              <div><dt><Zap size={15} /> Reward</dt><dd>{quest.xpReward} XP</dd></div>
              <div><dt><Swords size={15} /> Impact</dt><dd>{quest.enemyDamage} damage</dd></div>
            </dl>
            <section className="requirements" aria-labelledby="requirements-title">
              <h2 id="requirements-title">What the proof must show</h2>
              <ul>{quest.successRequirements.map((requirement) => <li key={requirement}><Check size={16} aria-hidden="true" /><span>{requirement}</span></li>)}</ul>
            </section>
          </article>

          <aside className="proof-panel" aria-labelledby="proof-title">
            <div className="proof-panel-heading"><span className="proof-icon"><ImageUp size={21} /></span><div><small>Final step</small><h2 id="proof-title">Submit image proof</h2></div></div>
            <p>Use one clear screenshot or photo that visibly demonstrates the requirements. Do not include passwords, identity documents, or sensitive personal information.</p>
            {locked ? <div className="locked-proof"><LockKeyhole size={21} /><strong>This quest is still locked</strong><p>Complete an available quest first. No proof can be submitted for a locked quest.</p></div> : <ProofUploader questId={quest.id} completed={quest.status === "completed"} />}
          </aside>
        </div>
      </main>
    </div>
  );
}
