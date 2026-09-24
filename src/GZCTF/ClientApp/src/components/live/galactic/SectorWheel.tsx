import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group } from 'three'
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
  const start = useRef(performance.now())
  useEffect(() => {
    start.current = performance.now()
  }, [phase])
  useFrame(() => {
    if (!root.current) return
    const progress = Math.min(1, (performance.now() - start.current) / (sceneConfig.timing.spin * 1000))
    root.current.rotation.z = reducedMotion || phase !== 'spinning' ? 0 : 6 * Math.PI * (1 - Math.pow(1 - progress, 3))
  })
  return (
    <group ref={root} visible={phase !== 'idle'} position={[0, 0.2, -0.8]} rotation={[0.12, 0, 0]}>
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
