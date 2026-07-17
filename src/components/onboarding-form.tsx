"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Brain, Clock3, Gauge, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoader } from "@/components/states";
import { onboardingSchema, type OnboardingInput } from "@/lib/schemas";

const times = [15, 30, 45, 60] as const;
const obstacles = [
  ["procrastination", "Procrastination"],
  ["distraction", "Distraction"],
  ["lack-of-confidence", "Lack of confidence"],
  ["inconsistency", "Inconsistency"],
  ["feeling-overwhelmed", "Feeling overwhelmed"],
  ["other", "Other"],
] as const;
const difficulties = [
  ["gentle", "Gentle", "Small steps and comfortable rewards"],
  ["balanced", "Balanced", "Steady progress with meaningful challenge"],
  ["challenging", "Challenging", "Bolder tasks and greater rewards"],
] as const;

function responseError(payload: unknown) {
  if (typeof payload === "object" && payload && "error" in payload) {
    const error = payload.error;
    if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  }
  return "The campaign could not be created. Please try again.";
}

export function OnboardingForm({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const [generationKey] = useState(() => crypto.randomUUID());
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      goal: "Learn Python fundamentals in seven days.",
      dailyMinutes: 30,
      mainObstacle: "procrastination",
      difficulty: "balanced",
      customObstacle: "",
    },
  });
  const obstacle = useWatch({ control, name: "mainObstacle" });
  const goal = useWatch({ control, name: "goal" });

  async function onSubmit(values: OnboardingInput) {
    setServerError(null);
    try {
      const response = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": generationKey },
        body: JSON.stringify(values),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(payload));
      if (typeof payload !== "object" || !payload || !("campaignId" in payload) || typeof payload.campaignId !== "string") {
        throw new Error("The campaign response was incomplete. Please retry.");
      }
      router.push(`/campaign/${payload.campaignId}`);
      router.refresh();
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : "The campaign forge is unavailable.");
    }
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit(onSubmit)}>
      {isDemo && <div className="demo-notice"><Sparkles size={16} /><span>Demo mode uses the pre-generated Python campaign for presentation reliability.</span></div>}
      <fieldset className="onboarding-section onboarding-goal">
        <legend><span>1</span><div><strong>Choose your destination</strong><small>What do you want to achieve?</small></div></legend>
        <label className="sr-only" htmlFor="goal">Your goal</label>
        <textarea id="goal" rows={3} maxLength={240} {...register("goal")} aria-invalid={Boolean(errors.goal)} />
        <div className="field-helper"><span>Example: Learn Python fundamentals in seven days.</span><span>{goal?.length || 0}/240</span></div>
        {errors.goal && <p className="field-error">{errors.goal.message}</p>}
      </fieldset>

      <fieldset className="onboarding-section">
        <legend><span>2</span><div><strong>Set your daily pace</strong><small>How much focused time can you protect?</small></div></legend>
        <div className="choice-grid time-grid">
          {times.map((time) => <label className="choice-card" key={time}><input type="radio" value={time} {...register("dailyMinutes", { valueAsNumber: true })} /><Clock3 size={19} /><strong>{time}</strong><small>minutes</small></label>)}
        </div>
        {errors.dailyMinutes && <p className="field-error">{errors.dailyMinutes.message}</p>}
      </fieldset>

      <fieldset className="onboarding-section">
        <legend><span>3</span><div><strong>Name your nemesis</strong><small>What most often blocks your progress?</small></div></legend>
        <div className="choice-grid obstacle-grid">
          {obstacles.map(([value, label]) => <label className="choice-pill" key={value}><input type="radio" value={value} {...register("mainObstacle")} /><Brain size={15} /><span>{label}</span></label>)}
        </div>
        {obstacle === "other" && <div className="field-group other-field"><label htmlFor="customObstacle">Describe your obstacle</label><input id="customObstacle" {...register("customObstacle")} /></div>}
        {errors.customObstacle && <p className="field-error">{errors.customObstacle.message}</p>}
      </fieldset>

      <fieldset className="onboarding-section">
        <legend><span>4</span><div><strong>Choose your difficulty</strong><small>You can succeed at every level.</small></div></legend>
        <div className="difficulty-grid">
          {difficulties.map(([value, label, description], index) => (
            <label className="difficulty-card" key={value}>
              <input type="radio" value={value} {...register("difficulty")} />
              <span className="difficulty-icon"><Gauge size={20} /></span>
              <span><strong>{label}</strong><small>{description}</small></span>
              {index === 1 && <em>Recommended</em>}
            </label>
          ))}
        </div>
      </fieldset>

      {serverError && <div className="form-error" role="alert">{serverError}</div>}
      <div className="onboarding-submit-wrap">
        <Button type="submit" disabled={isSubmitting} className="onboarding-submit">
          {isSubmitting ? <InlineLoader label={isDemo ? "Opening demo campaign..." : "Forging your campaign..."} /> : <><Sparkles size={17} /> {isDemo ? "Enter the seeded campaign" : "Forge my campaign"}</>}
        </Button>
        <small>{isDemo ? "No external API call is made in the seeded demo." : "GPT-5.6 will shape seven practical quests around your answers."}</small>
      </div>
    </form>
  );
}
