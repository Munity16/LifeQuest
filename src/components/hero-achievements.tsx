import { Crown, LockKeyhole, Map, ShieldCheck, Sparkles } from "lucide-react";
import { getHeroAchievements } from "@/lib/gameplay";

const achievementIcons = { pathbound: Map, first_victory: Sparkles, nemesis_wounded: ShieldCheck, realm_champion: Crown } as const;

export function HeroAchievements({ totalXp, level, campaigns, wonCampaigns, woundedEnemies }: { totalXp: number; level: number; campaigns: number; wonCampaigns: number; woundedEnemies: number }) {
  const achievements = getHeroAchievements({ totalXp, level, campaigns, wonCampaigns, woundedEnemies });
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;
  return (
    <section className="hero-achievements" aria-labelledby="achievement-title">
      <div className="section-title-row"><div><span className="eyebrow"><Sparkles size={15} /> Milestones</span><h2 id="achievement-title">Achievement cabinet</h2></div><small>{unlocked} of {achievements.length} unlocked</small></div>
      <ul>
        {achievements.map((achievement) => {
          const Icon = achievementIcons[achievement.id];
          return (
            <li className={achievement.unlocked ? "achievement-unlocked" : "achievement-locked"} key={achievement.id}>
              <span>{achievement.unlocked ? <Icon size={21} aria-hidden="true" /> : <LockKeyhole size={19} aria-hidden="true" />}</span>
              <div><strong>{achievement.title}</strong><p>{achievement.description}</p></div>
              <small>{achievement.unlocked ? "Unlocked" : "Locked"}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
