# Galactic Siege — HackToday 2026 Final

Only the Speedrun live broadcast and its existing admin simulator are redesigned. The visible event title is **HackToday 2026 Final**. No event logo or external model/texture/font is required by the scene. Existing platform copyright, restricted components, routes, backend and generated API remain intact.

## Architecture and composition

`pages/games/[id]/live.tsx` → `useLiveState` → `LiveScoreboardStage` → `useLivePresentation` / `useLiveEventQueue` → `galactic/useSceneDirector` → `GalacticScene` and DOM HUD.

The actual route still calls `GET /api/game/{id}/live` every two seconds, with a one-second local timer. The game title stays in the response model. `GameController.LiveScoreboard` currently projects every item in the returned scoreboard into `topTeams` (there is no frontend assumption that this represents every tournament participant). The fleet represents valid unique IDs in that payload; the standings panel shows its first ten entries, preserving server ranks. No component fetches independently or calculates competition ranks.

One lazy-loaded R3F Canvas covers the full `100vh` / `100dvh` stage, including behind both translucent panels. A separate HTML overlay uses `20% 60% 20%`; equal margins and matching headers make both side panels identical in size. The perspective camera fits a conservative 54% horizontal envelope inside the central 60%. Header and category ribbon reserve vertical space. Data, timer, callouts and announcements remain DOM text. First Blood typography is bounded to the central region and never covers standings or the clock.

## Files and replacement points

All paths below are relative to `src/GZCTF/ClientApp/`.

| File | Purpose / safe replacement |
| --- | --- |
| `src/components/live/galactic/sceneConfig.ts` | Camera envelope, palette, orbit speed, DPR/star/particle caps, motion timings and asset references. |
| `galactic/BossVisual.tsx` (under the same live component directory) | Original split-citadel fortress, beveled armor, reactor, service panels and asymmetric communications arrays. Swap the `Boss` component slot on `GalacticScene`; keep its origin centered and bounds approximately x ±3.2, y ±3, z ±1. |
| `galactic/TeamFleet.tsx` | Original deterministic ship variants. Swap the `Ship` component slot, accepting `{ id, accent }`. Keep the local craft about one world unit wide, with its nose along local -Y; the fleet owns position and scale. |
| `galactic/teamSlots.ts` | Pure identity validation, persistent occupied lanes, golden-angle placement and entry/exit reconciliation. Never derive lanes from current rank. |
| `galactic/sceneEvents.ts`, `useSceneDirector.ts` | Narrow typed event adapter and bounded foreground visual scheduler. Visual scheduling does not change the real event feed or scoring. |
| `galactic/EventVFX.tsx`, `SectorWheel.tsx` | Replaceable procedural beams, charge, transmission, impact rings, bounded sparks and sector scan. |
| `src/styles/GalacticCommand.module.css` | HUD color/type/spacing/opacity/easing tokens and desktop composition. No legacy Cyberpunk or Colosseum stylesheet is mounted. |
| `src/components/live/Live*.tsx` | Broadcast title/timer, recent events, standings, category ribbon, center readout and announcements. |
| `src/hooks/useLivePresentation.ts`, `useLiveEventQueue.ts`, `useStageSound.ts` | Existing presentation pipeline with targeted StrictMode, freeze, lifecycle and audio cleanup fixes. |
| `src/hooks/useLivePreviewState.ts`, `src/pages/admin/games/[id]/live-scoreboard-preview.tsx` | Existing authenticated simulation; added simultaneous solves and late-entry controls, and expanded showcase. |

To use a legally owned `.glb`, add it locally and implement a component with the corresponding visual props, passing it through the `Boss` or `Ship` slot. Keep loading inside a Suspense/error boundary with the procedural component as the fallback. Undefined slots use the built-in meshes. No optional external asset is fetched by default. Three/R3F disposes the original geometries/materials on unmount; custom cached GLTF resources must follow their loader's disposal ownership.

The scene uses procedural geometry and point attributes, with no new binary assets. `stageSoundPack.ts` retains existing local sounds and admin URL overrides. First Blood defaults to original Web Audio synthesis in `useStageSound.ts`, charging toward a 4.65-second impact and tonal resolve. A custom `sounds.firstBlood` URL takes precedence; author its climax near that offset. Browser sound must be explicitly enabled; `soundEnabled`, clamped volume and overrides remain authoritative. Freeze, disable and unmount stop active media/oscillators, and delayed failures cannot restart a frozen sound. Existing project sound-generation provenance is in `tools/generate_ocean_stage_sounds.py`.

## Real event mapping

