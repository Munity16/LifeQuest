import { describe, expect, it } from "vitest";
import { calculateCampaignProgress, calculateEnemyHealth, calculateLevel, calculateLevelProgress, canAwardQuest } from "@/lib/gameplay";

describe("gameplay calculations", () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [250, 3],
    [-20, 1],
  ])("calculates level for %i XP", (xp, level) => {
    expect(calculateLevel(xp)).toBe(level);
  });

  it("calculates XP progress within the current level", () => {
    expect(calculateLevelProgress(245)).toEqual({ current: 45, required: 100, percentage: 45 });
  });

  it("clamps enemy health between zero and max", () => {
    expect(calculateEnemyHealth(12, 20)).toBe(0);
    expect(calculateEnemyHealth(90, -10)).toBe(90);
    expect(calculateEnemyHealth(150, 0, 100)).toBe(100);
  });

  it("calculates bounded campaign completion", () => {
    expect(calculateCampaignProgress(2, 7)).toBe(29);
    expect(calculateCampaignProgress(10, 7)).toBe(100);
    expect(calculateCampaignProgress(1, 0)).toBe(0);
  });

  it("prevents duplicate quest rewards", () => {
    expect(canAwardQuest("available", 0)).toBe(true);
    expect(canAwardQuest("completed", 0)).toBe(false);
    expect(canAwardQuest("available", 20)).toBe(false);
  });
});
