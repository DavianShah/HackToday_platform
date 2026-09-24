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
    {/* Bridging trusses, inset vents and asymmetrical communications spine. */}
    {[-1, 1].map(side => <group key={`array-${side}`}>
      <mesh position={[side * 1.15, -.8, -.25]} rotation={[0, 0, side * .3]} scale={[2, .18, .3]}><boxGeometry /><meshStandardMaterial color={config.colors.plate} metalness={.8} roughness={.4} /></mesh>
      <mesh position={[side * 2.65, .1, -.2]} rotation={[0, 0, side * -.23]} scale={[.22, 3.5, .7]}><boxGeometry /><meshStandardMaterial color={config.colors.plate} metalness={.7} roughness={.4} /></mesh>
      {[0, 1, 2, 3, 4].map(i => <group key={i} position={[side * 2.25, 1 - i * .48, .24]}>
        <mesh scale={[.8, .12, .42]} rotation={[0, side * .2, 0]}><boxGeometry /><meshStandardMaterial color={config.colors.recess} metalness={.6} roughness={.5} /></mesh>
        <mesh position={[0, 0, .23]} scale={[.34, .035, .04]}><boxGeometry /><meshBasicMaterial color={config.colors.cyan} /></mesh>
      </group>)}
      <mesh position={[side * .9, -1.7, -.3]} rotation={[0, 0, side * .6]} scale={[.35, 1.5, .6]}><coneGeometry args={[1, 1, 4]} /><meshStandardMaterial color={config.colors.plate} metalness={.65} roughness={.4} /></mesh>
    </group>)}
    {[0, 1, 2].map(i => <group key={`spine-${i}`} position={[-.6 + i * .38, 1.65 + i * .15, -.15]}>
      <mesh scale={[.065, 1 + i * .4, .065]}><boxGeometry /><meshStandardMaterial color={config.colors.plate} /></mesh>
      <mesh position={[0, .45 + i * .2, 0]} scale={[.2, .035, .24]}><boxGeometry /><meshBasicMaterial color={config.colors.cyan} /></mesh>
    </group>)}
    {[1.05, 1.3].map((radius, i) => <mesh key={radius} position={[0, 0, .4 - i * .2]} rotation={[.2, -.2, 0]}>
      <torusGeometry args={[radius, .065, 6, 48, Math.PI * 1.7]} /><meshStandardMaterial color={config.colors.plate} metalness={.85} roughness={.3} />
    </mesh>)}
    {Array.from({ length: 12 }, (_, i) => <mesh key={`core-${i}`} position={[Math.cos(i * Math.PI / 6) * .82, Math.sin(i * Math.PI / 6) * .82, .72]} rotation={[0, 0, i * Math.PI / 6]} scale={[.17, .045, .1]}>
      <boxGeometry /><meshBasicMaterial color={i % 3 ? glow : config.colors.recess} />
    </mesh>)}
  </group>
}
