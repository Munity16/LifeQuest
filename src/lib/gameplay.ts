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
