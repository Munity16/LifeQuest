"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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

function StepHeading({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <>
      <legend className="onboarding-legend-sr">Step {step}: {title}. {subtitle}</legend>
      <div className="onboarding-section-heading">
        <span aria-hidden="true">{step}</span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
    </>
  );
}

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
  const dailyMinutes = useWatch({ control, name: "dailyMinutes" });
  const difficulty = useWatch({ control, name: "difficulty" });
  const customObstacle = useWatch({ control, name: "customObstacle" });
  const obstaclePreview = obstacle === "other"
    ? customObstacle?.trim() || "Custom obstacle"
    : obstacles.find(([value]) => value === obstacle)?.[1] || "Choose an obstacle";
  const difficultyPreview = difficulties.find(([value]) => value === difficulty)?.[1] || "Choose difficulty";

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
      <nav className="onboarding-step-nav" aria-label="Campaign setup steps">
        <a href="#goal-step"><span>1</span> Goal</a>
        <a href="#pace-step"><span>2</span> Pace</a>
        <a href="#obstacle-step"><span>3</span> Nemesis</a>
        <a href="#difficulty-step"><span>4</span> Difficulty</a>
      </nav>
      <div className="onboarding-loadout" aria-live="polite">
        <strong>Campaign preview</strong>
        <span><Clock3 size={14} aria-hidden="true" /> {dailyMinutes || 30} min/day</span>
        <span><Brain size={14} aria-hidden="true" /> {obstaclePreview}</span>
        <span><Gauge size={14} aria-hidden="true" /> {difficultyPreview}</span>
      </div>
      {isDemo && <div className="demo-notice"><Sparkles size={16} /><span>Demo mode uses the pre-generated Python campaign for presentation reliability.</span></div>}
      <fieldset className="onboarding-section onboarding-goal" id="goal-step">
        <StepHeading step={1} title="Choose your destination" subtitle="What do you want to achieve?" />
        <div className="onboarding-section-body">
          <label className="sr-only" htmlFor="goal">Your goal</label>
          <textarea id="goal" rows={3} maxLength={240} {...register("goal")} aria-invalid={Boolean(errors.goal)} />
          <div className="field-helper"><span>Example: Learn Python fundamentals in seven days.</span><span>{goal?.length || 0}/240</span></div>
          {errors.goal && <p className="field-error">{errors.goal.message}</p>}
        </div>
      </fieldset>

      <fieldset className="onboarding-section" id="pace-step">
        <StepHeading step={2} title="Set your daily pace" subtitle="How much focused time can you protect?" />
        <div className="onboarding-section-body">
          <Controller
            control={control}
            name="dailyMinutes"
            render={({ field }) => (
              <div className="choice-grid time-grid">
                {times.map((time) => (
                  <label className="choice-card" key={time}>
                    <input
                      ref={field.ref}
                      name={field.name}
                      type="radio"
                      value={time}
                      aria-label={`${time} minutes`}
                      checked={field.value === time}
                      onBlur={field.onBlur}
                      onChange={() => field.onChange(time)}
                    />
                    <Clock3 size={19} />
                    <strong>{time}</strong>
                    <small>minutes</small>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.dailyMinutes && <p className="field-error">{errors.dailyMinutes.message}</p>}
        </div>
      </fieldset>

      <fieldset className="onboarding-section" id="obstacle-step">
        <StepHeading step={3} title="Name your nemesis" subtitle="What most often blocks your progress?" />
        <div className="onboarding-section-body">
          <div className="choice-grid obstacle-grid">
            {obstacles.map(([value, label]) => <label className="choice-pill" key={value}><input type="radio" value={value} {...register("mainObstacle")} /><Brain size={15} /><span>{label}</span></label>)}
          </div>
          {obstacle === "other" && <div className="field-group other-field"><label htmlFor="customObstacle">Describe your obstacle</label><input id="customObstacle" {...register("customObstacle")} /></div>}
          {errors.customObstacle && <p className="field-error">{errors.customObstacle.message}</p>}
        </div>
      </fieldset>

      <fieldset className="onboarding-section" id="difficulty-step">
        <StepHeading step={4} title="Choose your difficulty" subtitle="You can succeed at every level." />
        <div className="onboarding-section-body">
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
