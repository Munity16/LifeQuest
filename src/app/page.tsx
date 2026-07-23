import Link from "next/link";
import { ArrowRight, CheckCircle2, ImageUp, ScrollText, ShieldCheck, Sparkles, Swords, WandSparkles, Zap } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { DashboardPreview } from "@/components/dashboard-preview";
import { getAuthContext } from "@/lib/auth";
import { isDemoEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const auth = await getAuthContext();
  const signedIn = auth.kind !== "anonymous";

  return (
    <div className="site-page landing-page">
      <AppHeader publicNav />
      <main id="main-content">
        <section className="landing-hero page-shell">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={15} aria-hidden="true" /> Progress with a plot</div>
            <h1>Your goal is the <span>main quest.</span></h1>
            <p className="hero-lede">LifeQuest turns the thing you keep postponing into practical daily quests—with a hero, a nemesis, proof-based victories, and progress that persists.</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" href={signedIn ? "/onboarding" : "/signup"}>
                {signedIn ? "Forge a campaign" : "Start your quest"} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {isDemoEnabled() && <a className="button button-secondary button-large" href="/api/demo/start">Try the seeded demo</a>}
            </div>
            <ul className="hero-trust" aria-label="LifeQuest highlights">
              <li><CheckCircle2 size={15} aria-hidden="true" /> Practical tasks</li>
              <li><ShieldCheck size={15} aria-hidden="true" /> Private proof</li>
              <li><Zap size={15} aria-hidden="true" /> Persistent progress</li>
            </ul>
          </div>
          <div className="hero-preview-wrap">
            <DashboardPreview />
          </div>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="page-shell">
            <div className="section-heading">
              <span className="eyebrow"><ScrollText size={15} aria-hidden="true" /> The campaign loop</span>
              <h2 id="how-title">A clear next step, wrapped in a story worth finishing.</h2>
            </div>
            <div className="how-grid">
              <article><span className="step-icon"><WandSparkles /></span><small>01</small><h3>Name your goal</h3><p>Choose your daily time, the obstacle in your way, and the level of challenge you want.</p></article>
              <article><span className="step-icon"><Swords /></span><small>02</small><h3>Receive your campaign</h3><p>GPT-5.6 shapes the goal into seven concrete quests with a hero, enemy, rewards, and proof requirements.</p></article>
              <article><span className="step-icon"><ImageUp /></span><small>03</small><h3>Prove the victory</h3><p>Upload a private image. Accepted proof completes the quest, awards XP once, and weakens the enemy once.</p></article>
            </div>
          </div>
        </section>

        <section className="landing-cta page-shell">
          <div>
            <span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> Your next chapter</span>
            <h2>Make progress feel like an adventure.</h2>
            <p>One real goal. Seven focused quests. No leaderboard, no noise—just a path forward.</p>
          </div>
          <Link className="button button-primary button-large" href={signedIn ? "/onboarding" : "/signup"}>Begin now <ArrowRight size={18} /></Link>
        </section>
      </main>
      <footer className="site-footer"><div className="page-shell"><span>LifeQuest</span><small>Built for focused, verifiable progress. <Link href="/privacy">Privacy & proof handling</Link></small></div></footer>
    </div>
  );
}
