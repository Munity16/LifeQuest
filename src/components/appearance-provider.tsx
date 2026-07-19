"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppearancePreferences } from "@/lib/schemas";

type AppearanceContextValue = {
  preferences: AppearancePreferences;
  setPreferences: (preferences: AppearancePreferences) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function applyAppearance(preferences: AppearancePreferences) {
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.dataset.accent = preferences.accent;
  root.dataset.crest = preferences.crest;
  root.dataset.fontScale = preferences.fontScale;
  root.dataset.contrast = preferences.contrast;
  root.dataset.motion = preferences.motion;
  root.dataset.density = preferences.density;
}

export function AppearanceProvider({ initialPreferences, children }: { initialPreferences: AppearancePreferences; children: React.ReactNode }) {
  const [preferences, setPreferenceState] = useState(initialPreferences);

  useEffect(() => applyAppearance(preferences), [preferences]);

  const setPreferences = useCallback((next: AppearancePreferences) => {
    applyAppearance(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preferences, setPreferences }), [preferences, setPreferences]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used within AppearanceProvider.");
  return value;
}
