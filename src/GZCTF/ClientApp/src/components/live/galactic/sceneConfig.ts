/** Original procedural assets. Replace visual components without changing event/data adapters. */
import { firstBloodTiming } from './sceneEvents'
export const sceneConfig = {
  colors: {
    hull: '#293746',
    plate: '#576575',
    recess: '#0b1420',
    cyan: '#8ce3e7',
    amber: '#eab66b',
    danger: '#e56860',
  },
  camera: { fov: 38, x: 0.65, y: 1.05, z: 24, safeWidth: 0.54, worldWidth: 17, worldHeight: 13 },
  quality: { dpr: 1.5, stars: 650, sparks: 24, calmDpr: 1, calmStars: 240 },
  orbit: { speed: 0.045, radius: 6.4, height: 3.3, transition: 1.2 },
  // First Blood: acquire 0-1, commit 1-2.5, impact 2.9, recognition 3.2-5.5, return 5.5-7.6.
  timing: {
    firstBlood: firstBloodTiming.duration,
    impact: firstBloodTiming.impact,
    recognition: firstBloodTiming.recognition,
    return: firstBloodTiming.return,
    solve: 1.5,
    spin: 6.5,
    recovery: 1.2,
  },
  // Optional component slots live on GalacticScene; undefined uses these original meshes.
  assets: { boss: 'BossVisual', ship: 'TeamShipVisual', effects: 'EventVFX', sound: '../stageSoundPack.ts' },
} as const
