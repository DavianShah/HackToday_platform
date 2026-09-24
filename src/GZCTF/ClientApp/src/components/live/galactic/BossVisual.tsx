import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, MeshStandardMaterial, Shape } from 'three'
import { attackKind, eventAge, impactTime } from './EventVFX'
import { sceneConfig as config } from './sceneConfig'
import { SceneEvent } from './sceneEvents'

export interface BossVisualProps {
  reducedMotion: boolean
  overtime?: boolean
  event?: SceneEvent
}

/** Split-citadel silhouette: two armored bastions around a suspended axial reactor. */
export function BossVisual({ reducedMotion, overtime, event }: BossVisualProps) {
  const plate = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-0.5, -0.4)
    shape.lineTo(0.35, -0.5)
    shape.lineTo(0.5, -0.26)
    shape.lineTo(0.5, 0.3)
    shape.lineTo(0.25, 0.5)
    shape.lineTo(-0.5, 0.35)
    shape.closePath()
    return shape
  }, [])
  const reactor = useRef<MeshStandardMaterial>(null)
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!root.current) return
    root.current.rotation.y = reducedMotion ? 0.12 : 0.12 + Math.sin(clock.elapsedTime * 0.16) * 0.1
    const hitAge = event ? eventAge(event) - impactTime(event) : 100
    const hit =
      attackKind(event) && event?.kind !== 'wrong' && hitAge > 0 && hitAge < 1 ? Math.sin(hitAge * Math.PI) : 0
    root.current.rotation.z = -0.08 + (reducedMotion ? 0 : hit * 0.07)
    if (reactor.current)
      reactor.current.emissiveIntensity =
        1.4 +
        (reducedMotion ? 0 : Math.sin(clock.elapsedTime * (overtime ? 2 : 0.8)) * 0.3) +
        hit * 3 +
        (event?.kind === 'start' ? Math.max(0, 2 - eventAge(event)) : 0)
    root.current.scale.setScalar(1 + (reducedMotion ? 0 : hit * 0.035))
    root.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 0.08
  })
  const glow = overtime ? config.colors.danger : config.colors.amber
  return (
    <group ref={root} rotation={[0.16, 0.12, -0.08]}>
      <mesh scale={[1.1, 1.45, 0.7]}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial color={config.colors.hull} metalness={0.7} roughness={0.36} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.6, 0, 0]} rotation={[0, 0, side * -0.18]}>
          <mesh scale={[1.05, 2.8, 0.85]}>
            <boxGeometry />
            <meshStandardMaterial color={config.colors.hull} metalness={0.65} roughness={0.4} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 1.1 - i * 0.7, 0.52]} rotation={[0.2, 0, 0]} scale={[1.3, 0.54, 0.36]}>
              <extrudeGeometry
                args={[
                  plate,
                  { depth: 0.8, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.06, bevelThickness: 0.07 },
                ]}
              />
              <meshStandardMaterial color={config.colors.plate} metalness={0.7} roughness={0.38} />
            </mesh>
          ))}
          <mesh position={[side * 0.5, 0.1, 0.6]} scale={[0.035, 2.6, 0.05]}>
            <boxGeometry />
            <meshBasicMaterial color={glow} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <group key={`service-${i}`} position={[-0.18, 0.85 - i * 0.7, 0.92]}>
              <mesh scale={[0.52, 0.13, 0.035]}>
                <boxGeometry />
                <meshStandardMaterial color={config.colors.recess} roughness={0.7} />
              </mesh>
              <mesh position={[-0.18, 0, 0.025]} scale={[0.08, 0.035, 0.025]}>
                <boxGeometry />
                <meshBasicMaterial color={config.colors.cyan} />
              </mesh>
              <mesh position={[0.16, 0, 0.025]} scale={[0.14, 0.035, 0.025]}>
                <boxGeometry />
                <meshStandardMaterial color="#84979d" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.92, 0.16, 8, 48]} />
        <meshStandardMaterial color={config.colors.plate} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.85]}>
        <torusGeometry args={[0.63, 0.045, 8, 48]} />
        <meshBasicMaterial color={glow} />
      </mesh>
      <mesh position={[0, 0, 0.75]} scale={[0.45, 0.45, 0.3]}>
        <icosahedronGeometry />
        <meshStandardMaterial ref={reactor} color={glow} emissive={glow} emissiveIntensity={2} />
      </mesh>
      {/* Bridging trusses, inset vents and asymmetrical communications spine. */}
      {[-1, 1].map((side) => (
        <group key={`array-${side}`}>
          <mesh position={[side * 1.15, -0.8, -0.25]} rotation={[0, 0, side * 0.3]} scale={[2, 0.18, 0.3]}>
            <boxGeometry />
            <meshStandardMaterial color={config.colors.plate} metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[side * 2.65, 0.1, -0.2]} rotation={[0, 0, side * -0.23]} scale={[0.22, 3.5, 0.7]}>
            <boxGeometry />
            <meshStandardMaterial color={config.colors.plate} metalness={0.7} roughness={0.4} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <group key={i} position={[side * 2.25, 1 - i * 0.48, 0.24]}>
              <mesh scale={[0.8, 0.12, 0.42]} rotation={[0, side * 0.2, 0]}>
                <boxGeometry />
                <meshStandardMaterial color={config.colors.recess} metalness={0.6} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0, 0.23]} scale={[0.34, 0.035, 0.04]}>
                <boxGeometry />
                <meshBasicMaterial color={config.colors.cyan} />
              </mesh>
            </group>
          ))}
          <mesh position={[side * 0.9, -1.7, -0.3]} rotation={[0, 0, side * 0.6]} scale={[0.35, 1.5, 0.6]}>
            <coneGeometry args={[1, 1, 4]} />
            <meshStandardMaterial color={config.colors.plate} metalness={0.65} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2].map((i) => (
        <group key={`spine-${i}`} position={[-0.6 + i * 0.38, 1.65 + i * 0.15, -0.15]}>
          <mesh scale={[0.065, 1 + i * 0.4, 0.065]}>
            <boxGeometry />
            <meshStandardMaterial color={config.colors.plate} />
          </mesh>
          <mesh position={[0, 0.45 + i * 0.2, 0]} scale={[0.2, 0.035, 0.24]}>
            <boxGeometry />
            <meshBasicMaterial color={config.colors.cyan} />
          </mesh>
        </group>
      ))}
      {[1.05, 1.3].map((radius, i) => (
        <mesh key={radius} position={[0, 0, 0.4 - i * 0.2]} rotation={[0.2, -0.2, 0]}>
          <torusGeometry args={[radius, 0.065, 6, 48, Math.PI * 1.7]} />
          <meshStandardMaterial color={config.colors.plate} metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      <group position={[2.45, 1.8, -0.25]} rotation={[0.3, -0.2, -0.3]}>
        <mesh scale={[0.06, 0.9, 0.06]}>
          <boxGeometry />
          <meshStandardMaterial color={config.colors.plate} />
        </mesh>
        <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.46, 0.13, 0.13, 8, 1, true]} />
          <meshStandardMaterial color={config.colors.plate} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.4, 0.1]}>
          <torusGeometry args={[0.4, 0.025, 5, 24]} />
          <meshBasicMaterial color={config.colors.cyan} />
        </mesh>
      </group>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={`core-${i}`}
          position={[Math.cos((i * Math.PI) / 6) * 0.82, Math.sin((i * Math.PI) / 6) * 0.82, 0.72]}
          rotation={[0, 0, (i * Math.PI) / 6]}
          scale={[0.17, 0.045, 0.1]}
        >
          <boxGeometry />
          <meshBasicMaterial color={i % 3 ? glow : config.colors.recess} />
        </mesh>
      ))}
    </group>
  )
}
