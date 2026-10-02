import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ComponentType, RefObject, useEffect, useRef, useState } from 'react'
import { Group, Vector3 } from 'three'
import { LiveScoreboardTeamModel } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { attackKind, eventAge } from './EventVFX'
import { sceneConfig as config } from './sceneConfig'
import { attackBlend, SceneEvent } from './sceneEvents'
import { orbitPose, reconcileSlots, TeamSlot, teamAccent } from './teamSlots'

const shipForward = new Vector3(0, 1, 0)
const bossDirection = new Vector3()
const faceBoss = (ship: Group, x: number, y: number, z: number) => {
  bossDirection.set(-x, 0.2 - y, -z).normalize()
  ship.quaternion.setFromUnitVectors(shipForward, bossDirection)
}

export interface TeamShipVisualProps {
  id: number
  accent: string
}
export function TeamShipVisual({ id, accent }: TeamShipVisualProps) {
  const variant = id % 3
  return (
    <group scale={0.55}>
      <mesh scale={[0.55, 1.25 + variant * 0.14, 0.44]}>
        <coneGeometry args={[0.7, 1.7, 4]} />
        <meshStandardMaterial color="#667888" metalness={0.58} roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.35, -0.35]} scale={[0.54, 1.05, 0.35]}>
        <boxGeometry />
        <meshStandardMaterial color="#1c2c39" metalness={0.62} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.1, 0.23]} scale={[0.19, 0.42, 0.12]}>
        <boxGeometry />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.5}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, -0.78, -0.26]} scale={[0.3, 0.13, 0.18]}>
        <cylinderGeometry args={[1, 0.7, 1, 8]} />
        <meshStandardMaterial color="#193441" emissive={accent} emissiveIntensity={1.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (variant === 2 ? 0.65 : 0.48), 0.25, -0.1]}>
          <mesh rotation={[variant === 1 ? 0.35 : 0, side * 0.22, side * (-0.48 + variant * 0.14)]} scale={[0.26 + variant * 0.07, 0.85, 0.16]}>
            <boxGeometry />
            <meshStandardMaterial color={variant === 2 ? '#415567' : config.colors.plate} metalness={0.6} roughness={0.43} />
          </mesh>
          {variant !== 0 && <mesh position={[side * 0.25, -0.26, -0.12]} rotation={[0, 0, side * 0.42]} scale={[0.48, 0.11, 0.23]}>
            <boxGeometry />
            <meshStandardMaterial color="#263c4c" metalness={0.55} roughness={0.5} />
          </mesh>}
          <mesh position={[side * 0.08, 0.48, 0.05]} scale={[0.08, 0.24, 0.08]}>
            <boxGeometry />
            <meshBasicMaterial color={accent} />
          </mesh>
          <mesh position={[side * 0.08, 0.73, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.055, 0.4, 6]} />
            <meshBasicMaterial color={accent} transparent opacity={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Ship({
  slot,
  reducedMotion,
  ShipVisual,
  event,
  source,
  highlighted,
  phase,
  frozen,
}: {
  highlighted: Set<number>
  event?: SceneEvent
  source: Vector3
  slot: TeamSlot
  reducedMotion: boolean
  ShipVisual: ComponentType<TeamShipVisualProps>
  phase: RefObject<number>
  frozen: boolean
}) {
  const root = useRef<Group>(null)
  const orbit = useRef({ x: 0, y: 0, z: 0, angle: 0 })
  const [labelVisible, setLabelVisible] = useState(true)
  const labelCheckedAt = useRef(0)
  useFrame((_, dt) => {
    if (!root.current) return
    const pose = orbitPose(slot.lane, reducedMotion ? 0 : phase.current, 1, orbit.current)
    const now = performance.now()
    const transition = reducedMotion
      ? 1
      : Math.min(1, Math.max(0, (now - slot.entered) / (config.orbit.transition * 1000)))
    const scale =
      slot.leaving === undefined
        ? transition
        : reducedMotion
          ? 0
          : Math.max(0, 1 - (now - slot.leaving) / (config.orbit.transition * 1000))
    const active = attackKind(event) && event?.teamId === slot.id
    const age = eventAge(event)
    const attack = active && event ? attackBlend(event.kind, age) : 0
    const mix = reducedMotion ? 0 : attack
    // The first leg clears the boss's projected silhouette before entering the firing lane.
    const clearance = Math.sign(pose.x || 1) * Math.max(4.5, Math.abs(pose.x) + 0.7)
    const exit = Math.min(1, mix * 2)
    const lane = Math.max(0, mix * 2 - 1)
    const x = pose.x + (clearance - pose.x) * exit + (-2.25 - clearance) * lane
    const y = pose.y + (-1.55 - pose.y) * exit
    const z = pose.z + (5.2 - pose.z) * exit + (4.5 - 5.2) * lane
    root.current.position.set(x, y, z)
    if (now - labelCheckedAt.current > 240) {
      labelCheckedAt.current = now
      // The rear pass disappears behind the fortress instead of projecting its DOM label through armor.
      const hidden = !active && root.current.position.z < -0.8 && Math.abs(root.current.position.x) < 3.6 && Math.abs(root.current.position.y) < 2.8
      setLabelVisible(!hidden)
    }
    faceBoss(root.current, x, y, z)
    root.current.scale.setScalar(scale * (1 + Math.max(0, pose.z) * 0.025) * (active ? 1 : attackKind(event) ? 0.78 : 1))
    if (active) {
      root.current.updateWorldMatrix(true, false)
      source.set(0, 0.65, 0.22).applyMatrix4(root.current.matrixWorld)
    }
  })
  return (
    <group ref={root}>
      <mesh
        visible={highlighted.has(slot.id) || (Boolean(attackKind(event)) && event?.teamId === slot.id)}
        position={[0, 0, 0.3]}
      >
        <ringGeometry args={[0.65, 0.675, 32]} />
        <meshBasicMaterial color={config.colors.amber} transparent opacity={0.75} />
      </mesh>
      <ShipVisual id={frozen ? 0 : slot.id} accent={frozen ? config.colors.cyan : teamAccent(slot.id)} />
      {!frozen && <Html center position={[0, -0.72, 0.2]} distanceFactor={17} className={classes.shipLabel} style={{ visibility: labelVisible ? 'visible' : 'hidden' }}>
        <span className={event?.teamId === slot.id ? classes.shipLabelActive : ''} title={slot.team.name ?? undefined}>
          {slot.team.name?.trim() || `Team ${slot.id}`}
        </span>
      </Html>}
    </group>
  )
}

export function TeamFleet({
  teams,
  reducedMotion,
  ShipVisual = TeamShipVisual,
  event,
  source,
  highlighted,
  frozen = false,
}: {
  highlighted: Set<number>
  event?: SceneEvent
  source: Vector3
  teams: LiveScoreboardTeamModel[]
  reducedMotion: boolean
  ShipVisual?: ComponentType<TeamShipVisualProps>
  frozen?: boolean
}) {
  const [slots, setSlots] = useState<TeamSlot[]>([])
  const phase = useRef(0)
  const attacking = Boolean(attackKind(event) && slots.some((slot) => slot.id === event?.teamId))
  useFrame((_, delta) => {
    if (!reducedMotion && !attacking) phase.current += Math.min(delta, 0.05) * config.orbit.speed
  })
  useEffect(() => {
    setSlots((current) => reconcileSlots(
      frozen ? current.map((slot) => ({ ...slot, team: { id: slot.id } })) : current,
      teams,
      performance.now()
    ))
    const cleanup = window.setTimeout(
      () => setSlots((current) => reconcileSlots(current, teams, performance.now())),
      config.orbit.transition * 1000 + 30
    )
    return () => window.clearTimeout(cleanup)
  }, [teams, frozen])
  return (
    <group>
      {slots.map((slot) => (
        <Ship
          key={slot.id}
          slot={slot}
          reducedMotion={reducedMotion}
          ShipVisual={ShipVisual}
          event={event}
          source={source}
          highlighted={highlighted}
          phase={phase}
          frozen={frozen}
        />
      ))}
    </group>
  )
}
