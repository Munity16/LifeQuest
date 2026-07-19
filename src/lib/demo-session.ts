import { cookies } from "next/headers";
import { DEMO_COOKIE, DEMO_PREFERENCES_COOKIE, DEMO_PROGRESS_COOKIE, isDemoEnabled } from "@/lib/config";
import { normalizeAppearancePreferences } from "@/lib/customization";
import type { AppearancePreferences } from "@/lib/schemas";

export async function hasDemoSession() {
  if (!isDemoEnabled()) return false;
  return (await cookies()).get(DEMO_COOKIE)?.value === "active";
}

export async function getDemoCompletedQuestIds() {
  const value = (await cookies()).get(DEMO_PROGRESS_COOKIE)?.value;
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function encodeDemoProgress(ids: string[]) {
  return encodeURIComponent(JSON.stringify([...new Set(ids)]));
}

export async function getDemoAppearancePreferences() {
  const value = (await cookies()).get(DEMO_PREFERENCES_COOKIE)?.value;
  if (!value) return normalizeAppearancePreferences(null);
  try {
    return normalizeAppearancePreferences(JSON.parse(decodeURIComponent(value)));
  } catch {
    return normalizeAppearancePreferences(null);
  }
}

export function encodeDemoAppearancePreferences(preferences: AppearancePreferences) {
  return encodeURIComponent(JSON.stringify(preferences));
}
