import { ComponentType, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Vector3 } from 'three'
import { LiveScoreboardTeamModel } from '@Api'
import { orbitPose, reconcileSlots, TeamSlot, teamAccent } from './teamSlots'
import { SceneEvent } from './sceneEvents'
import { attackKind, eventAge } from './EventVFX'
import { sceneConfig as config } from './sceneConfig'

export interface TeamShipVisualProps { id: number; accent: string }
export function TeamShipVisual({ id, accent }: TeamShipVisualProps) {
  const variant = id % 3
  return <group scale={.55}>
    <mesh scale={[.5, 1.25, .35]} rotation={[0, 0, Math.PI]}><coneGeometry args={[.7, 1.7, 4]} /><meshStandardMaterial color="#9ba7b0" metalness={.65} roughness={.35} /></mesh>
    <mesh position={[0, .1, .23]} scale={[.19, .42, .12]}><boxGeometry /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={.5} metalness={.5} roughness={.2} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * .48, .25, 0]}>
      <mesh rotation={[0, side * .15, side * -.48]} scale={[.22 + variant * .045, .85, .09]}><boxGeometry /><meshStandardMaterial color={config.colors.plate} metalness={.6} roughness={.35} /></mesh>
      <mesh position={[side * .08, .48, .05]} scale={[.08, .24, .08]}><boxGeometry /><meshBasicMaterial color={accent} /></mesh>
      <mesh position={[side * .08, .73, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[.055, .4, 6]} /><meshBasicMaterial color={accent} transparent opacity={.4} /></mesh>
    </group>)}
  </group>
}

function Ship({ slot, reducedMotion, ShipVisual, event, source, highlighted }: { highlighted: Set<number>; event?: SceneEvent; source: Vector3; slot: TeamSlot; reducedMotion: boolean; ShipVisual: ComponentType<TeamShipVisualProps> }) {
  const root = useRef<Group>(null)
  const orbit = useRef({ x: 0, y: 0, z: 0, angle: 0 })
  useFrame(({ clock }, dt) => {
    if (!root.current) return
    const pose = orbitPose(slot.lane, reducedMotion ? 0 : clock.elapsedTime, config.orbit.speed, orbit.current)
    const now = performance.now()
    const transition = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - slot.entered) / (config.orbit.transition * 1000)))
    const scale = slot.leaving === undefined ? transition : reducedMotion ? 0 : Math.max(0, 1 - (now - slot.leaving) / (config.orbit.transition * 1000))
    const active = attackKind(event) && event?.teamId === slot.id
    const age = eventAge(event)
    const attack = active && event ? Math.min(1, age / .9) * Math.min(1, Math.max(0, (event.duration / 1000 - age) / 1.1)) : 0
    const mix = reducedMotion ? 0 : attack
    root.current.position.set(pose.x * (1 - mix) - 3.8 * mix, pose.y * (1 - mix) - 1.6 * mix, pose.z + mix * 1.2)
    if (active) source.copy(root.current.position)
    root.current.rotation.set(.18, Math.sin(pose.angle) * .25, pose.angle + Math.PI / 2)
    if (active && !reducedMotion) root.current.rotation.z = -1.2
    root.current.scale.setScalar(scale)
    // Clamp catch-up after suspended tabs; no React writes in the render loop.
    root.current.rotation.x += Math.min(dt, .05) * .1
  })
  return <group ref={root}><mesh visible={highlighted.has(slot.id) || (Boolean(attackKind(event)) && event?.teamId === slot.id)} position={[0, 0, .3]}><ringGeometry args={[.65, .675, 32]} /><meshBasicMaterial color={config.colors.amber} transparent opacity={.75} /></mesh><ShipVisual id={slot.id} accent={teamAccent(slot.id)} /></group>
}

export function TeamFleet({ teams, reducedMotion, ShipVisual = TeamShipVisual, event, source, highlighted }: { highlighted: Set<number>; event?: SceneEvent; source: Vector3; teams: LiveScoreboardTeamModel[]; reducedMotion: boolean; ShipVisual?: ComponentType<TeamShipVisualProps> }) {
  const [slots, setSlots] = useState<TeamSlot[]>([])
  useEffect(() => {
    setSlots(current => reconcileSlots(current, teams, performance.now()))
    const cleanup = window.setTimeout(() => setSlots(current => reconcileSlots(current, teams, performance.now())), config.orbit.transition * 1000 + 30)
    return () => window.clearTimeout(cleanup)
  }, [teams])
  return <group>{slots.map(slot => <Ship key={slot.id} slot={slot} reducedMotion={reducedMotion} ShipVisual={ShipVisual} event={event} source={source} highlighted={highlighted} />)}</group>
}
