import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import {
  DEMO_PROGRESS_COOKIE,
  VERIFICATION_CONFIDENCE_THRESHOLD,
  isDemoEnabled,
} from "@/lib/config";
import { campaignProgress, getCampaign } from "@/lib/data";
import { getDemoCampaign } from "@/lib/demo-data";
import { encodeDemoProgress, getDemoCompletedQuestIds } from "@/lib/demo-session";
import { AppError, errorResponse } from "@/lib/errors";
import { getOpenAIModel } from "@/lib/openai/client";
import { generateAdaptiveQuestWithAI, moderateProofImage, verifyProofWithAI } from "@/lib/openai/services";
import { verificationRequestSchema } from "@/lib/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const completionRpcSchema = z.object({
  duplicate: z.boolean(),
  xpAwarded: z.number(),
  enemyDamage: z.number(),
  totalXp: z.number(),
  currentLevel: z.number(),
  enemyCurrentHealth: z.number(),
  levelledUp: z.boolean(),
});

export async function POST(request: Request, context: { params: Promise<{ questId: string }> }) {
  try {
    const startedAt = performance.now();
    const traceId = crypto.randomUUID();
    const { questId } = await context.params;
    const { submissionId, demoOutcome } = verificationRequestSchema.parse(await request.json());
    const auth = await getAuthContext();

    if (auth.kind === "demo") {
      if (!isDemoEnabled()) throw new AppError("Demo verification is disabled.", 403, "DEMO_DISABLED");
      const completedIds = await getDemoCompletedQuestIds();
      const before = getDemoCampaign(completedIds);
      const quest = before.quests.find((item) => item.id === questId);
      if (!quest || submissionId !== questId) throw new AppError("Submission not found.", 404, "NOT_FOUND");
      if (demoOutcome === "rejected") {
        return NextResponse.json({
          verified: false,
          duplicate: false,
          reason: "The demo rejection sample deliberately hides the required output. Retake the proof with every victory condition clearly visible.",
          confidence: 0.18,
          requirementsAssessment: quest.successRequirements.map((requirement) => ({
            requirement,
            satisfied: false,
            explanation: "This requirement is not readable in the demonstration image.",
          })),
          xpAwarded: 0,
          enemyDamage: 0,
          totalXp: before.totalXp,
          currentLevel: before.currentLevel,
          enemyCurrentHealth: before.enemyCurrentHealth,
          levelledUp: false,
          adaptiveQuestCreated: false,
          demoFallback: true,
          aiReceipt: {
            traceId,
            mode: "demo",
            model: "seeded-demo",
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
            safety: "simulated",
            schemaValidated: true,
          },
        });
      }
      const duplicate = completedIds.includes(questId);
      const nextIds = duplicate ? completedIds : [...completedIds, questId];
      const after = getDemoCampaign(nextIds);
      const response = NextResponse.json({
        verified: true,
        duplicate,
        reason: duplicate
          ? "This demo quest was already completed; no additional reward was applied."
          : "Demo safeguard accepted this proof so the presentation can continue. Production verification always uses the configured OpenAI model.",
        confidence: 0.99,
        requirementsAssessment: quest.successRequirements.map((requirement) => ({
          requirement,
          satisfied: true,
          explanation: "The seeded demo marks this visible requirement as satisfied for presentation reliability.",
        })),
        xpAwarded: duplicate ? 0 : quest.xpReward,
        enemyDamage: duplicate ? 0 : quest.enemyDamage,
        totalXp: after.totalXp,
        currentLevel: after.currentLevel,
        enemyCurrentHealth: after.enemyCurrentHealth,
        levelledUp: after.currentLevel > before.currentLevel,
        adaptiveQuestCreated: !duplicate && completedIds.length === 0,
        demoFallback: true,
        aiReceipt: {
          traceId,
          mode: "demo",
          model: "seeded-demo",
          latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          safety: "simulated",
          schemaValidated: true,
        },
      });
      response.cookies.set(DEMO_PROGRESS_COOKIE, encodeDemoProgress(nextIds), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      return response;
    }
    if (auth.kind !== "user") throw new AppError("Sign in to verify proof.", 401, "UNAUTHORIZED");

    const admin = createSupabaseAdminClient();
    const { data: submission, error: submissionError } = await admin
      .from("quest_submissions")
      .select("*")
      .eq("id", submissionId)
      .eq("quest_id", questId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (submissionError || !submission) throw new AppError("Submission not found.", 404, "NOT_FOUND");

    const supabase = await createSupabaseServerClient();
    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("*")
      .eq("id", questId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (questError || !quest) throw new AppError("Quest not found.", 404, "NOT_FOUND");

    const { data: proofBlob, error: downloadError } = await supabase.storage
      .from("quest-proofs")
      .download(submission.storage_path);
    if (downloadError || !proofBlob) throw new AppError("The proof image could not be read.", 500, "PROOF_READ_FAILED");
    const imageDataUrl = `data:${proofBlob.type || "image/jpeg"};base64,${Buffer.from(await proofBlob.arrayBuffer()).toString("base64")}`;
    const requirements = z.array(z.string()).parse(quest.success_requirements);
    const moderation = await moderateProofImage(imageDataUrl);
    if (moderation.flagged) {
      const reason = "This proof could not be reviewed because it did not pass the image safety check. Choose a different image without sensitive or harmful content.";
      console.warn("Proof rejected by safety screening", { traceId, categories: moderation.categories });
      const { error: moderationSaveError } = await admin
        .from("quest_submissions")
        .update({
          verification_status: "rejected",
          verification_confidence: 0,
          verification_reason: reason,
          model_used: moderation.model,
          verified_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (moderationSaveError) throw new AppError("The safety result could not be saved. Please retry safely.", 500, "VERIFICATION_SAVE_FAILED");
      return Response.json({
        verified: false,
        confidence: 0,
        reason,
        requirementsAssessment: requirements.map((requirement) => ({
          requirement,
          satisfied: false,
          explanation: "Verification stopped at the safety gate before this condition was assessed.",
        })),
        xpAwarded: 0,
        enemyDamage: 0,
        aiReceipt: {
          traceId,
          mode: "live",
          model: moderation.model,
          latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          safety: "flagged",
          schemaValidated: false,
        },
      });
    }
    const verification = await verifyProofWithAI({
      quest: {
        title: quest.title,
        description: quest.description,
        successRequirements: requirements,
      },
      imageDataUrl,
    });
    const aiReceipt = {
      traceId,
      mode: "live" as const,
      model: getOpenAIModel(),
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      safety: "passed" as const,
      schemaValidated: true,
    };

    if (!verification.verified || verification.confidence < VERIFICATION_CONFIDENCE_THRESHOLD) {
      const { error: rejectionError } = await admin
        .from("quest_submissions")
        .update({
          verification_status: "rejected",
          verification_confidence: verification.confidence,
          verification_reason: verification.reason,
          model_used: getOpenAIModel(),
          verified_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (rejectionError) {
        console.error("Rejected verification persistence failed", rejectionError);
        throw new AppError("The verification result could not be saved. Please retry safely.", 500, "VERIFICATION_SAVE_FAILED");
      }
      return Response.json({ ...verification, verified: false, xpAwarded: 0, enemyDamage: 0, aiReceipt });
    }

    const { data: completionData, error: completionError } = await admin.rpc("complete_quest", {
      p_submission_id: submission.id,
      p_confidence: verification.confidence,
      p_reason: verification.reason,
      p_model_used: getOpenAIModel(),
    });
    if (completionError) {
      console.error("Completion RPC failed", completionError);
      throw new AppError("Your proof was accepted, but progression could not be applied. Retry safely.", 500, "PROGRESSION_FAILED");
    }
    const completion = completionRpcSchema.parse(completionData as Json);

    let adaptiveQuestCreated = false;
    if (!completion.duplicate) {
      const campaign = await getCampaign(quest.campaign_id);
      if (campaign) {
        const adaptive = await generateAdaptiveQuestWithAI({
          goal: campaign.goal,
          obstacle: campaign.mainObstacle,
          difficulty: campaign.difficulty,
          dailyMinutes: campaign.dailyMinutes,
          completedQuest: campaign.quests.find((item) => item.id === quest.id) ?? {
            id: quest.id,
            campaignId: quest.campaign_id,
            dayNumber: quest.day_number,
            sequenceNumber: quest.sequence_number,
            title: quest.title,
            storyIntro: quest.story_intro ?? "Victory opens a new path.",
            description: quest.description,
            difficulty: campaign.difficulty,
            estimatedMinutes: quest.estimated_minutes,
            xpReward: quest.xp_reward,
            enemyDamage: quest.enemy_damage,
            successRequirements: requirements,
            status: "completed",
            isAdaptive: quest.is_adaptive,
            completedAt: new Date().toISOString(),
          },
          verificationReason: verification.reason,
          existingTitles: campaign.quests.map((item) => item.title),
          progressPercentage: campaignProgress(campaign),
        });

        if (adaptive && !campaign.quests.some((item) => item.title.toLowerCase() === adaptive.title.toLowerCase())) {
          const nextSequence = Math.max(...campaign.quests.map((item) => item.sequenceNumber), 0) + 1;
          const { error: adaptiveError } = await admin.from("quests").insert({
            campaign_id: campaign.id,
            user_id: auth.user.id,
            day_number: Math.min(7, Math.max(1, quest.day_number + 1)),
            sequence_number: nextSequence,
            title: adaptive.title,
            story_intro: adaptive.storyIntro,
            description: adaptive.description,
            difficulty: adaptive.difficulty,
            estimated_minutes: Math.min(campaign.dailyMinutes, adaptive.estimatedMinutes),
            xp_reward: adaptive.xpReward,
            enemy_damage: adaptive.enemyDamage,
            success_requirements: adaptive.successRequirements,
            status: "available",
            is_adaptive: true,
          });
          adaptiveQuestCreated = !adaptiveError;
          if (adaptiveError) console.error("Non-critical adaptive quest save failed", adaptiveError);
        }
      }
    }

    return Response.json({ ...verification, ...completion, adaptiveQuestCreated, aiReceipt });
  } catch (error) {
    return errorResponse(error);
  }
}
