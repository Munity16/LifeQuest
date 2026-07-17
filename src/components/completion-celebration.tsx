"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Crown, Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompletionResult } from "@/lib/types";

export function CompletionCelebration({ result, onContinue }: { result: CompletionResult; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div className="celebration-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <motion.div className="celebration-card" initial={reduceMotion ? undefined : { opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 22 }}>
        <div className="celebration-burst" aria-hidden="true"><Sparkles size={34} /></div>
        <span className="eyebrow">Quest complete</span>
        <h2 id="victory-title">Victory is yours.</h2>
        <p>{result.reason}</p>
        <div className="reward-grid">
          <div><Zap size={19} /><strong>+{result.xpAwarded}</strong><span>XP earned</span></div>
          <div><Shield size={19} /><strong>-{result.enemyDamage}</strong><span>Enemy HP</span></div>
          <div><Crown size={19} /><strong>{result.currentLevel}</strong><span>Hero level</span></div>
        </div>
        {result.levelledUp && <div className="level-up"><Crown size={16} /> Level up! A stronger path opens before you.</div>}
        {result.adaptiveQuestCreated && <div className="adaptive-note"><Sparkles size={15} /> A new adaptive quest has appeared.</div>}
        <Button onClick={onContinue}>Continue adventure <ArrowRight size={17} /></Button>
      </motion.div>
    </motion.div>
  );
}
