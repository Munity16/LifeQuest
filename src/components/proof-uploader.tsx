"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileImage, ScanSearch, ShieldCheck, UploadCloud, X } from "lucide-react";
import { CompletionCelebration } from "@/components/completion-celebration";
import { InlineLoader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { VerificationResult } from "@/components/verification-result";
import { ACCEPTED_IMAGE_TYPES, MAX_PROOF_BYTES } from "@/lib/config";
import type { CompletionResult } from "@/lib/types";

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
  return {
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
  };
}

export function ProofUploader({ questId, completed }: { questId: string; completed: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>(completed ? "accepted" : "idle");
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function chooseFile(selected: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setResult(null);
    setState("idle");

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

  async function submit() {
    if (!file) return setError("Choose a JPG, PNG, or WebP image first.");
    setError(null);
    setState("uploading");
    try {
      const formData = new FormData();
      formData.set("proof", file);
      const uploadResponse = await fetch(`/api/quests/${questId}/proof`, { method: "POST", body: formData });
      const uploadPayload: unknown = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(payloadMessage(uploadPayload));
      if (typeof uploadPayload !== "object" || !uploadPayload || !("submissionId" in uploadPayload) || typeof uploadPayload.submissionId !== "string") throw new Error("The upload response was incomplete.");

      setState("verifying");
      const verificationResponse = await fetch(`/api/quests/${questId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: uploadPayload.submissionId }),
      });
      const verificationPayload: unknown = await verificationResponse.json();
      if (!verificationResponse.ok) throw new Error(payloadMessage(verificationPayload));
      const parsed = parseResult(verificationPayload);
      if (!parsed) throw new Error("The verification response was incomplete.");
      setResult(parsed);
      setState(parsed.verified ? "accepted" : "rejected");
      if (parsed.verified && !parsed.duplicate) setShowCelebration(true);
      router.refresh();
    } catch (caught) {
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Verification failed.");
    }
  }

  if (completed && !result) {
    return <VerificationResult verified reason="This quest is complete. Your reward has already been applied." />;
  }

  return (
    <div className="proof-uploader">
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

      <div className="proof-privacy"><ShieldCheck size={15} /><span>Your proof stays private and is only used to evaluate this quest.</span></div>
      {error && <div className="form-error" role="alert" aria-live="polite">{error}</div>}
      {state === "rejected" && result && <VerificationResult verified={false} reason={result.reason} onRetry={() => chooseFile(null)} />}
      <Button type="button" className="verify-button" onClick={submit} disabled={!file || state === "uploading" || state === "verifying"}>
        {state === "uploading" ? <InlineLoader label="Securing your proof..." /> : state === "verifying" ? <InlineLoader label="GPT-5.6 is reviewing..." /> : <><ScanSearch size={17} /> Submit for verification</>}
      </Button>
      {showCelebration && result && <CompletionCelebration result={result} onContinue={() => { setShowCelebration(false); router.refresh(); }} />}
    </div>
  );
}
