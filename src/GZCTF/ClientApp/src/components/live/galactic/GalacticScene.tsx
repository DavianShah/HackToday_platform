import { ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ErrorBoundary } from 'react-error-boundary'
import { Points } from 'three'
import { BossVisual, BossVisualProps } from './BossVisual'
import { sceneConfig as config } from './sceneConfig'
import classes from '@Styles/GalacticCommand.module.css'

function Atmosphere({ reducedMotion }: { reducedMotion: boolean }) {
  const stars = useRef<Points>(null)
  const positions = useMemo(() => {
    const array = new Float32Array(config.quality.stars * 3)
    let seed = 76
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < array.length; i += 3) {
      array[i] = (rand() - .5) * 85; array[i + 1] = (rand() - .5) * 50; array[i + 2] = -8 - rand() * 30
    }
    return array
  }, [])
  useFrame(({ clock }) => { if (stars.current && !reducedMotion) stars.current.rotation.z = Math.sin(clock.elapsedTime * .025) * .025 })
  return <points ref={stars}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial size={.035} color="#b6cdd9" transparent opacity={.6} sizeAttenuation /></points>
}

function CameraDirector() {
  const { camera, size } = useThree()
  useEffect(() => {
    const fov = Math.tan(config.camera.fov * Math.PI / 360)
    const distance = Math.max(config.camera.z, config.camera.worldHeight / (2 * fov), config.camera.worldWidth / (2 * fov * size.width / size.height * config.camera.safeWidth))
    camera.position.set(0, .4, distance)
    camera.lookAt(0, .3, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function ContextGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => { event.preventDefault(); onLost() }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

const Fallback = () => <div className={classes.worldFallback} role="status"><div className={classes.fallbackFortress} aria-hidden /><span>3D unavailable · Live broadcast data continues</span></div>

export default function GalacticScene({ overtime, Boss = BossVisual }: { overtime?: boolean; Boss?: ComponentType<BossVisualProps> }) {
  const [lost, setLost] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <div className={classes.world} aria-label="Orbital battlefield">
    {lost ? <Fallback /> : <ErrorBoundary FallbackComponent={Fallback}>
      <Canvas dpr={[1, config.quality.dpr]} camera={{ position: [0, .4, config.camera.z], fov: config.camera.fov }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={<Fallback />}>
        <ContextGuard onLost={() => setLost(true)} /><CameraDirector />
        <ambientLight intensity={.9} /><directionalLight position={[3, 5, 7]} intensity={3} color="#cce2ef" />
        <directionalLight position={[-5, -2, 4]} intensity={1.8} color="#508c9a" />
        <pointLight position={[0, 0, 3]} intensity={10} color={config.colors.amber} distance={9} />
        <Atmosphere reducedMotion={reducedMotion} /><Boss reducedMotion={reducedMotion} overtime={overtime} />
      </Canvas>
    </ErrorBoundary>}
  </div>
}
