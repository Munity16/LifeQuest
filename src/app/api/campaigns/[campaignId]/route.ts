import { getCampaign } from "@/lib/data";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new AppError("Campaign not found.", 404, "NOT_FOUND");
    return Response.json({ campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
