import { Check, LockKeyhole, Radio } from "lucide-react";
import type { QuestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuestStatusBadge({ status, adaptive = false }: { status: QuestStatus; adaptive?: boolean }) {
  return (
    <span className={cn("status-badge", `status-${status}`, adaptive && "status-adaptive")}>
      {status === "completed" ? <Check size={12} /> : status === "locked" ? <LockKeyhole size={12} /> : <Radio size={11} />}
      {adaptive ? "Adaptive" : status.replace("_", " ")}
    </span>
  );
}
