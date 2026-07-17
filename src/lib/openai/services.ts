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
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai/client";
import {
  ADAPTIVE_SYSTEM_PROMPT,
  CAMPAIGN_SYSTEM_PROMPT,
  PROOF_SYSTEM_PROMPT,
  campaignUserPrompt,
} from "@/lib/openai/prompts";
import type { QuestView } from "@/lib/types";

export async function generateCampaignWithAI(input: OnboardingInput): Promise<GeneratedCampaign> {
  const openai = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model: getOpenAIModel(),
        instructions: `${CAMPAIGN_SYSTEM_PROMPT}${attempt ? "\nPrevious output was invalid. Follow the schema exactly." : ""}`,
        input: campaignUserPrompt(input),
        text: { format: zodTextFormat(generatedCampaignSchema, "lifequest_campaign") },
      });

      const generated = generatedCampaignSchema.parse(response.output_parsed);
      if (generated.quests.some((quest) => quest.estimatedMinutes > input.dailyMinutes)) {
        throw new Error("Generated quest exceeds the user's daily time limit.");
      }
      return generated;
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Campaign generation failed after a bounded retry", lastError);
  throw new AppError("The campaign forge misfired. Your goal is safe—please try again.", 502, "AI_GENERATION_FAILED");
}

interface VerifyProofInput {
  quest: Pick<QuestView, "title" | "description" | "successRequirements">;
  imageDataUrl: string;
}

export async function verifyProofWithAI(input: VerifyProofInput): Promise<ProofVerification> {
  const openai = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
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

      const verification = proofVerificationSchema.parse(response.output_parsed);
      if (verification.requirementsAssessment.length !== input.quest.successRequirements.length) {
        throw new Error("Proof assessment did not cover every requirement.");
      }
      if (verification.verified && verification.requirementsAssessment.some((item) => !item.satisfied)) {
        throw new Error("Proof result is inconsistent with its requirement assessments.");
      }
      return verification;
    } catch (error) {
      lastError = error;
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

export async function generateAdaptiveQuestWithAI(input: AdaptiveQuestInput) {
  const openai = getOpenAIClient();
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

    return adaptiveQuestSchema.parse(response.output_parsed);
  } catch (error) {
    console.error("Non-critical adaptive quest generation failed", error);
    return null;
  }
}
