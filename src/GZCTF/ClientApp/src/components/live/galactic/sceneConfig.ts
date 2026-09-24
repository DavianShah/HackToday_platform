/** Original procedural assets. Replace visual components without changing event/data adapters. */
export const sceneConfig = {
  colors: { hull: '#293746', plate: '#576575', recess: '#0b1420', cyan: '#8ce3e7', amber: '#eab66b', danger: '#e56860' },
  camera: { fov: 38, z: 24, safeWidth: .54, worldWidth: 17, worldHeight: 13 },
  quality: { dpr: 1.5, stars: 650, sparks: 24 },
  orbit: { speed: .045, radius: 6.4, height: 3.3, transition: 1.2 },
  timing: { firstBlood: 8, impact: 4.65, solve: 1.5, spin: 6.5, recovery: 1.2 },
  // Optional component slots live on GalacticScene; undefined uses these original meshes.
  assets: { boss: 'BossVisual', ship: 'TeamShipVisual', effects: 'EventVFX', sound: '../stageSoundPack.ts' },
} as const
