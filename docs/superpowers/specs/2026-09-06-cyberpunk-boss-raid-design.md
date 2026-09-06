# ITFest CTF — Cyberpunk Boss Raid Live Scoreboard

## Status

Approved concept direction; pending implementation planning.

## Goal

Redesign the live Speedrun scoreboard presentation so the audience feels like they are watching multiple teams raid one cybernetic boss, while preserving the existing scoreboard as the only source of truth for scores, ranks, challenge state, and live data.

The feature is a presentation layer only. It must not introduce a second scoring system, boss state in the backend, new persistence, or changes to existing game rules.

## Experience principles

- The scoreboard remains immediately readable: team, rank, score, solve count when available, timer, and event status are always accessible.
- Every attack is caused by a real observed scoreboard change. There are no random attacks or fabricated progress.
- Animation enhances an update but never gates rendering, polling, or ranking updates.
- The visual language is a 2D cyberpunk boss fight: side-view arena, combat units, one massive boss, tactical HUD, restrained neon, and occasional glitch accents.
- Unit type is cosmetic only. It does not influence score, ranking, damage, or challenge rules.
- Existing loading, error, disabled, frozen, reduced-motion, and mobile behavior remain usable.

## Existing integration surface

The redesign should be scoped to the existing live presentation layer:

- `src/GZCTF/ClientApp/src/pages/games/[id]/live.tsx`
- `src/GZCTF/ClientApp/src/components/live/LiveScoreboardStage.tsx`
- `src/GZCTF/ClientApp/src/components/live/LiveTopHud.tsx`
- `src/GZCTF/ClientApp/src/components/live/LiveScoreboardPanel.tsx`
- `src/GZCTF/ClientApp/src/components/live/LiveEventStream.tsx`
- `src/GZCTF/ClientApp/src/components/live/LiveCenterArena.tsx`
- `src/GZCTF/ClientApp/src/components/live/LiveCategoryPool.tsx`
- `src/GZCTF/ClientApp/src/styles/pages/LiveScoreboard.module.css`

The existing `useLiveState`, `useLivePresentation`, API models, routes, SWR/polling behavior, backend controllers, database models, scoring logic, challenge logic, authentication, authorization, and data schema are out of scope.

## Screen composition

The stage is a 2D side-view arena with three functional zones:

1. A tactical top HUD containing the ITFest identity, live status, round timer, current event/round state, and optional subtitle.
2. A central combat arena containing the boss on the right, combat units on the left, attack lanes/projectiles, impact effects, and a compact boss status meter.
3. Supporting panels containing the event feed on the left, readable standings on the right, and the existing category/status strip along the bottom.

The leaderboard remains a stable list. Combat units may animate from their lane toward the boss, but team positions must not be tied to rank positions. Rank changes are communicated with explicit movement indicators such as `↑ #3 → #1` or `↓ #1 → #2`.

## Visual system

- Base: near-black blue-gray environment with subtle depth bands and a side-view industrial arena silhouette.
- Primary accent: electric cyan for active state, normal attacks, live status, and positive score updates.
- Secondary accents: magenta/violet for special attacks, amber/gold for first place and major milestones, coral/red for critical boss state, blood events, and urgent timer state.
- Typography: retain the existing readable sans-serif system and use a compact tactical label treatment for metadata. Large display text is reserved for timer, boss state, and high-impact announcements.
- Glitch: used briefly on transitions, boss hits, and phase changes only; never as a persistent noisy overlay.
- Boss: one visually dominant cybernetic entity on the right with idle, alert, enraged, critical, and defeated variants.
- Units: a small set of reusable 2D silhouettes or CSS/SVG-like shapes representing assault mech, combat drone, and hovercraft. Unit assignment is deterministic from team identity so it does not change between renders.

## Data-to-visual behavior

The visual layer compares the previous live state to the next live state and derives transient presentation events. It does not mutate the source state.

### Team score change

When a team score increases:

1. Identify the team and score delta.
2. Select an attack tier from the challenge/event context when available; otherwise use a safe basic attack.
3. Animate that team's unit along its lane toward the boss.
4. Show a projectile or impact effect and floating `+score` delta.
5. Briefly highlight the corresponding leaderboard row.
6. Render the new score and rank from the latest scoreboard response.

