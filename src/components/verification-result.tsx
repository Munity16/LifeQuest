"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationDetails } from "@/components/verification-details";
import type { CompletionResult } from "@/lib/types";

export function VerificationResult({ verified, reason, result, onRetry }: { verified: boolean; reason: string; result?: CompletionResult; onRetry?: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={`verification-result ${verified ? "verification-accepted" : "verification-rejected"}`}
      role="status"
      initial={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
      animate={reduceMotion || verified ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, x: [0, -5, 5, -3, 0] }}
    >
      <span className="verification-icon">{verified ? <CheckCircle2 size={22} /> : <XCircle size={22} />}</span>
      <div><span className="verification-callout">{verified ? "Critical success" : "Attack blocked"}</span><strong>{verified ? "Proof accepted" : "Not quite yet"}</strong><p>{reason}</p></div>
      {result && <VerificationDetails result={result} />}
      {!verified && onRetry && <Button variant="secondary" onClick={onRetry}><RotateCcw size={15} /> Try another image</Button>}
    </motion.div>
  );
}
