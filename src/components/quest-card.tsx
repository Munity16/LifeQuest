import Link from "next/link";
import { ArrowUpRight, Clock3, Swords, Zap } from "lucide-react";
import { QuestStatusBadge } from "@/components/quest-status-badge";
import type { QuestView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuestCard({ quest }: { quest: QuestView }) {
  const locked = quest.status === "locked";
  return (
    <article className={cn("quest-card", quest.status === "completed" && "quest-card-complete", locked && "quest-card-locked")}>
      <div className="quest-card-top">
        <span className="quest-number">{quest.isAdaptive ? "NEW PATH" : `QUEST ${String(quest.sequenceNumber).padStart(2, "0")}`}</span>
        <QuestStatusBadge status={quest.status} adaptive={quest.isAdaptive} />
      </div>
      <div>
        <h3>{quest.title}</h3>
        <p>{quest.description}</p>
      </div>
      <div className="quest-meta" aria-label="Quest details">
        <span><Clock3 size={14} /> {quest.estimatedMinutes} min</span>
        <span><Zap size={14} /> {quest.xpReward} XP</span>
        <span><Swords size={14} /> {quest.enemyDamage} DMG</span>
      </div>
      {locked ? (
        <span className="quest-link-disabled">Complete an available quest to unlock</span>
      ) : (
        <Link className="quest-link" href={`/campaign/${quest.campaignId}/quest/${quest.id}`}>
          {quest.status === "completed" ? "View victory" : "Open quest"} <ArrowUpRight size={16} />
        </Link>
      )}
    </article>
  );
}
