"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, FileImage, ScanSearch, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { CompletionCelebration } from "@/components/completion-celebration";
import { InlineLoader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { VerificationResult } from "@/components/verification-result";
import { ACCEPTED_IMAGE_TYPES, MAX_PROOF_BYTES } from "@/lib/config";
import type { CompletionResult, ProofRetentionSummary } from "@/lib/types";

type UploadState = "idle" | "uploading" | "verifying" | "accepted" | "rejected";

function payloadMessage(payload: unknown) {
  if (typeof payload === "object" && payload && "error" in payload) {
    const error = payload.error;
    if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  }
  return "Verification could not be completed. Please try again.";
}

function parseResult(payload: unknown): CompletionResult | null {
  if (typeof payload !== "object" || payload === null || !("verified" in payload) || typeof payload.verified !== "boolean") return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.verifiedAt !== "string") return null;
  const requirementsAssessment = Array.isArray(value.requirementsAssessment)
    ? value.requirementsAssessment.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const assessment = item as Record<string, unknown>;
      if (typeof assessment.requirement !== "string" || typeof assessment.satisfied !== "boolean" || typeof assessment.explanation !== "string") return [];
      return [{ requirement: assessment.requirement, satisfied: assessment.satisfied, explanation: assessment.explanation }];
    })
    : [];
  const receiptValue = typeof value.aiReceipt === "object" && value.aiReceipt !== null ? value.aiReceipt as Record<string, unknown> : null;
  const validMode = receiptValue?.mode === "live" || receiptValue?.mode === "demo";
  const validSafety = receiptValue?.safety === "passed" || receiptValue?.safety === "flagged" || receiptValue?.safety === "simulated";
  const aiReceipt = receiptValue && validMode && validSafety && typeof receiptValue.traceId === "string" && typeof receiptValue.model === "string" && typeof receiptValue.latencyMs === "number" && typeof receiptValue.schemaValidated === "boolean"
    ? {
      traceId: receiptValue.traceId,
      mode: receiptValue.mode as "live" | "demo",
      model: receiptValue.model,
      latencyMs: receiptValue.latencyMs,
      safety: receiptValue.safety as "passed" | "flagged" | "simulated",
      schemaValidated: receiptValue.schemaValidated,
    }
    : undefined;
  return {
    submissionId: typeof value.submissionId === "string" ? value.submissionId : undefined,
    verifiedAt: value.verifiedAt,
    verified: typeof value.verified === "boolean" ? value.verified : false,
    duplicate: typeof value.duplicate === "boolean" ? value.duplicate : false,
    reason: typeof value.reason === "string" ? value.reason : "Verification finished.",
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    xpAwarded: typeof value.xpAwarded === "number" ? value.xpAwarded : 0,
    enemyDamage: typeof value.enemyDamage === "number" ? value.enemyDamage : 0,
    totalXp: typeof value.totalXp === "number" ? value.totalXp : 0,
    currentLevel: typeof value.currentLevel === "number" ? value.currentLevel : 1,
    enemyCurrentHealth: typeof value.enemyCurrentHealth === "number" ? value.enemyCurrentHealth : 100,
    levelledUp: typeof value.levelledUp === "boolean" ? value.levelledUp : false,
    adaptiveQuestCreated: typeof value.adaptiveQuestCreated === "boolean" ? value.adaptiveQuestCreated : false,
    requirementsAssessment,
    aiReceipt,
  };
}

function canvasToFile(canvas: HTMLCanvasElement, name: string) {
  return new Promise<File>((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob) return reject(new Error("The sample proof could not be prepared."));
    resolve(new File([blob], name, { type: "image/png" }));
  }, "image/png"));
}

