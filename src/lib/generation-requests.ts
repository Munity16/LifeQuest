import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const generationClaimSchema = z.object({
  state: z.enum(["processing", "succeeded"]),
  claimed: z.boolean(),
  processingToken: z.uuid().optional(),
  campaignId: z.uuid().optional(),
});

export async function claimCampaignGeneration(userId: string, generationKey: string, processingToken: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_campaign_generation", {
    p_user_id: userId,
    p_generation_key: generationKey,
    p_processing_token: processingToken,
    p_stale_after_seconds: 300,
  });
  if (error) {
    console.error("Campaign generation claim failed", { code: error.code });
    throw new AppError("The campaign request could not be reserved. Please retry.", 503, "GENERATION_CLAIM_FAILED");
  }
  return generationClaimSchema.parse(data);
}
export async function failCampaignGeneration(
  userId: string,
  generationKey: string,
  processingToken: string,
  errorCode: string,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("fail_campaign_generation", {
    p_user_id: userId,
    p_generation_key: generationKey,
    p_processing_token: processingToken,
    p_error_code: errorCode,
  });
  if (error) {
    console.warn("Campaign generation failure state could not be persisted", { code: error.code });
  }
}
