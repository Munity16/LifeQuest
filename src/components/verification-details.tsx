import { Check, Cpu, ShieldCheck, Timer, X } from "lucide-react";
import type { CompletionResult } from "@/lib/types";

function DetailContent({ result }: { result: CompletionResult }) {
  return (
    <div className="verification-details-content">
      {result.requirementsAssessment.length > 0 && (
        <ul className="requirement-assessment" aria-label="AI assessment of victory conditions">
          {result.requirementsAssessment.map((item) => (
            <li className={item.satisfied ? "requirement-pass" : "requirement-fail"} key={item.requirement}>
              <span aria-hidden="true">{item.satisfied ? <Check size={15} /> : <X size={15} />}</span>
              <div><strong>{item.requirement}</strong><p>{item.explanation}</p></div>
            </li>
          ))}
        </ul>
      )}
      {result.aiReceipt && (
        <dl className="ai-receipt" aria-label="Privacy-safe AI verification receipt">
          <div><dt><Cpu size={13} /> Mode</dt><dd>{result.aiReceipt.mode === "live" ? result.aiReceipt.model : "Labelled demo"}</dd></div>
          <div><dt><Timer size={13} /> Review</dt><dd>{result.aiReceipt.latencyMs} ms</dd></div>
          <div><dt><ShieldCheck size={13} /> Safety</dt><dd>{result.aiReceipt.safety}</dd></div>
          <div><dt>Trace</dt><dd title={result.aiReceipt.traceId}>{result.aiReceipt.traceId.slice(0, 8)}</dd></div>
        </dl>
      )}
    </div>
  );
}

export function VerificationDetails({ result, collapsible = false }: { result: CompletionResult; collapsible?: boolean }) {
  if (!result.requirementsAssessment.length && !result.aiReceipt) return null;
  if (collapsible) {
    return (
      <details className="verification-details">
        <summary>{result.verified ? "Why this proof passed" : "Review the verdict"}</summary>
        <DetailContent result={result} />
      </details>
    );
  }
  return <DetailContent result={result} />;
}
