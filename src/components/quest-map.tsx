import Link from "next/link";
import { Check, Clock3, LockKeyhole, MapPin, Radio, Swords, Zap } from "lucide-react";
import { QuestStatusBadge } from "@/components/quest-status-badge";
import { cn } from "@/lib/utils";
import type { QuestView } from "@/lib/types";

export function QuestMap({ quests }: { quests: QuestView[] }) {
  return (
    <div className="quest-map-shell">
      <div className="quest-map-legend" aria-hidden="true">
        <span><Radio size={12} /> Ready</span>
        <span><LockKeyhole size={12} /> Fogged</span>
        <span><Check size={12} /> Victory</span>
      </div>
      <ol className="quest-path" aria-label="Campaign quest path">
        {quests.map((quest, index) => {
          const locked = quest.status === "locked";
          const completed = quest.status === "completed";
          const content = (
            <>
              <div className="quest-node-top">
                <span className="quest-location"><MapPin size={13} aria-hidden="true" /> Day {quest.dayNumber}</span>
                <QuestStatusBadge status={quest.status} adaptive={quest.isAdaptive} />
              </div>
              <h3>{quest.title}</h3>
              <p>{quest.description}</p>
              <div className="quest-node-rewards" aria-label="Quest rewards">
                <span><Clock3 size={13} /> {quest.estimatedMinutes}m</span>
                <span><Zap size={13} /> {quest.xpReward} XP</span>
                <span><Swords size={13} /> {quest.enemyDamage} DMG</span>
              </div>
              <strong className="quest-node-action">{locked ? "Path obscured" : completed ? "Read chronicle" : "Begin quest"}</strong>
              {completed && <span className="victory-seal" aria-label="Quest completed"><Check size={19} /> Victory</span>}
              {locked && <span className="quest-fog" aria-hidden="true" />}
            </>
          );

          return (
            <li className={cn("quest-path-item", `quest-path-${quest.status}`)} key={quest.id}>
              <span className="quest-path-line" aria-hidden="true" />
              <span className="quest-path-marker" aria-hidden="true">{completed ? <Check size={17} /> : locked ? <LockKeyhole size={15} /> : index + 1}</span>
              {locked ? (
                <div className="quest-node" aria-label={`${quest.title}, locked`}>{content}</div>
              ) : (
                <Link className="quest-node" href={`/campaign/${quest.campaignId}/quest/${quest.id}`}>{content}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