async function createDemoProof(outcome: "accepted" | "rejected") {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser cannot prepare the sample proof.");
  context.fillStyle = "#11151b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#27313e";
  context.fillRect(36, 32, 888, 62);
  context.fillStyle = "#f2d88a";
  context.font = "bold 28px monospace";
  context.fillText(outcome === "accepted" ? "quest.py — completed work" : "quest.py — incomplete capture", 64, 72);
  if (outcome === "accepted") {
    context.fillStyle = "#d8e0cf";
    context.font = "24px monospace";
    ["hero_name = 'Code Apprentice'", "hero_age = 21", "learning_goal = 'Learn Python'", "print(hero_name, hero_age, learning_goal)"].forEach((line, index) => context.fillText(line, 72, 154 + index * 48));
    context.fillStyle = "#1c251a";
    context.fillRect(48, 378, 864, 164);
    context.fillStyle = "#a8c96f";
    context.fillText("> python quest.py", 72, 426);
    context.fillText("Code Apprentice 21 Learn Python", 72, 478);
    context.fillText("Process finished successfully", 72, 520);
  } else {
    context.fillStyle = "#77766e";
    context.fillRect(58, 134, 844, 292);
    context.fillStyle = "#302f2a";
    for (let index = 0; index < 6; index += 1) context.fillRect(96, 174 + index * 36, 640 - index * 48, 14);
    context.fillStyle = "#efb0a6";
    context.font = "bold 30px monospace";
    context.fillText("OUTPUT CROPPED — REQUIREMENTS NOT VISIBLE", 76, 504);
  }
  return canvasToFile(canvas, `lifequest-demo-${outcome}.png`);
}

