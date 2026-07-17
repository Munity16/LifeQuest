import { cookies } from "next/headers";
import { DEMO_COOKIE, DEMO_PROGRESS_COOKIE, isDemoEnabled } from "@/lib/config";

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
