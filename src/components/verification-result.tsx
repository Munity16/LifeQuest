import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VerificationResult({ verified, reason, onRetry }: { verified: boolean; reason: string; onRetry?: () => void }) {
  return (
    <div className={`verification-result ${verified ? "verification-accepted" : "verification-rejected"}`} role="status">
      {verified ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
      <div><strong>{verified ? "Proof accepted" : "Not quite yet"}</strong><p>{reason}</p></div>
      {!verified && onRetry && <Button variant="secondary" onClick={onRetry}><RotateCcw size={15} /> Try another image</Button>}
    </div>
  );
}
