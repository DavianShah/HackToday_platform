# Live Speedrun broadcast: visual and audio swaps

The active route renders `src/components/live/LiveScoreboardStage.tsx`, which
adapts API state for `src/components/live/galactic/GalacticScene.tsx`. The
scoreboard, polling, freeze, and event queue stay in the existing hooks. Change
visual files below without changing those data contracts.

| Element | Edit or replace |
| --- | --- |
| Boss model and materials | `src/components/live/galactic/BossVisual.tsx`; keep its `BossVisualProps` interface. |
| Team ship model | `src/components/live/galactic/TeamFleet.tsx` (`TeamShipVisual`); keep the `id` and `accent` props. Identity and lane assignment live in `teamSlots.ts`. |
| Stars, debris, and lights | `src/components/live/galactic/GalacticScene.tsx` (`Atmosphere` and lights); CSS nebula layers live in `src/styles/GalacticCommand.module.css`. |
| Camera, palette, quality, orbit, FX | `src/components/live/galactic/sceneConfig.ts`; attack timing and deduplication live in `sceneEvents.ts`. |
| Category icons | The existing `useChallengeCategoryLabelMap` in `src/utils/Shared.tsx` is the sole category icon mapping. The header, scan, and category strip read that map. |
| Event typography | `src/components/live/LiveAnnouncementOverlay.tsx` and `src/styles/GalacticCommand.module.css`; announcements are DOM text over the canvas. |
| Header logo | `src/assets/logo.png` is imported by `src/components/live/LiveTopHud.tsx`. Preserve the event title and centered timer when changing placement. |
| Sound samples | Defaults are mapped in `src/components/live/stageSoundPack.ts` to `src/assets/audio/live-scoreboard/`. Admin sound overrides and volume are handled by `src/hooks/useStageSound.ts`. |

First Blood lasts 7.6 seconds: acquire (0–1), approach (1–2.5), impact (2.9),
recognition (3.2–5.5), and return (5.5–7.6). Edit `firstBloodTiming` in
`sceneEvents.ts` to move the shared visual and procedural audio cues together.
Browser sound still requires a click on **Enable sound**. Custom First Blood
audio starts at impact. The live feed does not supply wrong submissions, so
that attack is available only in the admin preview.

Use `pnpm check`, `pnpm test:live-events`, `pnpm test:galactic`, and `pnpm build`
from this ClientApp directory after changes. The browser fixture at
`tests/galactic-preview.html` covers the desktop broadcast and WebGL fallback.
