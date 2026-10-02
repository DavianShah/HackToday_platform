import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Group, Vector3 } from 'three'
import { LiveSpinPhase } from '../types'
import { sceneConfig } from './sceneConfig'

/** Anonymous sector segments while scanning; real category text lives in the DOM after reveal. */
export function SectorWheel({
  phase,
  count,
  reducedMotion,
}: {
  phase: LiveSpinPhase
  count: number
  reducedMotion: boolean
}) {
  const root = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const start = useRef(performance.now())
  useEffect(() => {
    start.current = performance.now()
  }, [phase])
  useFrame(() => {
    if (!root.current) return
    const progress = Math.min(1, (performance.now() - start.current) / (sceneConfig.timing.spin * 1000))
    root.current.rotation.z = reducedMotion || phase !== 'spinning' ? 0 : 6 * Math.PI * (1 - Math.pow(1 - progress, 3))
    if (inner.current) inner.current.rotation.z = reducedMotion || phase !== 'spinning' ? 0 : -Math.PI * 4 * (1 - Math.pow(1 - progress, 3))
  })
  return (
    <group ref={root} visible={phase !== 'idle'} position={[0, 0.2, 1.2]} rotation={[0.16, 0.12, 0]}>
      <mesh rotation={[0.5, 0, 0]} position={[0, 0, -0.6]}>
        <torusGeometry args={[4.35, 0.045, 8, 96]} />
        <meshStandardMaterial color="#558ba4" emissive={sceneConfig.colors.cyan} emissiveIntensity={0.45} metalness={0.8} roughness={0.28} />
      </mesh>
      <group ref={inner} position={[0, 0, 0.55]} rotation={[0.3, -0.2, 0]}>
        <mesh>
          <torusGeometry args={[2.85, 0.065, 8, 72]} />
          <meshStandardMaterial color="#6b8294" emissive={sceneConfig.colors.cyan} emissiveIntensity={0.7} metalness={0.7} roughness={0.28} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} rotation={[0, 0, i * Math.PI / 5]} position={[Math.cos(i * Math.PI / 5) * 2.85, Math.sin(i * Math.PI / 5) * 2.85, 0]} scale={[0.55, 0.04, 0.04]}>
            <boxGeometry />
            <meshBasicMaterial color={sceneConfig.colors.cyan} transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
      {phase === 'spinning' && Array.from({ length: 7 }, (_, i) => {
        const a = i * Math.PI * 2 / 7
        const path = new CatmullRomCurve3([
          new Vector3(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0.55),
          new Vector3(Math.cos(a + 0.15) * 3.35, Math.sin(a + 0.15) * 3.35, 0.8),
          new Vector3(Math.cos(a - 0.08) * 3.65, Math.sin(a - 0.08) * 3.65, 0.15),
          new Vector3(Math.cos(a) * 4.3, Math.sin(a) * 4.3, -0.45),
        ])
        return <mesh key={`arc-${i}`}>
          <tubeGeometry args={[path, 12, 0.025, 4, false]} />
          <meshBasicMaterial color={sceneConfig.colors.cyan} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      })}
      {Array.from({ length: Math.max(1, count) }, (_, i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI * 2) / Math.max(1, count)]}>
          <mesh>
            <ringGeometry args={[3.6, 3.65, 64, 1, 0.05, (Math.PI * 2) / Math.max(1, count) - 0.1]} />
            <meshBasicMaterial color={sceneConfig.colors.cyan} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <mesh position={[3.8, 0, 0]} scale={[0.3, 0.045, 0.1]}>
            <boxGeometry />
            <meshBasicMaterial color={phase === 'revealed' ? sceneConfig.colors.amber : sceneConfig.colors.cyan} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
