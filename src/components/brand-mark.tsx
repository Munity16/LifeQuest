import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("brand-mark", className)} aria-label="LifeQuest home">
      <span className="brand-rune" aria-hidden="true"><Sparkles size={17} strokeWidth={2.2} /></span>
      {!compact && <span>Life<span>Quest</span></span>}
    </Link>
  );
}
