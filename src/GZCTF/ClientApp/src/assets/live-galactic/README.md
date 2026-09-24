# Galactic live assets

All artwork in this folder is original, lightweight SVG created for the HackToday 2026 Final Speedrun live scoreboard. It does not contain third-party film, franchise, sponsor, or event-logo artwork.

- `orbital-core.svg` is the central holographic sector map. Replace it with another transparent SVG using the same square view box to preserve the layout.
- `sector-marker.svg` is the generic category-node ornament used by the sector strip and arena.
- Global color, spacing, glow, and motion values live at the top of `src/styles/GalacticCommand.module.css`.
- Stars, nebula, scanlines, radar sweeps, and energy pings are procedural CSS; there are no external image requests.
- Sound remains managed by `useStageSound.ts` and the existing live-scoreboard configuration. No audio asset is defined here.

The stage uses a `100vh` fallback followed by `100dvh`. Desktop panels stay inside the fixed broadcast shell, while mobile content scrolls inside the shell below the persistent timer. Motion has a `prefers-reduced-motion` fallback in the same CSS module.

Keep replacement art abstract and locally hosted. Do not introduce event logos, franchise imagery, hotlinks, or a second event identity into the live stage.
