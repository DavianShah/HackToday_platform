import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Points, Vector3 } from 'three'
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
    if (stars.current && !reducedMotion) stars.current.rotation.z = Math.sin(clock.elapsedTime * 0.025) * 0.025
  })
  return (
    <points ref={stars}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#b6cdd9" transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

function CameraDirector({ event, reducedMotion }: { event?: SceneEvent; reducedMotion: boolean }) {
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
    camera.position.set(0, 0.4, distance)
    camera.lookAt(0, 0.3, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  useFrame(({ clock }, dt) => {
    const age = eventAge(event)
    const prestige = event?.kind === 'firstBlood' && age < 8
    const accent = reducedMotion ? 0 : prestige ? Math.sin(Math.min(1, age / 8) * Math.PI) : 0
    const ease = 1 - Math.exp(-Math.min(dt, 0.05) * 3)
    camera.position.x +=
      ((reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.09) * 0.08) - accent * 0.35 - camera.position.x) * ease
    camera.position.z += (base.current - accent * 0.55 - camera.position.z) * ease
    camera.lookAt(0, 0.3, 0)
  })
  return null
}

function ContextGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
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
      {lost ? (
        <Fallback />
      ) : (
        <ErrorBoundary FallbackComponent={Fallback}>
          <Canvas
            dpr={[1, calm ? config.quality.calmDpr : config.quality.dpr]}
            camera={{ position: [0, 0.4, config.camera.z], fov: config.camera.fov }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            fallback={<Fallback />}
          >
            <ContextGuard onLost={() => setLost(true)} />
            <CameraDirector event={event} reducedMotion={reducedMotion} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 5, 7]} intensity={3} color="#cce2ef" />
            <directionalLight position={[-5, -2, 4]} intensity={1.8} color="#508c9a" />
            <pointLight position={[0, 0, 3]} intensity={10} color={config.colors.amber} distance={9} />
            <Atmosphere reducedMotion={reducedMotion} calm={calm} />
            <Boss reducedMotion={reducedMotion} overtime={overtime} event={event} />
            {!frozen && (
              <TeamFleet
                teams={teams}
                reducedMotion={reducedMotion}
                ShipVisual={Ship}
                event={event}
                source={source}
                highlighted={highlighted}
              />
            )}
            {!frozen &&
              event &&
              ['firstBlood', 'blood', 'wrong'].includes(event.kind) &&
              !teams.some((team) => team.id === event.teamId) && (
                <group position={[-3.8, -1.6, 2]} rotation={[0.18, 0, -1.2]}>
                  <TeamShipVisual id={0} accent={config.colors.cyan} />
                </group>
              )}
            <SectorWheel phase={spinPhase} count={categoryCount} reducedMotion={reducedMotion} />
            {!frozen && <EventVFX event={event} source={source} reducedMotion={reducedMotion || calm} />}
          </Canvas>
        </ErrorBoundary>
      )}
    </div>
  )
}
