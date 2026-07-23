import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/errors";
import { completionResultSchema } from "@/lib/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const verificationClaimSchema = z.object({
  state: z.enum(["pending", "processing", "accepted", "rejected", "failed"]),
  claimed: z.boolean(),
  processingToken: z.uuid().optional(),
  result: z.unknown().optional().nullable(),
});

export async function claimVerification(
  submissionId: string,
  userId: string,
  traceId: string,
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_quest_verification", {
    p_submission_id: submissionId,
    p_user_id: userId,
    p_trace_id: traceId,
    p_stale_after_seconds: 300,
  });
  if (error) {
    if (error.code === "P0002") throw new AppError("Submission not found.", 404, "NOT_FOUND");
    throw new AppError("Verification could not be reserved. Please retry.", 503, "VERIFICATION_CLAIM_FAILED");
  }
  const claim = verificationClaimSchema.parse(data);
  return {
    ...claim,
    rawResult: claim.result,
    completionResult: completionResultSchema.safeParse(claim.result),
  };
}

export async function saveVerificationAssessment(input: {
  submissionId: string;
  processingToken: string;
  result: Json;
  safetyStatus: "passed" | "flagged";
  model: string;
  schemaValidated: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("save_quest_verification_assessment", {
    p_submission_id: input.submissionId,
    p_processing_token: input.processingToken,
    p_result: input.result,
    p_safety_status: input.safetyStatus,
    p_model_used: input.model,
    p_schema_validated: input.schemaValidated,
  });
  if (error) throw new AppError("The verification assessment could not be saved.", 500, "VERIFICATION_SAVE_FAILED");
}

export async function finalizeRejectedVerification(
  submissionId: string,
  processingToken: string,
  result: Json,
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("finalize_quest_verification", {
    p_submission_id: submissionId,
    p_processing_token: processingToken,
    p_terminal_status: "rejected",
    p_result: result,
    p_error_code: null,
  });
  if (error) throw new AppError("The verification result could not be saved.", 500, "VERIFICATION_SAVE_FAILED");
  return completionResultSchema.parse(data);
}

export async function markVerificationFailed(
  submissionId: string,
  processingToken: string,
  errorCode: string,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("finalize_quest_verification", {
    p_submission_id: submissionId,
    p_processing_token: processingToken,
    p_terminal_status: "failed",
    p_result: {},
    p_error_code: errorCode,
  });
  if (error && process.env.NODE_ENV !== "test") {
    console.warn("Verification failure state could not be persisted", { code: error.code });
  }
}
