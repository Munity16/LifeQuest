"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Crown, Shield, Sparkles, Swords, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationDetails } from "@/components/verification-details";
import { useAppearance } from "@/components/appearance-provider";
import { HeroPortrait } from "@/components/hero-customization";
import { resolveHeroTitle } from "@/lib/customization";
import type { CompletionResult } from "@/lib/types";

export function CompletionCelebration({ result, onContinue }: { result: CompletionResult; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  const { preferences } = useAppearance();
  const rank = resolveHeroTitle(preferences.heroTitle, result.currentLevel);
  return (
    <motion.div className="celebration-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <motion.div className="celebration-card" initial={reduceMotion ? undefined : { opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 22 }}>
        <div className="victory-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
        <div className="celebration-burst" aria-hidden="true"><Sparkles size={34} /></div>
        <span className="eyebrow">Quest complete</span>
        <h2 id="victory-title">Victory is yours.</h2>
        <p>{result.reason}</p>
        <VerificationDetails result={result} collapsible />
        <div className="victory-combat-stage" aria-label={`${rank} dealt ${result.enemyDamage} damage to the enemy`}>
          <motion.figure initial={reduceMotion ? undefined : { x: -18, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <span><HeroPortrait alt="Your customized hero" size={112} /></span>
            <figcaption>{rank}</figcaption>
          </motion.figure>
          <div className="victory-impact" aria-hidden="true">
            <motion.strong initial={reduceMotion ? undefined : { y: 14, scale: 0.7, opacity: 0 }} animate={{ y: -8, scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring" }}>-{result.enemyDamage} HP</motion.strong>
            <Swords size={27} />
            <motion.span initial={reduceMotion ? undefined : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}>+{result.xpAwarded} XP</motion.span>
          </div>
          <motion.figure animate={reduceMotion ? undefined : { x: [0, 8, -5, 0], rotate: [0, 1, -1, 0] }} transition={{ delay: 0.18, duration: 0.42 }}>
            <span><Image src="/art/delay-demon.webp" alt="Delay Demon" width={112} height={112} sizes="112px" /></span>
            <figcaption>{result.enemyCurrentHealth} HP remains</figcaption>
          </motion.figure>
        </div>
        <div className="reward-grid">
          <div><Zap size={19} /><strong>+{result.xpAwarded}</strong><span>XP earned</span></div>
          <div><Shield size={19} /><strong>-{result.enemyDamage}</strong><span>Enemy HP</span></div>
          <div><Crown size={19} /><strong>{result.currentLevel}</strong><span>Hero level</span></div>
        </div>
        {result.levelledUp && <div className="level-up"><Crown size={16} /> Level up! New title: {rank}.</div>}
        {result.adaptiveQuestCreated && <div className="adaptive-note"><Sparkles size={15} /> New path unlocked: an adaptive quest has appeared.</div>}
        <Button onClick={onContinue}>Continue adventure <ArrowRight size={17} /></Button>
      </motion.div>
    </motion.div>
  );
}
