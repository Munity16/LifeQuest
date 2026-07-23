import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAiUsageAvailable } from "@/lib/ai-usage";
import { getAuthContext } from "@/lib/auth";
import {
  DEMO_PROGRESS_COOKIE,
  VERIFICATION_CONFIDENCE_THRESHOLD,
  isDemoEnabled,
} from "@/lib/config";
import { getDemoCampaign } from "@/lib/demo-data";
import { encodeDemoProgress, getDemoCompletedQuestIds } from "@/lib/demo-session";
import { AppError, errorResponse } from "@/lib/errors";
import { getOpenAIModel } from "@/lib/openai/client";
import { moderateProofImage, verifyProofWithAI } from "@/lib/openai/services";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  aiReceiptSchema,
  completionResultSchema,
  proofVerificationSchema,
  verificationRequestSchema,
} from "@/lib/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { operationalErrorCode, operationalStatus, recordOperationalEvent } from "@/lib/telemetry";
import {
  claimVerification,
  finalizeRejectedVerification,
  markVerificationFailed,
  saveVerificationAssessment,
} from "@/lib/verification-state";
import type { Json } from "@/types/database";

const storedAssessmentSchema = proofVerificationSchema.extend({
  aiReceipt: aiReceiptSchema,
});

function processingResponse() {
  return Response.json(
    { processing: true, message: "This proof is already being verified." },
    { status: 202, headers: { "Retry-After": "3", "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, context: { params: Promise<{ questId: string }> }) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  let activeClaim: { submissionId: string; processingToken: string } | null = null;

  try {
    const { questId } = await context.params;
    const { submissionId, demoOutcome } = verificationRequestSchema.parse(await request.json());
    const auth = await getAuthContext();
    if (auth.kind === "anonymous") throw new AppError("Sign in to verify proof.", 401, "UNAUTHORIZED");
    await enforceRateLimit(request, {
      action: "proof.verify",
      limit: 20,
      windowSeconds: 60 * 60,
      subject: auth.kind === "user" ? auth.user.id : undefined,
    });

    if (auth.kind === "demo") {
      if (!isDemoEnabled()) throw new AppError("Demo verification is disabled.", 403, "DEMO_DISABLED");
      const completedIds = await getDemoCompletedQuestIds();
      const before = getDemoCampaign(completedIds);
      const quest = before.quests.find((item) => item.id === questId);
      if (!quest || submissionId !== questId) throw new AppError("Submission not found.", 404, "NOT_FOUND");

      const aiReceipt = {
        traceId,
        mode: "demo" as const,
        model: "seeded-demo",
        latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
        safety: "simulated" as const,
        schemaValidated: true,
      };

      if (demoOutcome === "rejected") {
        const result = completionResultSchema.parse({
          submissionId,
          verifiedAt: new Date().toISOString(),
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
          aiReceipt,
        });
        await recordOperationalEvent({ eventName: "proof.verify", traceId, status: "rejected", latencyMs: Math.round(performance.now() - startedAt), model: "seeded-demo", metadata: { demo: true } });
        return NextResponse.json({ ...result, demoFallback: true });
      }

      const duplicate = completedIds.includes(questId);
      const nextIds = duplicate ? completedIds : [...completedIds, questId];
      const after = getDemoCampaign(nextIds);
      const result = completionResultSchema.parse({
        submissionId,
        verifiedAt: new Date().toISOString(),
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
        adaptiveQuestCreated: false,
        aiReceipt,
      });
      const response = NextResponse.json({ ...result, demoFallback: true });
      response.cookies.set(DEMO_PROGRESS_COOKIE, encodeDemoProgress(nextIds), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      await recordOperationalEvent({ eventName: "proof.verify", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), model: "seeded-demo", metadata: { demo: true, duplicate } });
      return response;
    }

    const claim = await claimVerification(submissionId, auth.user.id, traceId);
    if (claim.state === "accepted" || claim.state === "rejected") {
      if (!claim.completionResult.success) {
        throw new AppError("The saved verification receipt is invalid.", 500, "INVALID_VERIFICATION_RECEIPT");
      }
      return Response.json(claim.completionResult.data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (!claim.claimed || !claim.processingToken) return processingResponse();
    activeClaim = { submissionId, processingToken: claim.processingToken };

    let assessment = storedAssessmentSchema.safeParse(claim.rawResult);
    if (!assessment.success) {
      const admin = createSupabaseAdminClient();
      const { data: submission, error: submissionError } = await admin
        .from("quest_submissions")
        .select("id,storage_path,proof_deleted_at")
        .eq("id", submissionId)
        .eq("quest_id", questId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (submissionError || !submission) throw new AppError("Submission not found.", 404, "NOT_FOUND");
      if (!submission.storage_path || submission.proof_deleted_at) {
        throw new AppError("This proof image has been deleted.", 410, "PROOF_DELETED");
      }

      const supabase = await createSupabaseServerClient();
      const { data: quest, error: questError } = await supabase
        .from("quests")
        .select("id,title,description,success_requirements")
        .eq("id", questId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (questError || !quest) throw new AppError("Quest not found.", 404, "NOT_FOUND");

      const { data: proofBlob, error: downloadError } = await supabase.storage
        .from("quest-proofs")
        .download(submission.storage_path);
      if (downloadError || !proofBlob) {
        throw new AppError("The proof image could not be read.", 500, "PROOF_READ_FAILED");
      }
      const imageDataUrl = `data:${proofBlob.type || "image/jpeg"};base64,${Buffer.from(await proofBlob.arrayBuffer()).toString("base64")}`;
      const requirements = z.array(z.string().min(1)).min(1).max(5).parse(quest.success_requirements);

      await assertAiUsageAvailable(auth.user.id, "proof_moderation");
      const moderation = await moderateProofImage(imageDataUrl, { userId: auth.user.id, traceId });
      if (moderation.flagged) {
        console.warn("Proof rejected by safety screening", { traceId, categories: moderation.categories });
        assessment = storedAssessmentSchema.safeParse({
          verified: false,
          confidence: 0,
          reason: "This proof could not be reviewed because it did not pass the image safety check. Choose a different image without sensitive or harmful content.",
          requirementsAssessment: requirements.map((requirement) => ({
            requirement,
            satisfied: false,
            explanation: "Verification stopped at the safety gate before this condition was assessed.",
          })),
          aiReceipt: {
            traceId,
            mode: "live",
            model: moderation.model,
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
            safety: "flagged",
            schemaValidated: false,
          },
        });
      } else {
        await assertAiUsageAvailable(auth.user.id, "proof_verification");
        const verification = await verifyProofWithAI({
          quest: {
            title: quest.title,
            description: quest.description,
            successRequirements: requirements,
          },
          imageDataUrl,
        }, { userId: auth.user.id, traceId });
        assessment = storedAssessmentSchema.safeParse({
          ...verification,
          aiReceipt: {
            traceId,
            mode: "live",
            model: getOpenAIModel(),
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
            safety: "passed",
            schemaValidated: true,
          },
        });
      }

      if (!assessment.success) {
        throw new AppError("The verification service returned an invalid result.", 502, "AI_VERIFICATION_FAILED");
      }
      await saveVerificationAssessment({
        submissionId,
        processingToken: activeClaim.processingToken,
        result: assessment.data as unknown as Json,
        safetyStatus: assessment.data.aiReceipt.safety === "flagged" ? "flagged" : "passed",
        model: assessment.data.aiReceipt.model,
        schemaValidated: assessment.data.aiReceipt.schemaValidated,
      });
    }

    if (!assessment.data.verified || assessment.data.confidence < VERIFICATION_CONFIDENCE_THRESHOLD) {
      const result = await finalizeRejectedVerification(
        submissionId,
        activeClaim.processingToken,
        assessment.data as unknown as Json,
      );
      activeClaim = null;
      await recordOperationalEvent({ eventName: "proof.verify", traceId, status: "rejected", latencyMs: Math.round(performance.now() - startedAt), model: assessment.data.aiReceipt.model, metadata: { safetyFlagged: assessment.data.aiReceipt.safety === "flagged" } });
      return Response.json(result);
    }

    const admin = createSupabaseAdminClient();
    const { data: completionData, error: completionError } = await admin.rpc("complete_quest", {
      p_submission_id: submissionId,
      p_processing_token: activeClaim.processingToken,
      p_result: assessment.data as unknown as Json,
      p_confidence: assessment.data.confidence,
      p_reason: assessment.data.reason,
      p_model_used: assessment.data.aiReceipt.model,
    });
    if (completionError) {
      console.error("Completion RPC failed", { code: completionError.code });
      throw new AppError("Your proof was accepted, but progression could not be applied. Retry safely.", 500, "PROGRESSION_FAILED");
    }
    const completion = completionResultSchema.parse(completionData);
    activeClaim = null;
    await recordOperationalEvent({ eventName: "proof.verify", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), model: assessment.data.aiReceipt.model, metadata: { duplicate: completion.duplicate } });
    return Response.json(completion);
  } catch (error) {
    if (activeClaim) {
      await markVerificationFailed(activeClaim.submissionId, activeClaim.processingToken, operationalErrorCode(error));
    }
    await recordOperationalEvent({ eventName: "proof.verify", traceId, status: operationalStatus(error), latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}
