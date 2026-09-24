import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { sceneConfig as config } from './sceneConfig'
import { SceneEvent } from './sceneEvents'

export const eventAge = (event?: SceneEvent) => (event ? Math.max(0, (performance.now() - event.started) / 1000) : 100)
export const attackKind = (event?: SceneEvent) =>
  event && ['firstBlood', 'blood', 'correct', 'wrong'].includes(event.kind)
export const impactTime = (event: SceneEvent) =>
  event.kind === 'firstBlood' ? config.timing.impact : event.kind === 'blood' ? 1.3 : 0.55

export function EventVFX({
  event,
  source,
  reducedMotion,
}: {
  event?: SceneEvent
  source: Vector3
  reducedMotion: boolean
}) {
  const beam = useRef<Mesh>(null)
  const wave = useRef<Mesh>(null)
  const charge = useRef<Mesh>(null)
  const sparks = useRef<Group>(null)
  const axis = useMemo(() => new Vector3(0, 1, 0), [])
  const direction = useMemo(() => new Vector3(), [])
  const color =
    event?.kind === 'firstBlood'
      ? config.colors.amber
      : event?.kind === 'wrong'
        ? config.colors.danger
        : event?.kind === 'blood'
          ? event.bloodTier === 3
            ? '#d0a18a'
            : '#d3dbeb'
          : config.colors.cyan
  useFrame(() => {
    const age = eventAge(event)
    const hit = event ? impactTime(event) : 0
    const attack = Boolean(attackKind(event))
    const impact = age - hit
    if (beam.current) {
      beam.current.visible = attack && !reducedMotion && impact >= 0 && impact < 0.55
      direction.copy(source).multiplyScalar(-1)
      if (event?.kind === 'wrong') direction.set(-source.x * 0.4, 2.5 - source.y, -source.z)
      beam.current.position.copy(source).addScaledVector(direction, 0.5)
      beam.current.scale.set(event?.kind === 'firstBlood' ? 0.12 : 0.045, direction.length(), 0.07)
      beam.current.quaternion.setFromUnitVectors(axis, direction.normalize())
    }
    if (charge.current) {
      charge.current.visible = (attack && age < hit && age > 0.2) || (event?.kind === 'hint' && age < 3)
      if (event?.kind === 'hint') charge.current.position.set(0, 2.5, 1)
      else charge.current.position.copy(source)
      charge.current.scale.setScalar(reducedMotion ? 0.2 : 0.1 + Math.min(age / hit, 1) * 0.4)
    }
    if (wave.current) {
      const pulse = attack ? impact : age - 0.2
      wave.current.visible = Boolean(event) && pulse > 0 && pulse < 1.5
      wave.current.scale.setScalar(reducedMotion ? 1.7 : 0.5 + pulse * (event?.kind === 'firstBlood' ? 4.4 : 2.4))
      wave.current.rotation.z = event?.kind === 'hint' ? age * 0.7 : 0
      wave.current.rotation.x = event?.kind === 'start' ? 1.15 : 0
      if (event?.kind === 'finished') wave.current.scale.setScalar(Math.max(0.1, 4 - age * 2))
      if (event?.kind === 'countdown' || event?.kind === 'reminder') wave.current.scale.setScalar(1.4)
    }
    if (sparks.current) {
      sparks.current.visible = attack && !reducedMotion && event?.kind !== 'wrong' && impact > 0 && impact < 1.2
      sparks.current.scale.setScalar(1 + Math.max(0, impact) * 3)
      sparks.current.rotation.z = impact * 0.12
    }
  })
  return (
    <group>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={charge} visible={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <mesh ref={wave} position={[0, 0, 1.8]} visible={false}>
        <ringGeometry args={[0.98, 1, event?.kind === 'hint' ? 6 : 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <group ref={sparks} visible={false}>
        {Array.from({ length: config.quality.sparks }, (_, i) => (
          <mesh
            key={i}
            position={[Math.cos(i * 2.4) * 0.7, Math.sin(i * 2.4) * 0.7, 1.5]}
            rotation={[0, 0, i * 2.4]}
            scale={[0.12, 0.018, 0.018]}
          >
            <boxGeometry />
            <meshBasicMaterial color={i % 3 ? color : '#e9f2fa'} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
