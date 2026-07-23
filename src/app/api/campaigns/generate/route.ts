import { getAuthContext } from "@/lib/auth";
import { DEMO_CAMPAIGN_ID } from "@/lib/config";
import { persistGeneratedCampaign } from "@/lib/data";
import { AppError, errorResponse } from "@/lib/errors";
import { generateCampaignWithAI } from "@/lib/openai/services";
import { getOpenAIModel } from "@/lib/openai/client";
import { assertAiUsageAvailable } from "@/lib/ai-usage";
import { claimCampaignGeneration, failCampaignGeneration } from "@/lib/generation-requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generationKeySchema, onboardingSchema } from "@/lib/schemas";
import { operationalErrorCode, operationalStatus, recordOperationalEvent } from "@/lib/telemetry";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  let claimedGeneration: { userId: string; generationKey: string; processingToken: string } | null = null;
  try {
    const input = onboardingSchema.parse(await request.json());
    const generationKey = generationKeySchema.parse(request.headers.get("Idempotency-Key"));
    const auth = await getAuthContext();
    if (auth.kind === "anonymous") {
      throw new AppError("Sign in before creating a campaign.", 401, "UNAUTHORIZED");
    }
    await enforceRateLimit(request, {
      action: "campaign.generate",
      limit: 5,
      windowSeconds: 60 * 60,
      subject: auth.kind === "user" ? auth.user.id : undefined,
    });

    if (auth.kind === "demo") {
      await recordOperationalEvent({ eventName: "campaign.generate", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), metadata: { demo: true } });
      return Response.json({ campaignId: DEMO_CAMPAIGN_ID, demoSeeded: true });
    }

    const generationClaim = await claimCampaignGeneration(auth.user.id, generationKey, traceId);
    if (generationClaim.state === "succeeded" && generationClaim.campaignId) {
      return Response.json({ campaignId: generationClaim.campaignId, duplicate: true });
    }
    if (!generationClaim.claimed) {
      return Response.json(
        { processing: true, message: "This campaign is already being forged." },
        { status: 202, headers: { "Retry-After": "3", "Cache-Control": "no-store" } },
      );
    }
    claimedGeneration = { userId: auth.user.id, generationKey, processingToken: traceId };
    await assertAiUsageAvailable(auth.user.id, "campaign_generation");
    const generated = await generateCampaignWithAI(input, { userId: auth.user.id, traceId });
    const campaignId = await persistGeneratedCampaign(auth.user.id, generationKey, input, generated);
    await recordOperationalEvent({ eventName: "campaign.generate", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), model: getOpenAIModel(), metadata: { demo: false } });
    return Response.json({ campaignId }, { status: 201 });
  } catch (error) {
    if (claimedGeneration) {
      await failCampaignGeneration(
        claimedGeneration.userId,
        claimedGeneration.generationKey,
        claimedGeneration.processingToken,
        operationalErrorCode(error),
      );
    }
    await recordOperationalEvent({ eventName: "campaign.generate", traceId, status: operationalStatus(error), latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}
