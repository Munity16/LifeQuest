# LifeQuest demo script

Target length: 2 minutes 30 seconds.

## Before presenting

- For the reliable seeded presentation, set `DEMO_MODE_ENABLED=true` and use “Try the seeded demo.” State clearly that the fallback is pre-generated and that its proof acceptance is simulated.
- For a real GPT-5.6 presentation, configure OpenAI and Supabase, set `DEMO_MODE_ENABLED=false`, sign in with a test account, and preflight the exact proof image.
- Never describe the seeded fallback as live AI.
- Use **Reset progress** on the campaign banner immediately before the presentation.

## 0:00–0:20 — Introduce the problem

“Big goals often fail because the next action is vague and progress feels invisible. LifeQuest turns a real goal into practical daily quests with a story, visible rewards, and proof-based progression.”

Show the landing page and select either **Start your quest** for the live path or **Try the seeded demo** for the labelled fallback.

## 0:20–0:45 — Enter the goal

On the campaign forge, use:

- Goal: “Learn Python fundamentals in seven days.”
- Daily time: 30 minutes
- Main obstacle: Procrastination
- Difficulty: Balanced

Say: “The practical constraints come first. The fantasy layer serves the work.”

Select **Forge my campaign**. In seeded mode, select **Enter the seeded campaign** and say: “This presentation fallback is pre-generated for reliability; the production path uses GPT-5.6 and the same validated data contract.”

## 0:45–1:15 — Show the campaign

Point out:

- Campaign: **The Kingdom of Python**
- Hero: **Code Apprentice**
- Nemesis: **Delay Demon**
- Level and XP bar
- Enemy health
- Available and locked quests

Say: “The campaign and quests persist in Supabase on the live path. Users can only read their own records through RLS.”

## 1:15–1:40 — Open a practical quest

Open **Forge Your First Variables**.

Show the practical objective, estimated time, XP, enemy damage, and the visible success requirements. Emphasize that a locked quest cannot accept proof.

## 1:40–2:05 — Submit proof

In seeded mode, select **Load passing proof** for a deterministic success. If time permits, first select **Load rejected proof** to show that the same flow explains every failed requirement and awards nothing.

On the live path, upload a clear screenshot showing Python variables, a print statement, and terminal output.

For the live path, say: “The private image first passes a safety screen, then GPT-5.6 returns a schema-validated assessment of every requirement.”

For seeded mode, say: “This labelled demo safeguard simulates acceptance. It is not a live AI verdict; the production route uses GPT-5.6.”

Select **Submit for verification**.

## 2:05–2:25 — Show progression

Show the completion result:

- Every requirement has a visible pass/fail explanation and a privacy-safe AI receipt.
- XP increases once.
- Enemy health falls once.
- Level updates when the XP threshold is crossed.
- An adaptive quest may appear without blocking the victory.

Return to the campaign and refresh the page. Point out that the quest remains complete and the progression remains visible.

Say: “The browser never supplies XP or damage. A service-only, row-locking PostgreSQL function applies progression atomically and makes duplicate rewards harmless.”

## 2:25–2:30 — Close

“LifeQuest makes the next action concrete, the evidence private, and the progress hard to fake. The next step is live staging validation across more goal types.”
