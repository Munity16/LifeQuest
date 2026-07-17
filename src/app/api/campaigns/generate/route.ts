import { getAuthContext } from "@/lib/auth";
import { DEMO_CAMPAIGN_ID } from "@/lib/config";
import { persistGeneratedCampaign } from "@/lib/data";
import { AppError, errorResponse } from "@/lib/errors";
import { generateCampaignWithAI } from "@/lib/openai/services";
import { generationKeySchema, onboardingSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const input = onboardingSchema.parse(await request.json());
    const generationKey = generationKeySchema.parse(request.headers.get("Idempotency-Key"));
    const auth = await getAuthContext();

    if (auth.kind === "demo") {
      return Response.json({ campaignId: DEMO_CAMPAIGN_ID, demoSeeded: true });
    }
    if (auth.kind !== "user") {
      throw new AppError("Sign in before creating a campaign.", 401, "UNAUTHORIZED");
    }

    const generated = await generateCampaignWithAI(input);
    const campaignId = await persistGeneratedCampaign(auth.user.id, generationKey, input, generated);
    return Response.json({ campaignId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
