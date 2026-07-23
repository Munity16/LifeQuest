import "server-only";

import { z } from "zod";
import { DEMO_CAMPAIGN_ID } from "@/lib/config";
import { getDemoCampaign } from "@/lib/demo-data";
import { getDemoCompletedQuestIds, hasDemoSession } from "@/lib/demo-session";
import { AppError } from "@/lib/errors";
import { calculateCampaignProgress } from "@/lib/gameplay";
import { difficultySchema, type GeneratedCampaign, type OnboardingInput } from "@/lib/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignView, QuestStatus, QuestView } from "@/lib/types";
import type { Json } from "@/types/database";

const requirementsSchema = z.array(z.string().min(1));

function questFromRow(row: {
  id: string;
  campaign_id: string;
  day_number: number;
  sequence_number: number;
  title: string;
  story_intro: string | null;
  description: string;
  difficulty: string;
  estimated_minutes: number;
  xp_reward: number;
  enemy_damage: number;
  success_requirements: Json;
  status: string;
  is_adaptive: boolean;
  is_boss_quest: boolean;
  completed_at: string | null;
}): QuestView {
  const difficulty = difficultySchema.safeParse(row.difficulty);
  const requirements = requirementsSchema.safeParse(row.success_requirements);
  return {
    id: row.id,
    campaignId: row.campaign_id,
    dayNumber: row.day_number,
    sequenceNumber: row.sequence_number,
    title: row.title,
    storyIntro: row.story_intro ?? "A new challenge waits on the path ahead.",
    description: row.description,
    difficulty: difficulty.success ? difficulty.data : "balanced",
    estimatedMinutes: row.estimated_minutes,
    xpReward: row.xp_reward,
    enemyDamage: row.enemy_damage,
    successRequirements: requirements.success ? requirements.data : ["A clear image showing the completed task"],
    status: (["locked", "available", "in_progress", "completed"].includes(row.status) ? row.status : "locked") as QuestStatus,
    isAdaptive: row.is_adaptive,
    isBossQuest: row.is_boss_quest,
    completedAt: row.completed_at,
  };
}

export async function getCampaign(campaignId: string): Promise<CampaignView | null> {
  if (campaignId === DEMO_CAMPAIGN_ID) {
    if (!(await hasDemoSession())) return null;
    return getDemoCampaign(await getDemoCompletedQuestIds());
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const [{ data: campaign, error: campaignError }, { data: profile, error: profileError }, { data: quests, error: questsError }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("user_id", authData.user.id).maybeSingle(),
    supabase.from("profiles").select("total_xp,current_level").eq("id", authData.user.id).maybeSingle(),
    supabase.from("quests").select("*").eq("campaign_id", campaignId).eq("user_id", authData.user.id).order("sequence_number"),
  ]);

  if (campaignError || profileError || questsError) {
    console.error("Failed to load campaign", { campaignError, profileError, questsError });
    throw new AppError("The campaign could not be loaded.", 500, "CAMPAIGN_LOAD_FAILED");
  }
  if (!campaign || !profile) return null;

  const difficulty = difficultySchema.safeParse(campaign.difficulty);
  return {
    id: campaign.id,
    goal: campaign.goal,
    dailyMinutes: campaign.daily_minutes,
    mainObstacle: campaign.main_obstacle,
    difficulty: difficulty.success ? difficulty.data : "balanced",
    campaignName: campaign.campaign_name,
    heroName: campaign.hero_name,
    enemyName: campaign.enemy_name,
    enemyDescription: campaign.enemy_description ?? "A shadow standing between you and your goal.",
    story: campaign.story,
    enemyMaxHealth: campaign.enemy_max_health,
    enemyCurrentHealth: campaign.enemy_current_health,
    status: (["active", "paused", "won", "archived", "abandoned"].includes(campaign.status) ? campaign.status : "active") as CampaignView["status"],
    totalXp: profile.total_xp,
    currentLevel: profile.current_level,
    userEmail: authData.user.email ?? "Adventurer",
    quests: (quests ?? []).map(questFromRow),
    isDemo: false,
  };
}

export async function getQuest(campaignId: string, questId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;
  const quest = campaign.quests.find((item) => item.id === questId);
  if (!quest) return null;
  if (campaign.isDemo) return { campaign, quest, latestProof: null };

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;
  const { data: submission, error } = await supabase
    .from("quest_submissions")
    .select("id,proof_deleted_at")
    .eq("quest_id", questId)
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError("The proof retention status could not be loaded.", 500, "PROOF_STATUS_LOAD_FAILED");
  return {
    campaign,
    quest,
    latestProof: submission ? { submissionId: submission.id, deletedAt: submission.proof_deleted_at } : null,
  };
}

export async function persistGeneratedCampaign(
  userId: string,
  generationKey: string,
  input: OnboardingInput,
  generated: GeneratedCampaign,
) {
  const supabase = createSupabaseAdminClient();
  const obstacle = input.mainObstacle === "other" ? input.customObstacle || "Other" : input.mainObstacle;
  const { data: campaignId, error } = await supabase.rpc("create_campaign_with_quests", {
    p_user_id: userId,
    p_generation_key: generationKey,
    p_goal: input.goal,
    p_daily_minutes: input.dailyMinutes,
    p_main_obstacle: obstacle,
    p_difficulty: input.difficulty,
    p_generated: generated as unknown as Json,
  });

  if (error || !campaignId) {
    console.error("Atomic campaign persistence failed", error);
    throw new AppError("Your campaign was created but could not be saved. Please try again.", 500, "CAMPAIGN_SAVE_FAILED");
  }

  return z.uuid().parse(campaignId);
}

export function campaignProgress(campaign: CampaignView) {
  return calculateCampaignProgress(
    campaign.quests.filter((quest) => quest.status === "completed").length,
    campaign.quests.filter((quest) => !quest.isAdaptive).length,
  );
}
