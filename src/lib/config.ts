export const APP_NAME = "LifeQuest";
export const APP_TAGLINE = "Turn your goals into adventures.";
export const DEMO_CAMPAIGN_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_COOKIE = "lifequest_demo";
export const DEMO_PROGRESS_COOKIE = "lifequest_demo_progress";
export const DEMO_PREFERENCES_COOKIE = "lifequest_demo_preferences";
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VERIFICATION_CONFIDENCE_THRESHOLD = 0.72;

export function isDemoEnabled() {
  return process.env.DEMO_MODE_ENABLED === "true";
}
