"use client";

import { useState } from "react";
import Image from "next/image";
import { Accessibility, Check, Crown, Eye, Gauge, RotateCcw, Save, Shield, Sparkles, Star, Volume2, VolumeX } from "lucide-react";
import { useAppearance } from "@/components/appearance-provider";
import { HeroCrest, HeroPortrait, HeroTitle } from "@/components/hero-customization";
import { ACCENT_OPTIONS, CREST_OPTIONS, DEFAULT_APPEARANCE_PREFERENCES, HERO_ARCHETYPES, HERO_THEMES, HERO_TITLE_OPTIONS } from "@/lib/customization";
import { appearancePreferencesSchema, type AppearancePreferences } from "@/lib/schemas";

type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

export function HeroCustomizationPanel({ level, displayName, isDemo = false }: { level: number; displayName: string; isDemo?: boolean }) {
  const { preferences, setPreferences } = useAppearance();
  const [savedPreferences, setSavedPreferences] = useState(preferences);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const dirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  function update<K extends keyof AppearancePreferences>(key: K, value: AppearancePreferences[K]) {
    setPreferences({ ...preferences, [key]: value });
    setStatus({ kind: "idle" });
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const body: unknown = await response.json();
      const errorMessage = body && typeof body === "object" && "error" in body
        ? (body as { error?: { message?: string } }).error?.message
        : undefined;
      if (!response.ok) throw new Error(errorMessage ?? "Your hero settings could not be saved.");
      const parsed = appearancePreferencesSchema.safeParse(body && typeof body === "object" && "preferences" in body ? (body as { preferences: unknown }).preferences : null);
      if (!parsed.success) throw new Error("The server returned invalid hero settings.");
      setPreferences(parsed.data);
      setSavedPreferences(parsed.data);
      setStatus({ kind: "saved", message: "Hero settings saved across your adventure." });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Your hero settings could not be saved." });
    }
  }

  function restoreSaved() {
    setPreferences(savedPreferences);
    setStatus({ kind: "idle" });
  }

  return (
    <section className="hero-workshop" aria-labelledby="hero-workshop-title">
      <div className="hero-workshop-heading">
        <div>
          <span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> Hero workshop</span>
          <h2 id="hero-workshop-title">Make the realm yours</h2>
          <p>Changes preview instantly. Save when your hero is ready.</p>
        </div>
        <div className="hero-workshop-preview" aria-label="Current hero preview">
          <span className="workshop-crest"><HeroCrest size={18} /></span>
          <span className="workshop-portrait"><HeroPortrait size={76} alt="Selected hero portrait" /></span>
          <span><strong>{displayName}</strong><HeroTitle level={level} /></span>
        </div>
      </div>

      <fieldset className="workshop-group">
        <legend>Realm theme</legend>
        <p>Choose the atmosphere applied across every screen.</p>
        <div className="theme-choice-grid">
          {HERO_THEMES.map((theme) => (
            <button type="button" className="theme-choice" key={theme.id} aria-pressed={preferences.theme === theme.id} onClick={() => update("theme", theme.id)}>
              <span className="theme-swatch" aria-hidden="true">{theme.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
              <span><strong>{theme.label}</strong><small>{theme.description}</small></span>
              {preferences.theme === theme.id && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="workshop-group">
        <legend>Hero archetype</legend>
        <p>Pick the portrait that represents how you approach your quests.</p>
        <div className="archetype-choice-grid">
          {HERO_ARCHETYPES.map((archetype) => (
            <button type="button" className="archetype-choice" key={archetype.id} aria-pressed={preferences.archetype === archetype.id} onClick={() => update("archetype", archetype.id)}>
              <span><Image src={archetype.image} alt="" width={88} height={88} sizes="88px" /></span>
              <strong>{archetype.label}</strong>
              <small>{archetype.description}</small>
              {preferences.archetype === archetype.id && <Check className="choice-check" size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="workshop-split">
        <fieldset className="workshop-group">
          <legend>Earned title</legend>
          <p>More ranks unlock as your level rises.</p>
          <div className="title-choice-list">
            {HERO_TITLE_OPTIONS.map((title) => {
              const locked = title.minLevel > level;
              return (
                <button type="button" key={title.id} disabled={locked} aria-pressed={preferences.heroTitle === title.id} onClick={() => update("heroTitle", title.id)}>
                  <Crown size={15} aria-hidden="true" />
                  <span>{title.label}{title.id === "automatic" && <small>Uses your newest rank</small>}</span>
                  {locked ? <em>Level {title.minLevel}</em> : preferences.heroTitle === title.id ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="workshop-group">
          <legend>Crest and accent</legend>
          <p>Your crest appears in the game header.</p>
          <div className="crest-choice-row">
            {CREST_OPTIONS.map((crest) => {
              const Icon = crest.id === "crown" ? Crown : crest.id === "shield" ? Shield : crest.id === "star" ? Star : Sparkles;
              return <button type="button" key={crest.id} aria-label={`${crest.label} crest`} title={`${crest.label} crest`} aria-pressed={preferences.crest === crest.id} onClick={() => update("crest", crest.id)}><Icon size={20} aria-hidden="true" /></button>;
            })}
          </div>
          <div className="accent-choice-row" aria-label="Accent color">
            {ACCENT_OPTIONS.map((accent) => <button type="button" key={accent.id} aria-label={`${accent.label} accent`} title={`${accent.label} accent`} aria-pressed={preferences.accent === accent.id} onClick={() => update("accent", accent.id)}><i style={{ backgroundColor: accent.color }} aria-hidden="true" /><span>{accent.label}</span></button>)}
          </div>
        </fieldset>
      </div>

      <fieldset className="workshop-group accessibility-group">
        <legend><Accessibility size={17} aria-hidden="true" /> Comfort and accessibility</legend>
        <p>These settings affect the full interface, not only this page.</p>
        <div className="accessibility-choice-grid">
          <PreferenceToggle icon={Eye} label="Larger text" detail="Increase interface text size" checked={preferences.fontScale === "large"} onChange={(checked) => update("fontScale", checked ? "large" : "standard")} />
          <PreferenceToggle icon={Sparkles} label="High contrast" detail="Strengthen borders and text" checked={preferences.contrast === "high"} onChange={(checked) => update("contrast", checked ? "high" : "standard")} />
          <PreferenceToggle icon={Gauge} label="Reduce motion" detail="Minimize animations and transitions" checked={preferences.motion === "reduced"} onChange={(checked) => update("motion", checked ? "reduced" : "system")} />
          <PreferenceToggle icon={Gauge} label="Compact layout" detail="Fit more quest information on screen" checked={preferences.density === "compact"} onChange={(checked) => update("density", checked ? "compact" : "comfortable")} />
          <PreferenceToggle icon={preferences.soundEnabled ? Volume2 : VolumeX} label="Quest narration" detail="Allow voice briefings on quest pages" checked={preferences.soundEnabled} onChange={(checked) => update("soundEnabled", checked)} />
        </div>
      </fieldset>

      <div className="workshop-actions">
        <span>{isDemo ? "Saved in this private demo browser session." : "Saved securely to your hero profile."}</span>
        <button type="button" className="button button-ghost" onClick={() => setPreferences(DEFAULT_APPEARANCE_PREFERENCES)} disabled={status.kind === "saving"}><RotateCcw size={15} aria-hidden="true" /> Defaults</button>
        {dirty && <button type="button" className="button button-secondary" onClick={restoreSaved} disabled={status.kind === "saving"}>Cancel preview</button>}
        <button type="button" className="button button-primary" onClick={() => void save()} disabled={!dirty || status.kind === "saving"}><Save size={15} aria-hidden="true" /> {status.kind === "saving" ? "Saving..." : "Save hero"}</button>
      </div>
      {status.kind !== "idle" && status.kind !== "saving" && <p className={`workshop-status workshop-status-${status.kind}`} role="status">{status.message}</p>}
    </section>
  );
}

function PreferenceToggle({ icon: Icon, label, detail, checked, onChange }: { icon: typeof Eye; label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" className="preference-toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span><Icon size={18} aria-hidden="true" /></span>
      <span><strong>{label}</strong><small>{detail}</small></span>
      <i aria-hidden="true"><b /></i>
    </button>
  );
}
