import { Check, Clock3, ShieldAlert, Sparkles, Swords, Zap } from "lucide-react";

export function DashboardPreview() {
  return (
    <div className="dashboard-preview" aria-label="LifeQuest campaign dashboard preview">
      <div className="preview-ambient preview-ambient-one" />
      <div className="preview-toolbar"><span /><span /><span /><small>THE KINGDOM OF PYTHON</small></div>
      <div className="preview-hero-row">
        <div>
          <div className="preview-kicker"><Sparkles size={12} /> ACTIVE CAMPAIGN</div>
          <h3>The Kingdom<br />of Python</h3>
          <p>You are the <strong>Code Apprentice</strong>. Reclaim seven lost runes and defeat the force of delay.</p>
        </div>
        <div className="preview-enemy">
          <ShieldAlert size={23} />
          <span>NEMESIS</span><strong>Delay Demon</strong>
          <div className="mini-health"><i /></div>
          <small>72 / 100 HP</small>
        </div>
      </div>
      <div className="preview-quests">
        {[
          ["01", "Forge Your First Variables", "15 min", "20 XP", "10 DMG"],
          ["02", "Cross the Conditional Gate", "30 min", "30 XP", "15 DMG"],
          ["03", "Break the Looping Curse", "30 min", "35 XP", "16 DMG"],
        ].map((item, index) => (
          <div className="preview-quest" key={item[0]}>
            <div><small>QUEST {item[0]}</small>{index === 0 && <span className="tiny-status"><Check size={9} /> READY</span>}</div>
            <strong>{item[1]}</strong>
            <p><span><Clock3 size={10} /> {item[2]}</span><span><Zap size={10} /> {item[3]}</span><span><Swords size={10} /> {item[4]}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
}