If the score does not change, no attack is played.

### Attack tiers

- Easy/basic solve: small cyan projectile.
- Medium solve: faster or paired projectile.
- Hard solve: heavy projectile with a larger impact.
- Very hard or major event: special attack with a short, controlled screen effect.

Difficulty is only an animation selector. It never changes the actual score or derived boss progress.

### Rank change

Compare a team's previous and current rank. If the rank changed, show a short inline movement badge and a restrained row transition. Do not physically reorder combat units as a consequence of ranking.

### Boss progress

Boss progress is a client-side visual derivation from existing scoreboard data. The implementation must define one deterministic normalization function using the current competition scoreboard state and document it in code. No boss HP value is sent to or stored by the backend.

The boss visual phases are:

| Progress | Phase | Visual treatment |
| --- | --- | --- |
| 100–75% | Normal | Stable idle animation, cool cyan environment |
| 75–50% | Alert | Warning accents, stronger eye/core glow, more active HUD indicator |
| 50–25% | Enraged | Coral/magenta accents, faster idle motion, denser impact feedback |
| 25–0% | Critical | Flicker, warning state, restrained arena instability |
| Defeated | Defeated | Stop attacks, critical hold, light screen shake, explosion/override sequence, final ranking |

The exact progress normalization must avoid implying that the user can affect a separate HP system. It should be presented as `raid progress` or `boss integrity` derived from the current scoreboard, not as a persisted game mechanic.

## Boss defeat sequence

When the derived progress reaches the defeated threshold:

1. Stop new attack playback.
2. Hold the boss in a critical state.
3. Play a short, reduced-intensity screen shake and impact sequence.
4. Transition the arena to a defeated state.
5. Show `SYSTEM OVERRIDE` and `BOSS DEFEATED`.
6. Reveal the final ranking using the latest scoreboard data.

If the live data later changes or the state is reset, the presentation must recover without requiring a page reload.

## Failure and fallback behavior

- No live state: retain the existing connecting/loading fallback.
- Unsupported game mode or disabled live scoreboard: retain the existing unavailable/disabled fallback.
- API error: preserve the existing usable error behavior and do not leave a blocking animation layer over it.
- Missing team metadata or asset: use a generic unit silhouette and team-color accent.
- Missing difficulty/event context: use the basic attack tier.
- Animation/rendering failure: standings and HUD continue to render from the latest live state.
- Frozen scoreboard: hide sensitive values according to existing behavior; do not reveal them through floating deltas or attack text.
- Reduced motion: disable travel, shake, flicker, and repeated pulses while keeping state changes visible through color, labels, and static impact markers.

## Accessibility and responsiveness

- Maintain visible keyboard focus for controls.
- Preserve text contrast for all team, score, rank, and timer values.
- Never communicate rank or state by color alone.
- Keep the leaderboard readable at the existing supported wide-screen sizes.
- Provide a compact layout for narrower screens: preserve HUD, current boss state, and standings; reduce or hide decorative arena elements before hiding functional information.
- Use `aria-live` only for meaningful scoreboard events, with throttling to avoid announcing every animation detail.

## Verification criteria

- A score increase causes one corresponding visual attack and no attack occurs during unchanged polling cycles.
- The rendered team score and rank always match the latest scoreboard response.
- Rank movement is visible without changing combat-unit lane identity.
- The boss phase is deterministic for the same scoreboard state.
- Frozen values remain concealed in all HUD, event, animation, and defeat states.
- Existing live route, polling, data hooks, loading state, error state, and game-mode guards remain intact.
- The UI remains functional with reduced motion enabled and when decorative visual assets fail.
- Existing relevant tests pass, and new pure derivation/event-mapping tests cover score delta, rank delta, unchanged state, missing metadata, frozen state, and defeat transition.

## Explicit non-goals

- No backend/API/database changes.
- No new scoring, HP, damage, or challenge mechanics.
- No authentication or authorization changes.
- No random attacks, fake solves, or fabricated ranking changes.
- No requirement for a game engine or external asset pipeline.
- No replacement of the existing normal scoreboard route.
