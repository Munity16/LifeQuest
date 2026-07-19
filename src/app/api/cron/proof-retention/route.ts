import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError, ConfigurationError, errorResponse } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { operationalErrorCode, recordOperationalEvent } from "@/lib/telemetry";

const retentionDaysSchema = z.coerce.number().int().min(1).max(365);
const batchSize = 100;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) throw new ConfigurationError("A strong CRON_SECRET is required for proof retention cleanup.");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expectedHash = createHash("sha256").update(secret).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID();
  try {
    if (!isAuthorized(request)) throw new AppError("Retention cleanup is not authorized.", 401, "UNAUTHORIZED");
    const retentionDays = retentionDaysSchema.parse(process.env.PROOF_RETENTION_DAYS || "30");
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const admin = createSupabaseAdminClient();
    const { data: submissions, error: selectError } = await admin
      .from("quest_submissions")
      .select("id,storage_path")
      .not("storage_path", "is", null)
      .is("proof_deleted_at", null)
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (selectError) throw new AppError("Proof retention candidates could not be loaded.", 500, "RETENTION_QUERY_FAILED");

    const active = (submissions ?? []).filter((submission): submission is typeof submission & { storage_path: string } => Boolean(submission.storage_path));
    if (active.length) {
      const { error: storageError } = await admin.storage.from("quest-proofs").remove(active.map((submission) => submission.storage_path));
      if (storageError) throw new AppError("Expired proof objects could not be deleted.", 500, "RETENTION_STORAGE_FAILED");
      const deletedAt = new Date().toISOString();
      const { error: updateError } = await admin
        .from("quest_submissions")
        .update({ storage_path: null, proof_deleted_at: deletedAt })
        .in("id", active.map((submission) => submission.id));
      if (updateError) throw new AppError("Expired proof receipts could not be updated.", 500, "RETENTION_RECEIPT_FAILED");
    }

    await Promise.all([
      admin.from("api_rate_limits").delete().lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      admin.from("operational_events").delete().lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);
    await recordOperationalEvent({ eventName: "proof.retention", traceId, status: "success", latencyMs: Math.round(performance.now() - startedAt), metadata: { deletedCount: active.length, retentionDays } });
    return Response.json({ success: true, deletedCount: active.length, retentionDays });
  } catch (error) {
    await recordOperationalEvent({ eventName: "proof.retention", traceId, status: "error", latencyMs: Math.round(performance.now() - startedAt), errorCode: operationalErrorCode(error) });
    return errorResponse(error);
  }
}
