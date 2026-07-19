import Image from "next/image";
import Link from "next/link";
import { Shield, Sparkles, Swords } from "lucide-react";
import { calculateLevelProgress, getHeroRank } from "@/lib/gameplay";
import type { CampaignView } from "@/lib/types";

export function CampaignHud({ campaign }: { campaign: CampaignView }) {
  const xp = calculateLevelProgress(campaign.totalXp);
  const enemyPercentage = Math.round((campaign.enemyCurrentHealth / Math.max(1, campaign.enemyMaxHealth)) * 100);
  const rank = getHeroRank(campaign.currentLevel, campaign.heroName);

  return (
    <aside className="campaign-hud" aria-label="Campaign status">
      <div className="page-shell campaign-hud-inner">
        <div className="hud-combatant hud-hero">
          <span className="hud-portrait"><Image src="/art/code-apprentice.webp" alt="" width={56} height={56} sizes="56px" /></span>
          <div className="hud-stat-copy">
            <span><Sparkles size={13} aria-hidden="true" /> Level {campaign.currentLevel}</span>
            <strong>{rank}</strong>
            <div className="hud-meter hud-xp-meter" role="progressbar" aria-label={`${xp.current} of ${xp.required} XP to next level`} aria-valuemin={0} aria-valuemax={xp.required} aria-valuenow={xp.current}>
              <i style={{ width: `${xp.percentage}%` }} />
            </div>
          </div>
        </div>

        <Link className="hud-campaign-link" href={`/campaign/${campaign.id}`}>
          <span><Swords size={14} aria-hidden="true" /> Active adventure</span>
          <strong>{campaign.campaignName}</strong>
        </Link>

        <div className="hud-combatant hud-enemy">
          <div className="hud-stat-copy">
            <span><Shield size={13} aria-hidden="true" /> Enemy {campaign.enemyCurrentHealth}/{campaign.enemyMaxHealth}</span>
            <strong>{campaign.enemyName}</strong>
            <div className="hud-meter hud-health-meter" role="progressbar" aria-label={`${campaign.enemyName} has ${campaign.enemyCurrentHealth} of ${campaign.enemyMaxHealth} health`} aria-valuemin={0} aria-valuemax={campaign.enemyMaxHealth} aria-valuenow={campaign.enemyCurrentHealth}>
              <i style={{ width: `${enemyPercentage}%` }} />
            </div>
          </div>
          <span className="hud-portrait hud-enemy-portrait"><Image src="/art/delay-demon.webp" alt="" width={56} height={56} sizes="56px" /></span>
        </div>
      </div>
    </aside>
  );
}
