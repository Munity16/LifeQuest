import { Shield, Sparkles } from "lucide-react";
import { calculateLevelProgress } from "@/lib/gameplay";

export function XPProgressBar({ totalXp, level }: { totalXp: number; level: number }) {
  const progress = calculateLevelProgress(totalXp);
  return (
    <div className="stat-block" aria-label={`Level ${level}, ${progress.current} of ${progress.required} XP to next level`}>
      <div className="stat-label-row">
        <span><Sparkles size={15} aria-hidden="true" /> Level {level}</span>
        <strong>{progress.current} / {progress.required} XP</strong>
      </div>
      <div className="progress-track progress-xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}>
        <span style={{ width: `${progress.percentage}%` }} />
      </div>
    </div>
  );
}

export function EnemyHealthBar({ current, max, name }: { current: number; max: number; name: string }) {
  const percentage = Math.round((current / Math.max(1, max)) * 100);
  return (
    <div className="stat-block" aria-label={`${name} has ${current} of ${max} health remaining`}>
      <div className="stat-label-row enemy-label">
        <span><Shield size={15} aria-hidden="true" /> Enemy health</span>
        <strong>{current} / {max} HP</strong>
      </div>
      <div className="progress-track progress-health" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={current}>
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