async function waitForVerification(questId: string, submissionId: string, demoOutcome?: "accepted" | "rejected") {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`/api/quests/${questId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, demoOutcome }),
    });
    const payload: unknown = await response.json();
    if (response.status === 202) {
      const retrySeconds = Number(response.headers.get("Retry-After")) || 3;
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(5, retrySeconds) * 1_000));
      continue;
    }
    if (!response.ok) throw new Error(payloadMessage(payload));
    return payload;
  }
  throw new Error("Verification is still processing. Try again in a moment; your saved proof will not be charged twice.");
}

export function ProofUploader({ questId, completed, isDemo, existingProof }: { questId: string; completed: boolean; isDemo: boolean; existingProof: ProofRetentionSummary | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>(completed ? "accepted" : "idle");
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [demoOutcome, setDemoOutcome] = useState<"accepted" | "rejected" | null>(null);
  const [proofDeletedAt, setProofDeletedAt] = useState<string | null>(existingProof?.deletedAt ?? null);
  const [deletingProof, setDeletingProof] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function chooseFile(selected: File | null, sampleOutcome: "accepted" | "rejected" | null = null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setResult(null);
    setState("idle");
    setDemoOutcome(sampleOutcome);
    if (selected) setProofDeletedAt(null);
    if (!selected && inputRef.current) inputRef.current.value = "";

    if (selected && !ACCEPTED_IMAGE_TYPES.includes(selected.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setFile(null);
      setPreviewUrl(null);
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (selected && (selected.size <= 0 || selected.size > MAX_PROOF_BYTES)) {
      setFile(null);
      setPreviewUrl(null);
      setError("The image must be smaller than 5 MB.");
      return;
    }

    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function loadDemoProof(outcome: "accepted" | "rejected") {
    try {
      chooseFile(await createDemoProof(outcome), outcome);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sample proof could not be prepared.");
    }
  }

  async function submit() {
    if (!file) return setError("Choose a JPG, PNG, or WebP image first.");
    setError(null);
    setState("uploading");
    try {
      const formData = new FormData();
      formData.set("proof", file);
      if (isDemo && demoOutcome) formData.set("demoOutcome", demoOutcome);
      const uploadResponse = await fetch(`/api/quests/${questId}/proof`, { method: "POST", body: formData });
      const uploadPayload: unknown = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(payloadMessage(uploadPayload));
      if (typeof uploadPayload !== "object" || !uploadPayload || !("submissionId" in uploadPayload) || typeof uploadPayload.submissionId !== "string") throw new Error("The upload response was incomplete.");

      setState("verifying");
      const verificationPayload = await waitForVerification(
        questId,
        uploadPayload.submissionId,
        isDemo && "demoOutcome" in uploadPayload && (uploadPayload.demoOutcome === "accepted" || uploadPayload.demoOutcome === "rejected")
          ? uploadPayload.demoOutcome
          : undefined,
      );
      const parsed = parseResult(verificationPayload);
      if (!parsed) throw new Error("The verification response was incomplete.");
      setProofDeletedAt(null);
      setResult(parsed);
      setState(parsed.verified ? "accepted" : "rejected");
      if (parsed.verified && !parsed.duplicate) setShowCelebration(true);
      router.refresh();
    } catch (caught) {
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Verification failed.");
    }
  }

  async function deleteStoredProof(submissionId: string) {
    setDeletingProof(true);
    setError(null);
    try {
      const response = await fetch(`/api/quests/${questId}/proof`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(payloadMessage(payload));
      const deletedAt = typeof payload === "object" && payload && "deletedAt" in payload && typeof payload.deletedAt === "string"
        ? payload.deletedAt
        : new Date().toISOString();
      setProofDeletedAt(deletedAt);
      setConfirmingDelete(false);
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The proof image could not be deleted.");
    } finally {
      setDeletingProof(false);
    }
  }

  const retentionSubmissionId = result?.submissionId || existingProof?.submissionId;
  const retentionControl = !isDemo && retentionSubmissionId ? (
    <div className="proof-retention-control" role="status">
      {proofDeletedAt ? (
        <><ShieldCheck size={16} /><span>Proof image deleted. The privacy-safe verification receipt remains.</span></>
      ) : (
        <>
          <span>Proof images expire automatically after the configured retention period.</span>
          {confirmingDelete ? (
            <div className="proof-delete-confirmation">
              <strong>Delete this private proof permanently?</strong>
              <span>Your verification receipt and earned progression will remain.</span>
              <Button type="button" variant="danger" onClick={() => void deleteStoredProof(retentionSubmissionId)} disabled={deletingProof}>
                <Trash2 size={15} /> {deletingProof ? "Deleting proof..." : "Confirm deletion"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deletingProof}>Keep proof</Button>
            </div>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={15} /> Delete stored proof now
            </Button>
          )}
        </>
      )}
    </div>
  ) : null;

  if (completed && !result) {
    return <><VerificationResult verified reason="This quest is complete. Your reward has already been applied." />{retentionControl}</>;
  }

  return (
    <div className="proof-uploader">
      {isDemo && (
        <div className="demo-proof-controls" aria-label="Judge demonstration proofs">
          <span>Judge shortcuts</span>
          <button type="button" onClick={() => void loadDemoProof("accepted")}>
            <CircleCheck size={16} /> Load passing proof
          </button>
          <button type="button" onClick={() => void loadDemoProof("rejected")}>
            <CircleX size={16} /> Load rejected proof
          </button>
        </div>
      )}
      <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
      {!previewUrl ? (
        <button className="upload-dropzone" type="button" onClick={() => inputRef.current?.click()}>
          <span><UploadCloud size={25} /></span>
          <strong>Choose your proof image</strong>
          <small>JPG, PNG or WebP · maximum 5 MB</small>
        </button>
      ) : (
        <div className="proof-preview">
          <Image src={previewUrl} alt="Selected quest proof preview" fill unoptimized sizes="(max-width: 700px) 100vw, 600px" />
          <button type="button" onClick={() => chooseFile(null)} aria-label="Remove selected image"><X size={17} /></button>
          <div><FileImage size={15} /><span>{file?.name}</span></div>
        </div>
      )}

      <div className="proof-privacy">
        <ShieldCheck size={15} />
        <span>
          Stored privately after location metadata is removed, then sent through safety and quest-only AI checks.
          {" "}<Link href="/privacy#proofs">How proof privacy works</Link>
        </span>
      </div>
      {state === "idle" && !file && retentionControl}
      {error && <div className="form-error" role="alert" aria-live="polite">{error}</div>}
      {state === "rejected" && result && <><VerificationResult verified={false} reason={result.reason} result={result} onRetry={() => chooseFile(null)} />{retentionControl}</>}
      <Button type="button" className="verify-button" onClick={submit} disabled={!file || state === "uploading" || state === "verifying"}>
        {state === "uploading" ? <InlineLoader label="Securing your proof..." /> : state === "verifying" ? <InlineLoader label="GPT-5.6 is reviewing..." /> : <><ScanSearch size={17} /> Submit for verification</>}
      </Button>
      {showCelebration && result && <CompletionCelebration result={result} onContinue={() => { setShowCelebration(false); router.refresh(); }} />}
      {state === "accepted" && result && !showCelebration && <><VerificationResult verified reason={result.reason} result={result} />{retentionControl}</>}
    </div>
  );
}
