import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Group, Points, Vector3 } from 'three'
import { LiveScoreboardTeamModel, LiveScoreboardVisualIntensity } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { LiveSpinPhase } from '../types'
import { BossVisual, BossVisualProps } from './BossVisual'
import { EventVFX, eventAge } from './EventVFX'
import { SectorWheel } from './SectorWheel'
import { TeamFleet, TeamShipVisual, TeamShipVisualProps } from './TeamFleet'
import { sceneConfig as config } from './sceneConfig'
import { SceneEvent } from './sceneEvents'

function Atmosphere({ reducedMotion, calm }: { reducedMotion: boolean; calm: boolean }) {
  const stars = useRef<Points>(null)
  const haze = useRef<Group>(null)
  const debris = useRef<Group[]>([])
  const comets = useRef<Group[]>([])
  const cometTracks = useMemo(() => [
    { y: 6.8, z: -11, period: 10.5, phase: 0.12 },
    { y: -2.8, z: -17, period: 13, phase: 0.58 },
    { y: 3.4, z: -23, period: 11.5, phase: 0.83 },
    { y: -6.2, z: -14, period: 15, phase: 0.35 },
  ].slice(0, calm ? 2 : 4), [calm])
  const debrisFields = useMemo(() => Array.from({ length: calm ? 8 : 16 }, (_, i) => {
    const angle = i * 2.39996323
    const radius = 10 + (i % 4) * 2.5
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.65,
      z: -8 - (i % 5) * 3,
      angle,
    }
  }), [calm])
  const positions = useMemo(() => {
    const array = new Float32Array((calm ? config.quality.calmStars : config.quality.stars) * 3)
    let seed = 76
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
    for (let i = 0; i < array.length; i += 3) {
      array[i] = (rand() - 0.5) * 85
      array[i + 1] = (rand() - 0.5) * 50
      array[i + 2] = -8 - rand() * 30
    }
    return array
  }, [calm])
  useFrame(({ clock }) => {
    if (reducedMotion) return
    const time = clock.elapsedTime
    if (stars.current) {
      stars.current.rotation.z = Math.sin(time * 0.035) * 0.035
      stars.current.position.x = Math.sin(time * 0.08) * 0.65
      stars.current.position.y = Math.cos(time * 0.055) * 0.32
    }
    if (haze.current) {
      haze.current.position.x = Math.sin(time * 0.05) * 0.8
      haze.current.position.y = Math.cos(time * 0.04) * 0.35
    }
    debrisFields.forEach((field, i) => {
      const rock = debris.current[i]
      if (!rock) return
      rock.position.set(
        field.x + Math.sin(time * 0.18 + i) * 0.6,
        field.y + Math.cos(time * 0.14 + i) * 0.3,
        field.z
      )
      rock.rotation.y = field.angle + time * (i % 2 ? 0.12 : -0.1)
      rock.rotation.z = field.angle * 0.4 + time * 0.08
    })
    cometTracks.forEach((track, i) => {
      const comet = comets.current[i]
      if (!comet) return
      const progress = (time / track.period + track.phase) % 1
      comet.position.set(-22 + progress * 44, track.y - progress * 6, track.z)
      comet.visible = progress > 0.08 && progress < 0.92
    })
  })
  return (
    <group>
      <mesh position={[12, 7, -42]} scale={[13, 13, 2.4]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial
          color="#122a3c"
          emissive="#0c2335"
          emissiveIntensity={0.4}
          metalness={0.05}
          roughness={1}
        />
      </mesh>
      <mesh position={[12, 7, -39.4]} scale={[13.35, 13.35, 0.15]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshBasicMaterial color="#5598ad" transparent opacity={0.085} depthWrite={false} />
      </mesh>
      <group ref={haze}>
        {[
          [-23, 8, -31, 17, '#17344b', 0.14],
          [20, -9, -26, 13, '#42405d', 0.1],
          [-12, -17, -19, 10, '#22505c', 0.08],
          [29, 13, -35, 20, '#284554', 0.11],
        ].map(([x, y, z, radius, color, opacity], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]} scale={[1.8, 0.75, 0.3]}>
            <sphereGeometry args={[radius as number, 20, 12]} />
            <meshBasicMaterial color={color as string} transparent opacity={opacity as number} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <points ref={stars}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color="#b6cdd9" transparent opacity={0.6} sizeAttenuation />
      </points>
      {debrisFields.map((field, i) => (
        <group
          key={i}
          ref={(node) => { if (node) debris.current[i] = node }}
          position={[field.x, field.y, field.z]}
          rotation={[field.angle * 0.2, field.angle, field.angle * 0.4]}
        >
          <mesh scale={[0.5 + (i % 3) * 0.4, 0.22 + (i % 4) * 0.15, 0.35]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 3 ? '#152a38' : '#294153'} roughness={1} metalness={0.1} />
          </mesh>
        </group>
      ))}
      {cometTracks.map((track, i) => (
        <group
          key={track.period}
          ref={(node) => { if (node) comets.current[i] = node }}
          position={[-22, track.y, track.z]}
          rotation={[0, 0, -0.135]}
          visible={!reducedMotion}
        >
          <mesh>
            <sphereGeometry args={[0.075, 8, 6]} />
            <meshBasicMaterial color={i % 2 ? '#a9d4eb' : '#e7d0a1'} />
          </mesh>
          <mesh position={[-1.1, 0, 0]} scale={[2.2, 0.027, 0.027]}>
            <boxGeometry />
            <meshBasicMaterial color={i % 2 ? '#7cb8d5' : '#d9a776'} transparent opacity={0.48} depthWrite={false} />
          </mesh>
          <mesh position={[-0.45, 0, 0]} scale={[0.9, 0.065, 0.065]}>
            <boxGeometry />
            <meshBasicMaterial color={i % 2 ? '#9bd5ed' : '#f2c487'} transparent opacity={0.25} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CameraDirector({
  event,
  source,
  targetAvailable,
  reducedMotion,
}: {
  event?: SceneEvent
  source: Vector3
  targetAvailable: boolean
  reducedMotion: boolean
}) {
  const base = useRef(config.camera.z as number)
  const { camera, size } = useThree()
  useEffect(() => {
    const fov = Math.tan((config.camera.fov * Math.PI) / 360)
    const distance = Math.max(
      config.camera.z,
      config.camera.worldHeight / (2 * fov),
      config.camera.worldWidth / (((2 * fov * size.width) / size.height) * config.camera.safeWidth)
    )
    base.current = distance
    camera.position.set(config.camera.x, config.camera.y, distance)
    camera.lookAt(0, 0.2, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  useFrame((_, dt) => {
    const age = eventAge(event)
    const strike = Boolean(
      event &&
      ['firstBlood', 'blood', 'correct', 'wrong'].includes(event.kind) &&
      targetAvailable &&
      age < config.timing.attack
    )
    const accent = reducedMotion
      ? 0
      : strike
        ? Math.sin(Math.min(1, age / config.timing.attack) * Math.PI)
        : event?.kind === 'start'
          ? Math.max(0, 1 - age / 3.8) * 0.6
          : 0
    const focus = strike ? (age < 1 ? age : Math.max(0, 1 - Math.max(0, age - config.timing.return) / 0.8)) : 0
    const ease = 1 - Math.exp(-Math.min(dt, 0.05) * 3)
    camera.position.x += (config.camera.x + source.x * focus * 0.12 - camera.position.x) * ease
    camera.position.y += (config.camera.y + source.y * focus * 0.08 - camera.position.y) * ease
    camera.position.z +=
      (base.current -
        accent * 1.1 +
        (event?.kind === 'finished' ? Math.max(0, 1 - age / 3.5) * 1.2 : 0) -
        camera.position.z) *
      ease
    camera.lookAt(source.x * focus * 0.2, 0.2 + source.y * focus * 0.12, 0)
  })
  return null
}

function ContextGuard({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, onLost, onRestored])
  return null
}

const Fallback = () => (
  <div className={classes.worldFallback} role="status">
    <div className={classes.fallbackFortress} aria-hidden />
    <span>3D unavailable · Live broadcast data continues</span>
  </div>
)

export default function GalacticScene({
  overtime,
  teams,
  frozen,
  event,
  spinPhase,
  categoryCount,
  highlighted,
  intensity,
  Boss = BossVisual,
  Ship,
}: {
  intensity?: LiveScoreboardVisualIntensity
  overtime?: boolean
  event?: SceneEvent
  spinPhase: LiveSpinPhase
  categoryCount: number
  highlighted: Set<number>
  teams: LiveScoreboardTeamModel[]
  frozen: boolean
  Boss?: ComponentType<BossVisualProps>
  Ship?: ComponentType<TeamShipVisualProps>
}) {
  const calm = intensity === LiveScoreboardVisualIntensity.Calm
  const targetAvailable = teams.some((team) => team.id === event?.teamId)
  const source = useMemo(() => new Vector3(-3.8, -1.6, 2), [])
  useEffect(() => {
    source.set(-3.8, -1.6, 2)
  }, [event?.key, source])
  const [lost, setLost] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return (
    <div className={classes.world} aria-label="Orbital battlefield">
      <ErrorBoundary FallbackComponent={Fallback}>
        <Canvas
          dpr={[1, calm ? config.quality.calmDpr : config.quality.dpr]}
          camera={{ position: [config.camera.x, config.camera.y, config.camera.z], fov: config.camera.fov }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          fallback={<Fallback />}
        >
          <ContextGuard onLost={() => setLost(true)} onRestored={() => setLost(false)} />
          <CameraDirector
            event={frozen ? undefined : event}
            source={source}
            targetAvailable={targetAvailable}
            reducedMotion={reducedMotion}
          />
          <ambientLight intensity={0.58} />
          <directionalLight position={[8, 8, 5]} intensity={2.8} color="#dfedf7" />
          <spotLight position={[-3, 5, 9]} angle={0.5} penumbra={0.8} intensity={25} distance={22} color="#edf6ff" />
          <directionalLight position={[5, -1, 7]} intensity={1.3} color="#83c7dc" />
          <directionalLight position={[-7, -3, -5]} intensity={2.05} color="#547d93" />
          <directionalLight position={[-2, 4, -8]} intensity={1.1} color="#a5b3c9" />
          <pointLight position={[0, 0, 3]} intensity={7} color={config.colors.amber} distance={10} />
          <Atmosphere reducedMotion={reducedMotion} calm={calm} />
          <group position={[0, config.bossY, 0]}>
            <Boss
              reducedMotion={reducedMotion}
              overtime={!frozen && overtime}
              spinning={!frozen && spinPhase === 'spinning'}
              event={frozen ? undefined : event}
              targetAvailable={!frozen && targetAvailable}
            />
          </group>
          <TeamFleet
            teams={teams}
            frozen={frozen}
            reducedMotion={reducedMotion}
            ShipVisual={Ship}
            event={frozen ? undefined : event}
            source={source}
            highlighted={frozen ? new Set() : highlighted}
          />
          <SectorWheel phase={frozen ? 'idle' : spinPhase} count={categoryCount} reducedMotion={reducedMotion} />
          {!frozen && (
            <EventVFX
              event={event}
              source={source}
              reducedMotion={reducedMotion || calm}
              targetAvailable={targetAvailable}
            />
          )}
        </Canvas>
      </ErrorBoundary>
      {lost && <Fallback />}
    </div>
  )
}
