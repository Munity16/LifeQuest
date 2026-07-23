import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import {
  adaptiveQuestSchema,
  generatedCampaignSchema,
  proofVerificationSchema,
  type GeneratedCampaign,
  type OnboardingInput,
  type ProofVerification,
} from "@/lib/schemas";
import { AppError } from "@/lib/errors";
import { assertAiUsageAvailable, recordAiUsage, type AiOperation } from "@/lib/ai-usage";
import { getOpenAIClient, getOpenAIModerationModel, getOpenAIModel } from "@/lib/openai/client";
import {
  ADAPTIVE_SYSTEM_PROMPT,
  CAMPAIGN_SYSTEM_PROMPT,
  PROOF_SYSTEM_PROMPT,
  campaignUserPrompt,
} from "@/lib/openai/prompts";
import type { QuestView } from "@/lib/types";

interface AiCallContext {
  userId: string;
  traceId: string;
}

async function trackAiCall(
  context: AiCallContext | undefined,
  operation: AiOperation,
  model: string,
  startedAt: number,
  success: boolean,
  usage?: { input_tokens?: number; output_tokens?: number } | null,
) {
  if (!context) return;
  await recordAiUsage({
    userId: context.userId,
    operation,
    model,
    traceId: context.traceId,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    success,
    inputUnits: usage?.input_tokens,
    outputUnits: usage?.output_tokens,
  });
}

export async function generateCampaignWithAI(input: OnboardingInput, context?: AiCallContext): Promise<GeneratedCampaign> {
  const openai = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (context) await assertAiUsageAvailable(context.userId, "campaign_generation");
    const startedAt = performance.now();
    let usage: { input_tokens?: number; output_tokens?: number } | null | undefined;
    try {
      const response = await openai.responses.parse({
        model: getOpenAIModel(),
        instructions: `${CAMPAIGN_SYSTEM_PROMPT}${attempt ? "\nPrevious output was invalid. Follow the schema exactly." : ""}`,
        input: campaignUserPrompt(input),
        text: { format: zodTextFormat(generatedCampaignSchema, "lifequest_campaign") },
      });
      usage = response.usage;

      const generated = generatedCampaignSchema.parse(response.output_parsed);
      if (generated.quests.some((quest) => quest.estimatedMinutes > input.dailyMinutes)) {
        throw new Error("Generated quest exceeds the user's daily time limit.");
      }
      await trackAiCall(context, "campaign_generation", getOpenAIModel(), startedAt, true, usage);
      return generated;
    } catch (error) {
      lastError = error;
      await trackAiCall(context, "campaign_generation", getOpenAIModel(), startedAt, false, usage);
    }
  }

  console.error("Campaign generation failed after a bounded retry", lastError);
  throw new AppError("The campaign forge misfired. Your goal is safe—please try again.", 502, "AI_GENERATION_FAILED");
}

interface VerifyProofInput {
  quest: Pick<QuestView, "title" | "description" | "successRequirements">;
  imageDataUrl: string;
}

export interface ProofModerationResult {
  flagged: boolean;
  categories: string[];
  requestId: string;
  model: string;
}

export async function moderateProofImage(imageDataUrl: string, context?: AiCallContext): Promise<ProofModerationResult> {
  const openai = getOpenAIClient();
  const startedAt = performance.now();
  try {
    const response = await openai.moderations.create({
      model: getOpenAIModerationModel(),
      input: [{ type: "image_url", image_url: { url: imageDataUrl } }],
    });
    const result = response.results[0];
    if (!result) throw new Error("Moderation returned no result.");
    const categories = Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);
    await trackAiCall(context, "proof_moderation", response.model, startedAt, true);
    return { flagged: result.flagged, categories, requestId: response.id, model: response.model };
  } catch (error) {
    await trackAiCall(context, "proof_moderation", getOpenAIModerationModel(), startedAt, false);
    console.error("Proof safety screening failed", error);
    throw new AppError("Proof safety screening is temporarily unavailable. Your image is saved; please retry.", 502, "AI_MODERATION_FAILED");
  }
}

export async function verifyProofWithAI(input: VerifyProofInput, context?: AiCallContext): Promise<ProofVerification> {
  const openai = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (context) await assertAiUsageAvailable(context.userId, "proof_verification");
    const startedAt = performance.now();
    let usage: { input_tokens?: number; output_tokens?: number } | null | undefined;
    try {
      const requirements = input.quest.successRequirements.map((item, index) => `${index + 1}. ${item}`).join("\n");
      const response = await openai.responses.parse({
        model: getOpenAIModel(),
        instructions: `${PROOF_SYSTEM_PROMPT}${attempt ? "\nReturn a complete assessment matching the schema exactly." : ""}`,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Quest: ${input.quest.title}\nTask: ${input.quest.description}\nVisible proof requirements:\n${requirements}`,
              },
              { type: "input_image", image_url: input.imageDataUrl, detail: "high" },
            ],
          },
        ],
        text: { format: zodTextFormat(proofVerificationSchema, "proof_verification") },
      });
      usage = response.usage;

      const verification = proofVerificationSchema.parse(response.output_parsed);
      if (verification.requirementsAssessment.length !== input.quest.successRequirements.length) {
        throw new Error("Proof assessment did not cover every requirement.");
      }
      if (verification.verified && verification.requirementsAssessment.some((item) => !item.satisfied)) {
        throw new Error("Proof result is inconsistent with its requirement assessments.");
      }
      await trackAiCall(context, "proof_verification", getOpenAIModel(), startedAt, true, usage);
      return verification;
    } catch (error) {
      lastError = error;
      await trackAiCall(context, "proof_verification", getOpenAIModel(), startedAt, false, usage);
    }
  }

  console.error("Proof verification failed after a bounded retry", lastError);
  throw new AppError("Proof verification is temporarily unavailable. Your image is saved; please retry.", 502, "AI_VERIFICATION_FAILED");
}

interface AdaptiveQuestInput {
  goal: string;
  obstacle: string;
  difficulty: string;
  dailyMinutes: number;
  completedQuest: QuestView;
  verificationReason: string;
  existingTitles: string[];
  progressPercentage: number;
}

export async function generateAdaptiveQuestWithAI(input: AdaptiveQuestInput, context?: AiCallContext) {
  const openai = getOpenAIClient();
  if (context) await assertAiUsageAvailable(context.userId, "adaptive_generation");
  const startedAt = performance.now();
  let usage: { input_tokens?: number; output_tokens?: number } | null | undefined;
  try {
    const response = await openai.responses.parse({
      model: getOpenAIModel(),
      instructions: ADAPTIVE_SYSTEM_PROMPT,
      input: `Original goal: ${input.goal}
Main obstacle: ${input.obstacle}
Preferred difficulty: ${input.difficulty}
Daily time limit: ${input.dailyMinutes} minutes
Just completed: ${input.completedQuest.title} — ${input.completedQuest.description}
Verification outcome: ${input.verificationReason}
Campaign progress: ${input.progressPercentage}%
Existing quest titles: ${input.existingTitles.join(" | ")}
Create one logically connected, non-duplicate next action.`,
      text: { format: zodTextFormat(adaptiveQuestSchema, "adaptive_quest") },
    });
    usage = response.usage;

    const parsed = adaptiveQuestSchema.parse(response.output_parsed);
    await trackAiCall(context, "adaptive_generation", getOpenAIModel(), startedAt, true, usage);
    return parsed;
  } catch (error) {
    await trackAiCall(context, "adaptive_generation", getOpenAIModel(), startedAt, false, usage);
    console.error("Non-critical adaptive quest generation failed", error);
    return null;
  }
}
