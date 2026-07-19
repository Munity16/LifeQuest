import Link from "next/link";
import { Sparkles } from "lucide-react";
import { HeroCrest } from "@/components/hero-customization";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className, personalized = false }: { compact?: boolean; className?: string; personalized?: boolean }) {
  return (
    <Link href="/" className={cn("brand-mark", className)} aria-label="LifeQuest home">
      <span className="brand-rune" aria-hidden="true">{personalized ? <HeroCrest /> : <Sparkles size={17} strokeWidth={2.2} />}</span>
      {!compact && <span>Life<span>Quest</span></span>}
    </Link>
  );
}
