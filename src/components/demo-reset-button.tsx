"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoResetButton() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resetDemo() {
    setResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      if (!response.ok) throw new Error("The demo could not be reset.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The demo could not be reset.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <span className="demo-reset-control">
      <button type="button" onClick={() => void resetDemo()} disabled={resetting}>
        <RotateCcw size={14} /> {resetting ? "Resetting..." : "Reset progress"}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
