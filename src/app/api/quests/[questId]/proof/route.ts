import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { getDemoCampaign } from "@/lib/demo-data";
import { AppError, errorResponse } from "@/lib/errors";
import { extensionForMimeType, hasValidImageSignature, validateProofFile } from "@/lib/proof-files";
import { safeFilename } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { operationalErrorCode, operationalStatus, recordOperationalEvent } from "@/lib/telemetry";

const proofDeletionSchema = z.object({ submissionId: z.uuid() });

export async function POST(request: Request, context: { params: Promise<{ questId: string }> }) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  try {
    const { questId } = await context.params;
    const auth = await getAuthContext();
    if (auth.kind === "anonymous") throw new AppError("Sign in to submit proof.", 401, "UNAUTHORIZED");
    await enforceRateLimit(request, {
      action: "proof.upload",
      limit: 20,
      windowSeconds: 60 * 60,
      subject: auth.kind === "user" ? auth.user.id : undefined,
    });
    const formData = await request.formData();
    const file = formData.get("proof");
    validateProofFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, file.type)) {
      throw new AppError("The selected file does not contain a valid supported image.", 400, "INVALID_IMAGE_CONTENT");
    }
    if (auth.kind === "demo") {
      const quest = getDemoCampaign().quests.find((item) => item.id === questId);
      if (!quest) throw new AppError("Quest not found.", 404, "NOT_FOUND");
      const requestedOutcome = formData.get("demoOutcome");
      const demoOutcome = requestedOutcome === "rejected" ? "rejected" : "accepted";
      await recordOperationalEvent({ eventName: "proof.upload", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), metadata: { demo: true } });
      return Response.json({ submissionId: questId, demoOutcome, demoFallback: true }, { status: 201 });
    }

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

    await recordOperationalEvent({ eventName: "proof.upload", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), metadata: { demo: false } });
    return Response.json({ submissionId: submission.id }, { status: 201 });
  } catch (error) {
    await recordOperationalEvent({ eventName: "proof.upload", traceId, status: operationalStatus(error), latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ questId: string }> }) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  try {
    const { questId } = await context.params;
    const auth = await getAuthContext();
    if (auth.kind !== "user") throw new AppError("Sign in to delete stored proof.", 401, "UNAUTHORIZED");
    await enforceRateLimit(request, { action: "proof.delete", limit: 10, windowSeconds: 60 * 60, subject: auth.user.id });
    const { submissionId } = proofDeletionSchema.parse(await request.json());
    const admin = createSupabaseAdminClient();
    const { data: submission, error: submissionError } = await admin
      .from("quest_submissions")
      .select("id,storage_path,proof_deleted_at")
      .eq("id", submissionId)
      .eq("quest_id", questId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (submissionError || !submission) throw new AppError("Stored proof not found.", 404, "NOT_FOUND");

    if (submission.proof_deleted_at || !submission.storage_path) {
      return Response.json({ deleted: true, duplicate: true, deletedAt: submission.proof_deleted_at });
    }

    const { error: storageError } = await admin.storage.from("quest-proofs").remove([submission.storage_path]);
    if (storageError) throw new AppError("The proof image could not be deleted. Please retry.", 500, "PROOF_DELETE_FAILED");

    const deletedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("quest_submissions")
      .update({ storage_path: null, proof_deleted_at: deletedAt })
      .eq("id", submission.id)
      .eq("user_id", auth.user.id);
    if (updateError) throw new AppError("The proof deletion receipt could not be saved.", 500, "PROOF_DELETE_RECEIPT_FAILED");

    await recordOperationalEvent({ eventName: "proof.delete", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt) });
    return Response.json({ deleted: true, duplicate: false, deletedAt });
  } catch (error) {
    await recordOperationalEvent({ eventName: "proof.delete", traceId, status: operationalStatus(error), latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}
