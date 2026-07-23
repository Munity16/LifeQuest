import { describe, expect, it } from "vitest";
import { appearancePreferencesSchema, generatedCampaignSchema, onboardingSchema, proofVerificationSchema } from "@/lib/schemas";
import { DEFAULT_APPEARANCE_PREFERENCES } from "@/lib/customization";

const quest = (sequenceNumber: number, difficulty: "gentle" | "balanced" | "challenging" = "balanced") => ({
  dayNumber: Math.min(7, sequenceNumber),
  sequenceNumber,
  title: `Quest ${sequenceNumber}`,
  storyIntro: "A practical challenge appears on the road ahead.",
  description: "Complete one focused practical task and capture clear evidence.",
  difficulty,
  estimatedMinutes: 30,
  xpReward: difficulty === "gentle" ? 20 : difficulty === "balanced" ? 30 : 50,
  enemyDamage: difficulty === "gentle" ? 10 : difficulty === "balanced" ? 15 : 22,
  proofType: "image" as const,
  successRequirements: ["The completed practical work is clearly visible"],
  isBossQuest: sequenceNumber === 7,
});

const campaign = {
  campaignName: "The Focused Path",
  heroName: "Momentum Keeper",
  enemyName: "Delay Wraith",
  enemyDescription: "A patient shadow that grows whenever meaningful work is postponed.",
  story: "Cross the focused path one practical victory at a time and break the delay wraith's hold.",
  quests: [
    quest(1, "gentle"),
    quest(2),
    quest(3),
    quest(4),
    quest(5),
    quest(6),
    quest(7, "challenging"),
  ],
};

describe("onboarding schema", () => {
  it("accepts the supported choices", () => {
    expect(onboardingSchema.parse({ goal: "Learn Python fundamentals", dailyMinutes: 30, mainObstacle: "procrastination", difficulty: "balanced" })).toMatchObject({ dailyMinutes: 30 });
  });

  it("requires a custom obstacle when Other is selected", () => {
    const result = onboardingSchema.safeParse({ goal: "Learn Python fundamentals", dailyMinutes: 30, mainObstacle: "other", difficulty: "balanced" });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported time values", () => {
    const result = onboardingSchema.safeParse({ goal: "Learn Python fundamentals", dailyMinutes: 20, mainObstacle: "distraction", difficulty: "balanced" });
    expect(result.success).toBe(false);
  });
});

describe("generated campaign schema", () => {
  it("accepts valid sequential quests and reward bands", () => {
    expect(generatedCampaignSchema.parse(campaign).quests).toHaveLength(7);
  });

  it("rejects duplicate or non-consecutive sequence numbers", () => {
    const invalid = { ...campaign, quests: [quest(1), quest(1), quest(3), quest(4), quest(5), quest(6), quest(7)] };
    expect(generatedCampaignSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects rewards outside the difficulty band", () => {
    const invalid = { ...campaign, quests: [{ ...quest(1, "gentle"), xpReward: 60 }, ...campaign.quests.slice(1)] };
    expect(generatedCampaignSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires one unique quest per day and only a Day 7 boss", () => {
    expect(generatedCampaignSchema.safeParse({
      ...campaign,
      quests: campaign.quests.map((item, index) => index === 1 ? { ...item, dayNumber: 1 } : item),
    }).success).toBe(false);
    expect(generatedCampaignSchema.safeParse({
      ...campaign,
      quests: campaign.quests.map((item, index) => index === 2 ? { ...item, isBossQuest: true } : item),
    }).success).toBe(false);
  });
});

describe("proof verification schema", () => {
  it("accepts a complete structured assessment", () => {
    expect(proofVerificationSchema.parse({
      verified: true,
      confidence: 0.91,
      reason: "The task and output are clearly visible.",
      requirementsAssessment: [{ requirement: "Output is visible", satisfied: true, explanation: "The terminal shows successful output." }],
    }).verified).toBe(true);
  });

  it("rejects confidence outside the supported range", () => {
    expect(proofVerificationSchema.safeParse({ verified: false, confidence: 1.2, reason: "The image is unrelated.", requirementsAssessment: [] }).success).toBe(false);
  });
});

describe("appearance preferences schema", () => {
  it("accepts the complete supported customization model", () => {
    expect(appearancePreferencesSchema.parse(DEFAULT_APPEARANCE_PREFERENCES)).toEqual(DEFAULT_APPEARANCE_PREFERENCES);
  });

  it("rejects unknown themes and extra browser-supplied fields", () => {
    expect(appearancePreferencesSchema.safeParse({ ...DEFAULT_APPEARANCE_PREFERENCES, theme: "neon" }).success).toBe(false);
    expect(appearancePreferencesSchema.safeParse({ ...DEFAULT_APPEARANCE_PREFERENCES, xp: 99999 }).success).toBe(false);
  });
});
