import Image from "next/image";
import { ScrollText } from "lucide-react";
import { HeroPortrait, HeroTitle } from "@/components/hero-customization";
import { EnemyHealthBar, XPProgressBar } from "@/components/progress-bars";
import type { CampaignView } from "@/lib/types";

export function CampaignHero({ campaign }: { campaign: CampaignView }) {
  return (
    <section className="campaign-hero panel-glow">
      <div className="campaign-hero-main">
        <div className="eyebrow"><ScrollText size={15} /> Active campaign</div>
        <h1>{campaign.campaignName}</h1>
        <div className="hero-identity">
          <span className="hero-portrait-frame"><HeroPortrait alt={`${campaign.heroName} portrait`} size={78} /></span>
          <div><small>Level {campaign.currentLevel} hero</small><HeroTitle as="strong" level={campaign.currentLevel} startingTitle={campaign.heroName} /><span>{campaign.heroName}</span></div>
        </div>
        <details className="campaign-story-disclosure">
          <summary>Read campaign story</summary>
          <p className="campaign-story">{campaign.story}</p>
        </details>
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
