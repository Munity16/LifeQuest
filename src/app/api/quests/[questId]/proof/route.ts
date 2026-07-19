import { getAuthContext } from "@/lib/auth";
import { getDemoCampaign } from "@/lib/demo-data";
import { AppError, errorResponse } from "@/lib/errors";
import { extensionForMimeType, hasValidImageSignature, validateProofFile } from "@/lib/proof-files";
import { safeFilename } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ questId: string }> }) {
  try {
    const { questId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("proof");
    validateProofFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, file.type)) {
      throw new AppError("The selected file does not contain a valid supported image.", 400, "INVALID_IMAGE_CONTENT");
    }
    const auth = await getAuthContext();

    if (auth.kind === "demo") {
      const quest = getDemoCampaign().quests.find((item) => item.id === questId);
      if (!quest) throw new AppError("Quest not found.", 404, "NOT_FOUND");
      const requestedOutcome = formData.get("demoOutcome");
      const demoOutcome = requestedOutcome === "rejected" ? "rejected" : "accepted";
      return Response.json({ submissionId: questId, demoOutcome, demoFallback: true }, { status: 201 });
    }
    if (auth.kind !== "user") throw new AppError("Sign in to submit proof.", 401, "UNAUTHORIZED");

    const supabase = await createSupabaseServerClient();
    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("id,campaign_id,status")
      .eq("id", questId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (questError || !quest) throw new AppError("Quest not found.", 404, "NOT_FOUND");
    if (quest.status === "completed") throw new AppError("This quest is already complete.", 409, "ALREADY_COMPLETED");
    if (quest.status === "locked") throw new AppError("Complete an available quest before submitting proof here.", 409, "QUEST_LOCKED");

    const storagePath = `${auth.user.id}/${quest.campaign_id}/${quest.id}/${safeFilename(extensionForMimeType(file.type))}`;
    const { error: uploadError } = await supabase.storage.from("quest-proofs").upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("Proof upload failed", uploadError);
      throw new AppError("The proof image could not be uploaded. Please try again.", 500, "UPLOAD_FAILED");
    }

    const admin = createSupabaseAdminClient();
    const { data: submission, error: submissionError } = await admin
      .from("quest_submissions")
      .insert({ quest_id: quest.id, campaign_id: quest.campaign_id, user_id: auth.user.id, storage_path: storagePath })
      .select("id")
      .single();
    if (submissionError || !submission) {
      await supabase.storage.from("quest-proofs").remove([storagePath]);
      console.error("Submission record failed", submissionError);
      throw new AppError("The proof could not be prepared for review.", 500, "SUBMISSION_FAILED");
    }

    return Response.json({ submissionId: submission.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
