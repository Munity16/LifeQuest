import { Crown, ScrollText, ShieldAlert } from "lucide-react";
import { EnemyHealthBar, XPProgressBar } from "@/components/progress-bars";
import type { CampaignView } from "@/lib/types";

export function CampaignHero({ campaign }: { campaign: CampaignView }) {
  return (
    <section className="campaign-hero panel-glow">
      <div className="campaign-hero-main">
        <div className="eyebrow"><ScrollText size={15} /> Active campaign</div>
        <h1>{campaign.campaignName}</h1>
        <p className="campaign-story">{campaign.story}</p>
        <div className="hero-identity">
          <span className="hero-medallion" aria-hidden="true"><Crown size={22} /></span>
          <div><small>Your title</small><strong>{campaign.heroName}</strong></div>
        </div>
      </div>
      <div className="enemy-card">
        <div className="enemy-sigil" aria-hidden="true"><ShieldAlert size={29} /></div>
        <div className="enemy-copy">
          <span>Nemesis</span>
          <h2>{campaign.enemyName}</h2>
          <p>{campaign.enemyDescription}</p>
        </div>
        <EnemyHealthBar current={campaign.enemyCurrentHealth} max={campaign.enemyMaxHealth} name={campaign.enemyName} />
        <XPProgressBar totalXp={campaign.totalXp} level={campaign.currentLevel} />
      </div>
    </section>
  );
}
