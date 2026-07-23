import { z } from "zod";

export const difficultySchema = z.enum(["gentle", "balanced", "challenging"]);
export const obstacleSchema = z.enum([
  "procrastination",
  "distraction",
  "lack-of-confidence",
  "inconsistency",
  "feeling-overwhelmed",
  "other",
]);

export const onboardingSchema = z.object({
  goal: z
    .string()
    .trim()
    .min(10, "Describe your goal in at least 10 characters.")
    .max(240, "Keep your goal under 240 characters."),
  dailyMinutes: z.number().int().refine((value) => [15, 30, 45, 60].includes(value), {
    message: "Choose one of the available time limits.",
  }),
  mainObstacle: obstacleSchema,
  customObstacle: z.string().trim().max(100).optional(),
  difficulty: difficultySchema,
}).superRefine((value, context) => {
  if (value.mainObstacle === "other" && !value.customObstacle?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["customObstacle"],
      message: "Tell us what usually gets in the way.",
    });
  }
});

export const generatedQuestSchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  sequenceNumber: z.number().int().min(1).max(7),
  title: z.string().min(3).max(100),
  storyIntro: z.string().min(10).max(300),
  description: z.string().min(10).max(600),
  difficulty: difficultySchema,
  estimatedMinutes: z.number().int().min(5).max(120),
  xpReward: z.number().int().min(10).max(100),
  enemyDamage: z.number().int().min(5).max(40),
  proofType: z.literal("image"),
  successRequirements: z.array(z.string().min(3).max(200)).min(1).max(5),
  isBossQuest: z.boolean(),
});

export const generatedCampaignSchema = z.object({
  campaignName: z.string().min(3).max(100),
  heroName: z.string().min(2).max(80),
  enemyName: z.string().min(2).max(80),
  enemyDescription: z.string().min(10).max(300),
  story: z.string().min(30).max(1000),
  quests: z.array(generatedQuestSchema).length(7),
}).superRefine((campaign, context) => {
  const sequences = new Set<number>();
  const days = new Set<number>();
  const titles = new Set<string>();
  const rewardBands = {
    gentle: { xp: [15, 25], damage: [8, 12] },
    balanced: { xp: [25, 40], damage: [12, 18] },
    challenging: { xp: [40, 60], damage: [18, 25] },
  } as const;

  campaign.quests.forEach((quest, index) => {
    if (sequences.has(quest.sequenceNumber)) {
      context.addIssue({ code: "custom", path: ["quests", index, "sequenceNumber"], message: "Quest sequence numbers must be unique." });
    }
    sequences.add(quest.sequenceNumber);

    if (quest.sequenceNumber !== index + 1) {
      context.addIssue({ code: "custom", path: ["quests", index, "sequenceNumber"], message: "Quests must use consecutive sequence numbers starting at 1." });
    }
    if (days.has(quest.dayNumber)) {
      context.addIssue({ code: "custom", path: ["quests", index, "dayNumber"], message: "Each campaign day must contain exactly one core quest." });
    }
    days.add(quest.dayNumber);
    if (quest.dayNumber !== index + 1) {
      context.addIssue({ code: "custom", path: ["quests", index, "dayNumber"], message: "Quest days must run consecutively from Day 1 through Day 7." });
    }
    const normalizedTitle = quest.title.trim().toLocaleLowerCase("en");
    if (titles.has(normalizedTitle)) {
      context.addIssue({ code: "custom", path: ["quests", index, "title"], message: "Core quest titles must be unique." });
    }
    titles.add(normalizedTitle);
    if (quest.isBossQuest !== (quest.dayNumber === 7)) {
      context.addIssue({ code: "custom", path: ["quests", index, "isBossQuest"], message: "Only the Day 7 quest may be the final boss quest." });
    }

    const band = rewardBands[quest.difficulty];
    if (quest.xpReward < band.xp[0] || quest.xpReward > band.xp[1]) {
      context.addIssue({ code: "custom", path: ["quests", index, "xpReward"], message: "XP reward does not match the quest difficulty." });
    }
    if (quest.enemyDamage < band.damage[0] || quest.enemyDamage > band.damage[1]) {
      context.addIssue({ code: "custom", path: ["quests", index, "enemyDamage"], message: "Enemy damage does not match the quest difficulty." });
    }
  });
});

export const proofVerificationSchema = z.object({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(5).max(500),
  requirementsAssessment: z.array(
    z.object({
      requirement: z.string(),
      satisfied: z.boolean(),
      explanation: z.string().min(3).max(300),
    }),
  ).min(1).max(5),
});

export const adaptiveQuestSchema = generatedQuestSchema.omit({
  dayNumber: true,
  sequenceNumber: true,
  isBossQuest: true,
});

export const aiReceiptSchema = z.object({
  traceId: z.uuid(),
  mode: z.enum(["live", "demo"]),
  model: z.string().min(1).max(120),
  latencyMs: z.number().int().nonnegative(),
  safety: z.enum(["passed", "flagged", "simulated"]),
  schemaValidated: z.boolean(),
});

export const completionResultSchema = proofVerificationSchema.extend({
  submissionId: z.uuid().optional(),
  verifiedAt: z.iso.datetime({ offset: true }),
  duplicate: z.boolean().default(false),
  xpAwarded: z.number().int().nonnegative(),
  enemyDamage: z.number().int().nonnegative(),
  totalXp: z.number().int().nonnegative(),
  currentLevel: z.number().int().positive(),
  enemyCurrentHealth: z.number().int().nonnegative(),
  levelledUp: z.boolean(),
  adaptiveQuestCreated: z.boolean().default(false),
  aiReceipt: aiReceiptSchema.optional(),
});

export const authSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const verificationRequestSchema = z.object({
  submissionId: z.uuid(),
  demoOutcome: z.enum(["accepted", "rejected"]).optional(),
});

export const generationKeySchema = z.uuid("A valid campaign generation key is required.");

export const appearancePreferencesSchema = z.object({
  theme: z.enum(["classic", "moonlit", "ember", "verdant", "amethyst"]),
  archetype: z.enum(["scholar", "knight", "mage", "ranger", "rogue"]),
  heroTitle: z.enum(["automatic", "code_apprentice", "rune_initiate", "quest_adept", "campaign_knight", "realm_champion"]),
  crest: z.enum(["rune", "crown", "shield", "star"]),
  accent: z.enum(["gold", "violet", "emerald", "crimson"]),
  fontScale: z.enum(["standard", "large"]),
  contrast: z.enum(["standard", "high"]),
  motion: z.enum(["system", "reduced"]),
  density: z.enum(["comfortable", "compact"]),
  soundEnabled: z.boolean(),
}).strict();

export const profileAggregatesSchema = z.object({
  totalCampaigns: z.number().int().nonnegative(),
  activeCampaigns: z.number().int().nonnegative(),
  pausedCampaigns: z.number().int().nonnegative(),
  wonCampaigns: z.number().int().nonnegative(),
  archivedCampaigns: z.number().int().nonnegative(),
  totalQuestsCompleted: z.number().int().nonnegative(),
  totalXp: z.number().int().nonnegative(),
  totalEnemyDamage: z.number().int().nonnegative(),
  currentLevel: z.number().int().positive(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type GeneratedCampaign = z.infer<typeof generatedCampaignSchema>;
export type GeneratedQuest = z.infer<typeof generatedQuestSchema>;
export type ProofVerification = z.infer<typeof proofVerificationSchema>;
export type AppearancePreferences = z.infer<typeof appearancePreferencesSchema>;
export type ProfileAggregates = z.infer<typeof profileAggregatesSchema>;
