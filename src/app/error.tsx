"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("LifeQuest route error", error); }, [error]);
  return (
    <main id="main-content" className="route-state">
      <div className="state-card state-error"><AlertTriangle size={28} /><h1>The path is obscured</h1><p>LifeQuest could not load this part of the campaign. Your saved progress has not been changed.</p><Button onClick={reset}>Try again</Button></div>
    </main>
  );
}