| Source | Visual behavior |
| --- | --- |
| Standby / unchanged polling | Calm fortress/reactor drift and persistent ship orbits; no attacks. |
| Existing `spinPhase` | 6.5-second decelerating segmented 3D sector wheel, with the selected category concealed until reveal. Only the real category is revealed. |
| Category / start | Projection lock and short ignition/energy sweep; round lifecycle stays server-controlled. |
| Positive ordinary delta | Actual delta only; one team approaches, charges and fires, with a named callout and matching row highlight. Pending same-team deltas coalesce; at most 12 visual effects wait. |
| Active queued First Blood | Actual participant craft (or a neutral incoming craft for an absent ID), charge, impact at 4.65 seconds, sparks/shockwave, camera recovery by 8 seconds. The existing visible popup starts at 5 seconds; queue duration remains 8.6 seconds. |
| Second / third blood | Shorter silver / copper attacks; no duplicate ordinary attack from that poll. |
| Hint | Intercepted hologram and the actual event message; no invented hint content. |
| Rank changes | Server rank/movement text and craft highlight; orbit lane is unchanged. |
| Reminder / countdown / overtime | Restrained core/ring tension, real timer and status; overtime changes reactor warning color. |
| Round finished / cancelled / changed | Bounded decompression or neutral pose, stale foreground/pending work cleared. No tournament-winner or boss-health fiction. |
| Freeze / unfreeze | Teams, feed and sensitive transient effects are hidden immediately; audio stops. Unfreeze establishes fresh score/event baselines and does not replay concealed changes. |
| Wrong submission | **Preview-only.** The existing live endpoint publishes notices, not every wrong submission. Only the simulator's injected `wrong` announcement produces a deflected beam. No API, backend or scoring change was added. |

The existing priority order (including hint before First Blood) is retained. Presentation backlog is bounded at 32 by removing the lowest-priority queued presentation when needed; the real recent-events feed is independent. Event activation does not mutate a queue inside a React state updater, so StrictMode cannot accidentally consume an event twice. Enabling sound does not restart the active event.

## Performance and accessibility

- Default DPR is capped at 1.5, with 650 point stars and at most 24 sparks. No bloom, shadow maps, remote textures or postprocessing passes.
- Existing `visualIntensity: Calm` caps DPR at 1, uses 240 stars and simplifies attack effects. `Normal` and `Hype` retain the bounded broadcast effects.
- Reduced motion stops orbit travel, camera drift/pursuit, scan rotation and CSS loops; score/status/announcement meaning remains visible. This responds to preference changes without reloading.
- `useFrame` updates transforms/materials, not React state. Vector/pose temporaries are reused; scene effects are serialized. Absent/duplicate/nonpositive/invalid team IDs do not create misleading craft identities.
- WebGL creation failure or context loss shows a CSS fortress fallback while the independent DOM timer and standings keep updating. A reload retries WebGL.
- No health bars, category-as-completion inference, fake events, client-calculated ranks or tournament victory messages.

## Preview and verification

1. From `src/GZCTF/ClientApp`, run `pnpm dev` and open `/admin/games/<id>/live-scoreboard-preview` with an existing admin session. Hide the control deck for the full broadcast view. Use **Play sequence**, then individual simultaneous solve, new team and freeze controls.
2. The production live path remains `/games/<id>/live`. Enable it through the existing admin configuration. Simulation does not change live API behavior.
3. Automated checks: `pnpm check`, `pnpm test:live-events`, `pnpm test:galactic`, `pnpm test:challenge-modal`, `pnpm build`.
4. Browser harness: start Chrome headless with `--remote-debugging-port=9226`, an isolated profile and `--enable-unsafe-swiftshader` if needed for headless WebGL, then run `pnpm test:galactic-browser` while Vite serves port 63000. The test-only entry `tests/galactic-preview.html` is outside production routes/build entries. It uses the same simulator/stage in StrictMode; `?live` mounts the actual live route with CDP-controlled HTTP responses. Screenshot artifacts go to ignored `node_modules/.galactic-qa/`.

The browser suite asserts equal panels, no page overflow and one canvas at 1920×1080, 2560×1440 and 1366×768; spin concealment, real solve deltas, delayed First Blood popup, live timer, secondary events, serial solves, late entries, freeze/unfreeze, lifecycle, reduced motion, Calm DPR, CPU throttling, live-route polling and context-loss fallback. Controlled responses validate frontend integration, not a deployed backend or authenticated production session. Before broadcast, also audition speakers/custom audio, inspect the authenticated preview and actual live game, and measure FPS on the intended display GPU.

### Validation recorded for this implementation

- TypeScript strict check, five event-queue tests, seven scene tests, two existing challenge-modal tests and production build passed. The production build retains upstream SignalR pure-annotation and plugin-timing warnings. An initial sandbox build could not fetch existing project fonts/contributors; the network-enabled build fetched them successfully.
- Chrome headless: the complete browser suite passed without uncaught runtime exceptions. At 1366×768, both panel interiors measured 251×602 pixels; at 1920×1080, 354×888; at 2560×1440, 482×1240. The page dimensions matched each viewport with exactly one canvas.
- The real live-route harness observed seven requests during its polling/freeze checks and verified that timers keep changing without replaying historical score changes.
- `node tests/galactic-audio-browser.mjs` separately checks explicit unlock, six original First Blood synth voices, no replay on a second enable click, freeze cancellation, a custom local sound URL at volume 0.17, admin-disabled sound, and invalid/missing optional team/event values. This verifies playback plumbing, not perceived speaker quality.
- An idle 1366×768/DPR-1 sample reported 164 draw calls, 5,040 triangles and 650 star points; a two-second browser sample observed 121 animation frames in 2,014 ms. This is a short headless-machine observation, not a target-hardware FPS guarantee. Repeated hull/ship meshes dominate draw calls; reduce model detail or instance repeated modules first if the intended GPU needs more headroom.
