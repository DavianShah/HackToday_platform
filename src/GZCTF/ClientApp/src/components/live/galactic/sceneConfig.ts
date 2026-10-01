/** Original procedural assets. Replace visual components without changing event/data adapters. */
import { attackTimeline } from './sceneEvents'
export const sceneConfig = {
  colors: {
    hull: '#293746',
    plate: '#576575',
    recess: '#0b1420',
    cyan: '#8ce3e7',
    amber: '#eab66b',
    danger: '#e56860',
  },
  // Level broadcast camera; world fills the middle while the HUD wings remain transparent.
  camera: { fov: 42, x: 0, y: 1.1, z: 20, safeWidth: 0.58, worldWidth: 14.5, worldHeight: 10.5 },
  quality: { dpr: 1.5, stars: 650, sparks: 24, calmDpr: 1, calmStars: 240 },
  orbit: { speed: 0.045, radius: 6.4, height: 3.3, transition: 1.2 },
  // One clock governs every strike, including preview deflections.
  timing: {
    firstBlood: attackTimeline.duration,
    attack: attackTimeline.duration,
    impact: attackTimeline.impact,
    recognition: attackTimeline.recognition,
    return: attackTimeline.return,
    spin: 6.5,
    recovery: 1.2,
  },
  // Optional component slots live on GalacticScene; undefined uses these original meshes.
  assets: { boss: 'BossVisual', ship: 'TeamShipVisual', effects: 'EventVFX', sound: '../stageSoundPack.ts' },
} as const
