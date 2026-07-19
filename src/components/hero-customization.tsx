"use client";

import Image from "next/image";
import { Crown, Shield, Sparkles, Star } from "lucide-react";
import { useAppearance } from "@/components/appearance-provider";
import { getArchetype, resolveHeroTitle } from "@/lib/customization";

export function HeroPortrait({ alt, size, className, priority = false }: { alt?: string; size: number; className?: string; priority?: boolean }) {
  const { preferences } = useAppearance();
  const archetype = getArchetype(preferences.archetype);
  return <Image className={className} src={archetype.image} alt={alt ?? `${archetype.label} hero portrait`} width={size} height={size} sizes={`${size}px`} priority={priority} />;
}

export function HeroTitle({ level, startingTitle, as: Tag = "span", className }: { level: number; startingTitle?: string; as?: "span" | "strong"; className?: string }) {
  const { preferences } = useAppearance();
  return <Tag className={className}>{resolveHeroTitle(preferences.heroTitle, level, startingTitle)}</Tag>;
}

export function HeroCrest({ size = 17 }: { size?: number }) {
  const { preferences } = useAppearance();
  const icons = { rune: Sparkles, crown: Crown, shield: Shield, star: Star };
  const Icon = icons[preferences.crest];
  return <Icon size={size} strokeWidth={2.2} aria-hidden="true" />;
}
