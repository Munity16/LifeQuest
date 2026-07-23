# LifeQuest Storybook Fantasy art direction

## Intent

The visual balance is 70% calm productivity interface and 30% illustrated fantasy atmosphere: mature, hopeful, premium, readable, and original. Avoid copying existing game interfaces or named animation studios.

## Core palette

| Token | Value | Use |
| --- | --- | --- |
| Midnight Navy | `#0B1020` | page background |
| Deep Indigo | `#151A32` | deep surfaces |
| Night Violet | `#252044` | elevated panels |
| Dark Slate | `#1B2034` | utility surfaces |
| Parchment Light | `#F3E9D2` | high-emphasis text/cards |
| Parchment Dark | `#D7C39A` | muted parchment |
| Antique Gold | `#D6AE5D` | restrained highlights |
| Quest Violet | `#8A78E8` | interactive quest state |
| Victory Emerald | `#62C48D` | success |
| Warning Amber | `#D79A4C` | caution |
| Enemy Crimson | `#C45B68` | enemy and error state |

Every combination must be contrast-tested. Serif is reserved for campaign, act, boss, and victory headings; instructions and data use a clean sans-serif.

## Asset conventions

Use lowercase kebab-case:

- `hero-{archetype}-{pose}.webp`
- `enemy-{obstacle}-{phase}.webp`
- `environment-act-{number}-{location}.webp`

Source masters should be lossless and external to the production bundle. Deliver WebP/AVIF derivatives:

| Asset | Master ratio | Suggested delivery |
| --- | --- | --- |
| Portrait | 1:1 | 512×512 |
| Compact avatar | 1:1 | 128×128 |
| Full body / pose | 4:5 | 1024×1280 |
| Environment | 16:9 | 1920×1080 plus mobile 4:5 crop |
| Card atmosphere | 3:2 | 1200×800 |

Keep faces, weapons, and focal silhouettes inside the central 60% safe area for mobile crops. Transparent poses need clean alpha edges and no baked UI frames.

## Required inventory

Heroes: Scholar, Knight, Mage, Ranger, Rogue. Each eventually needs profile, compact, full-body, victory, recovery, level-up, and transparent variants.

Enemies:

- Procrastination — sleeping shadow blocking a road
- Distraction — many-eyed illusion creature
- Overwhelm — giant of tangled scrolls
- Perfectionism — cracked golden-mask spirit
- Self-doubt — whispering mirror spirit
- Inconsistency — flickering shapeshifter

Environments:

- Act I: village gate, academy entrance, workshop, forest trailhead
- Act II: ancient road, puzzle ruins, mountain path, enchanted library
- Act III: storm bridge, boss fortress, summit, sunrise victory

## Accessibility and placeholders

Meaningful images receive concise alt text describing function and subject, not visual style. Decorative atmosphere uses empty alt text. Never put essential instructions inside an image. Neutral gradient/crest placeholders must preserve layout and contrast when artwork is absent.

Motion is subtle (node glow, XP fill, damage, act unlock, victory) and fully disabled by reduced-motion preferences.
