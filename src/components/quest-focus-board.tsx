import { ArrowRight, CheckCircle2, Clock3, MapPinned, ScrollText, Swords, Zap } from "lucide-react";
import Link from "next/link";
import type { QuestView } from "@/lib/types";

export function QuestFocusBoard({
  readyQuests,
  completedCount,
  totalCount,
  progress,
}: {
  readyQuests: QuestView[];
  completedCount: number;
  totalCount: number;
  progress: number;
}) {
  const recommended = readyQuests[0];
  const additional = readyQuests.slice(1, 3);

  return (
    <section className="quest-focus-board" aria-labelledby="quest-board-title">
      <div className="quest-board-heading">
        <div><span className="eyebrow"><ScrollText size={14} /> Your next move</span><h2 id="quest-board-title">Continue your adventure</h2></div>
        <span className="quest-board-count"><strong>{readyQuests.length}</strong> ready</span>
      </div>

      {recommended ? (
        <div className="quest-board-grid">
          <article className="quest-board-featured">
            <div className="quest-board-kicker"><span>Recommended next</span><small>Day {recommended.dayNumber}</small></div>
            <h3>{recommended.title}</h3>
            <p>{recommended.description}</p>
            <div className="quest-board-rewards" aria-label="Recommended quest details">
              <span><Clock3 size={13} /> {recommended.estimatedMinutes} min</span>
              <span><Zap size={13} /> {recommended.xpReward} XP</span>
              <span><Swords size={13} /> {recommended.enemyDamage} damage</span>
            </div>
            <Link className="quest-board-primary-action" href={`/campaign/${recommended.campaignId}/quest/${recommended.id}`} aria-label={`Continue quest: ${recommended.title}`}>Continue quest <ArrowRight size={16} /></Link>
          </article>

          <div className="quest-board-side">
            <div className="quest-board-progress">
              <CheckCircle2 size={19} />
              <div><strong>{completedCount} / {totalCount} cleared</strong><span>Every victory weakens the nemesis.</span></div>
              <div className="quest-board-progress-track" role="progressbar" aria-label={`Campaign ${progress}% complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
            </div>
            {additional.map((quest) => (
              <Link className="quest-board-compact" href={`/campaign/${quest.campaignId}/quest/${quest.id}`} key={quest.id}>
                <span><small>Day {quest.dayNumber}</small><strong>{quest.title}</strong></span>
                <span><Zap size={12} /> {quest.xpReward} XP <ArrowRight size={14} /></span>
              </Link>
            ))}
            {additional.length === 0 && <p className="quest-board-hint">Complete this mission to reveal your next best move.</p>}
            <a className="quest-board-map-link" href="#adventure-map"><MapPinned size={14} /> View full adventure map</a>
          </div>
          <Link className="mobile-quest-cta" href={`/campaign/${recommended.campaignId}/quest/${recommended.id}`} aria-label={`Continue quest: ${recommended.title}`}><span><small>Current quest</small><strong>{recommended.title}</strong></span><span>Continue <ArrowRight size={16} /></span></Link>
        </div>
      ) : (
        <div className="quest-board-victory"><CheckCircle2 size={25} /><div><strong>Quest board cleared</strong><p>No core missions remain. Your campaign victory is recorded.</p></div></div>
      )}
    </section>
  );
}
