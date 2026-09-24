import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { sceneConfig as config } from './sceneConfig'

export interface BossVisualProps { reducedMotion: boolean; overtime?: boolean }

/** Split-citadel silhouette: two armored bastions around a suspended axial reactor. */
export function BossVisual({ reducedMotion, overtime }: BossVisualProps) {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!root.current) return
    root.current.rotation.y = reducedMotion ? .12 : .12 + Math.sin(clock.elapsedTime * .16) * .1
    root.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * .4) * .08
  })
  const glow = overtime ? config.colors.danger : config.colors.amber
  return <group ref={root} rotation={[.16, .12, -.08]}>
    <mesh scale={[1.1, 1.45, .7]}><octahedronGeometry args={[1.2, 0]} /><meshStandardMaterial color={config.colors.hull} metalness={.7} roughness={.36} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 1.6, 0, 0]} rotation={[0, 0, side * -.18]}>
      <mesh scale={[1.05, 2.8, .85]}><boxGeometry /><meshStandardMaterial color={config.colors.hull} metalness={.65} roughness={.4} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 1.1 - i * .7, .52]} rotation={[.2, 0, 0]} scale={[1.3, .54, .36]}>
        <boxGeometry /><meshStandardMaterial color={config.colors.plate} metalness={.7} roughness={.38} />
      </mesh>)}
      <mesh position={[side * .5, .1, .6]} scale={[.035, 2.6, .05]}><boxGeometry /><meshBasicMaterial color={glow} /></mesh>
    </group>)}
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.92, .16, 8, 48]} /><meshStandardMaterial color={config.colors.plate} metalness={.8} roughness={.3} /></mesh>
    <mesh position={[0, 0, .85]}><torusGeometry args={[.63, .045, 8, 48]} /><meshBasicMaterial color={glow} /></mesh>
    <mesh position={[0, 0, .75]} scale={[.45, .45, .3]}><icosahedronGeometry /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2} /></mesh>
  </group>
}
