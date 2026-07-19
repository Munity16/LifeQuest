import Image from "next/image";
import { ScrollText } from "lucide-react";
import { EnemyHealthBar, XPProgressBar } from "@/components/progress-bars";
import { getHeroRank } from "@/lib/gameplay";
import type { CampaignView } from "@/lib/types";

export function CampaignHero({ campaign }: { campaign: CampaignView }) {
  const rank = getHeroRank(campaign.currentLevel, campaign.heroName);
  return (
    <section className="campaign-hero panel-glow">
      <div className="campaign-hero-main">
        <div className="eyebrow"><ScrollText size={15} /> Active campaign</div>
        <h1>{campaign.campaignName}</h1>
        <p className="campaign-story">{campaign.story}</p>
        <div className="hero-identity">
          <span className="hero-portrait-frame"><Image src="/art/code-apprentice.webp" alt={`${campaign.heroName} portrait`} width={78} height={78} sizes="78px" /></span>
          <div><small>Level {campaign.currentLevel} hero</small><strong>{rank}</strong><span>{campaign.heroName}</span></div>
        </div>
      </div>
      <div className="enemy-card">
        <div className="enemy-portrait-frame"><Image src="/art/delay-demon.webp" alt={`${campaign.enemyName} portrait`} width={128} height={128} sizes="128px" priority /></div>
        <div className="enemy-copy">
          <span>Campaign boss</span>
          <h2>{campaign.enemyName}</h2>
          <p>{campaign.enemyDescription}</p>
        </div>
        <EnemyHealthBar current={campaign.enemyCurrentHealth} max={campaign.enemyMaxHealth} name={campaign.enemyName} />
        <XPProgressBar totalXp={campaign.totalXp} level={campaign.currentLevel} />
      </div>
    </section>
  );
}
