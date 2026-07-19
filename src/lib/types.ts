export type QuestStatus = "locked" | "available" | "in_progress" | "completed";
export type CampaignStatus = "active" | "won" | "archived";
export type Difficulty = "gentle" | "balanced" | "challenging";

export interface RequirementAssessment {
  requirement: string;
  satisfied: boolean;
  explanation: string;
}

export interface AIReceipt {
  traceId: string;
  mode: "live" | "demo";
  model: string;
  latencyMs: number;
  safety: "passed" | "flagged" | "simulated";
  schemaValidated: boolean;
}

export interface QuestView {
  id: string;
  campaignId: string;
  dayNumber: number;
  sequenceNumber: number;
  title: string;
  storyIntro: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  xpReward: number;
  enemyDamage: number;
  successRequirements: string[];
  status: QuestStatus;
  isAdaptive: boolean;
  completedAt: string | null;
}

export interface CampaignView {
  id: string;
  goal: string;
  dailyMinutes: number;
  mainObstacle: string;
  difficulty: Difficulty;
  campaignName: string;
  heroName: string;
  enemyName: string;
  enemyDescription: string;
  story: string;
  enemyMaxHealth: number;
  enemyCurrentHealth: number;
  status: CampaignStatus;
  totalXp: number;
  currentLevel: number;
  userEmail: string;
  quests: QuestView[];
  isDemo: boolean;
}

export interface CompletionResult {
  submissionId?: string;
  verified: boolean;
  duplicate?: boolean;
  reason: string;
  confidence: number;
  xpAwarded: number;
  enemyDamage: number;
  totalXp: number;
  currentLevel: number;
  enemyCurrentHealth: number;
  levelledUp: boolean;
  adaptiveQuestCreated: boolean;
  requirementsAssessment: RequirementAssessment[];
  aiReceipt?: AIReceipt;
}

export interface ProofRetentionSummary {
  submissionId: string;
  deletedAt: string | null;
}
