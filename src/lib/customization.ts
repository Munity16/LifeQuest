import { appearancePreferencesSchema, type AppearancePreferences } from "@/lib/schemas";
import { getHeroRank } from "@/lib/gameplay";

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: "classic",
  archetype: "scholar",
  heroTitle: "automatic",
  crest: "rune",
  accent: "gold",
  fontScale: "standard",
  contrast: "standard",
  motion: "system",
  density: "comfortable",
  soundEnabled: true,
};

export function normalizeAppearancePreferences(value: unknown): AppearancePreferences {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? { ...DEFAULT_APPEARANCE_PREFERENCES, ...value }
    : DEFAULT_APPEARANCE_PREFERENCES;
  const parsed = appearancePreferencesSchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_APPEARANCE_PREFERENCES;
}

export const HERO_THEMES = [
  { id: "classic", label: "Classic realm", description: "Carved wood, parchment, and bronze.", colors: ["#34271c", "#78974d", "#e0bd73"] },
  { id: "moonlit", label: "Moonlit keep", description: "Midnight blue with silver runes.", colors: ["#10182a", "#5378a8", "#d4def4"] },
  { id: "ember", label: "Ember forge", description: "Smoked iron with warm firelight.", colors: ["#241512", "#a94f32", "#f0b45d"] },
  { id: "verdant", label: "Verdant wilds", description: "Deep forest with moss and amber.", colors: ["#102018", "#4d8455", "#d3b967"] },
  { id: "amethyst", label: "Amethyst arcane", description: "Royal violet with luminous magic.", colors: ["#171126", "#7752a7", "#d7b8ff"] },
] as const satisfies readonly { id: AppearancePreferences["theme"]; label: string; description: string; colors: readonly [string, string, string] }[];

export const HERO_ARCHETYPES = [
  { id: "scholar", label: "Scholar", description: "Wisdom turns plans into progress.", image: "/art/code-apprentice.webp" },
  { id: "knight", label: "Knight", description: "Discipline holds the line.", image: "/art/hero-knight.webp" },
  { id: "mage", label: "Mage", description: "Focus becomes a practiced spell.", image: "/art/hero-mage.webp" },
  { id: "ranger", label: "Ranger", description: "Steady steps find the path.", image: "/art/hero-ranger.webp" },
  { id: "rogue", label: "Rogue", description: "Small moves outwit resistance.", image: "/art/hero-rogue.webp" },
] as const satisfies readonly { id: AppearancePreferences["archetype"]; label: string; description: string; image: string }[];

export const HERO_TITLE_OPTIONS = [
  { id: "automatic", label: "Current rank", minLevel: 1 },
  { id: "code_apprentice", label: "Code Apprentice", minLevel: 1 },
  { id: "rune_initiate", label: "Rune Initiate", minLevel: 2 },
  { id: "quest_adept", label: "Quest Adept", minLevel: 3 },
  { id: "campaign_knight", label: "Campaign Knight", minLevel: 4 },
  { id: "realm_champion", label: "Realm Champion", minLevel: 5 },
] as const satisfies readonly { id: AppearancePreferences["heroTitle"]; label: string; minLevel: number }[];

export const CREST_OPTIONS = [
  { id: "rune", label: "Rune" },
  { id: "crown", label: "Crown" },
  { id: "shield", label: "Shield" },
  { id: "star", label: "Star" },
] as const satisfies readonly { id: AppearancePreferences["crest"]; label: string }[];

export const ACCENT_OPTIONS = [
  { id: "gold", label: "Gold", color: "#e0bd73" },
  { id: "violet", label: "Violet", color: "#b594eb" },
  { id: "emerald", label: "Emerald", color: "#8ecb8e" },
  { id: "crimson", label: "Crimson", color: "#e48472" },
] as const satisfies readonly { id: AppearancePreferences["accent"]; label: string; color: string }[];

export function getArchetype(archetype: AppearancePreferences["archetype"]) {
  return HERO_ARCHETYPES.find((option) => option.id === archetype) ?? HERO_ARCHETYPES[0];
}

export function isHeroTitleUnlocked(heroTitle: AppearancePreferences["heroTitle"], level: number) {
  const option = HERO_TITLE_OPTIONS.find((candidate) => candidate.id === heroTitle);
  return Boolean(option && option.minLevel <= Math.max(1, Math.floor(level)));
}

export function resolveHeroTitle(heroTitle: AppearancePreferences["heroTitle"], level: number, startingTitle = "Code Apprentice") {
  if (heroTitle === "automatic") return getHeroRank(level, startingTitle);
  return HERO_TITLE_OPTIONS.find((option) => option.id === heroTitle)?.label ?? getHeroRank(level, startingTitle);
}
