export const XP_PER_LEVEL = 100;

export function calculateLevel(totalXp: number) {
  return Math.floor(Math.max(0, totalXp) / XP_PER_LEVEL) + 1;
}

export function calculateLevelProgress(totalXp: number) {
  const safeXp = Math.max(0, totalXp);
  return {
    current: safeXp % XP_PER_LEVEL,
    required: XP_PER_LEVEL,
    percentage: safeXp % XP_PER_LEVEL,
  };
}

export function calculateEnemyHealth(currentHealth: number, damage: number, maxHealth = 100) {
  return Math.min(maxHealth, Math.max(0, currentHealth - Math.max(0, damage)));
}

export function calculateCampaignProgress(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, completed) / total) * 100));
}

export function canAwardQuest(status: string, previousAward: number) {
  return status !== "completed" && previousAward === 0;
}

export function getHeroRank(level: number, startingTitle = "Code Apprentice") {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel === 1) return startingTitle;
  if (safeLevel === 2) return "Rune Initiate";
  if (safeLevel === 3) return "Quest Adept";
  if (safeLevel === 4) return "Campaign Knight";
  return "Realm Champion";
}

export type HeroAchievementId = "pathbound" | "first_victory" | "nemesis_wounded" | "realm_champion";

export function getHeroAchievements({ totalXp, level, campaigns, wonCampaigns, woundedEnemies }: { totalXp: number; level: number; campaigns: number; wonCampaigns: number; woundedEnemies: number }) {
  return [
    { id: "pathbound" as const, title: "Pathbound", description: "Forge your first campaign.", unlocked: campaigns > 0 },
    { id: "first_victory" as const, title: "First Victory", description: "Earn XP from a verified quest.", unlocked: totalXp > 0 },
    { id: "nemesis_wounded" as const, title: "Nemesis Wounded", description: "Deal lasting damage to a campaign enemy.", unlocked: woundedEnemies > 0 },
    { id: "realm_champion" as const, title: "Realm Champion", description: "Win a complete campaign and reach level 2.", unlocked: wonCampaigns > 0 && level >= 2 },
  ] satisfies { id: HeroAchievementId; title: string; description: string; unlocked: boolean }[];
}
