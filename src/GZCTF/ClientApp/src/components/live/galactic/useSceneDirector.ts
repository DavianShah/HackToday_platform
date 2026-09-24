import { useEffect, useRef, useState } from 'react'
import { LiveAnnouncement } from '../types'
import { announcementScene, positiveSolveEvents, SceneEvent, SceneScheduler } from './sceneEvents'

export function useSceneDirector({
  announcement,
  deltas,
  changed,
  frozen,
  preview,
  roundKey,
}: {
  announcement?: LiveAnnouncement
  deltas: Map<number, number>
  changed: Set<number>
  frozen: boolean
  preview: boolean
  roundKey: string
}) {
  const scheduler = useRef(new SceneScheduler())
  const observed = useRef(new WeakSet<Map<number, number>>())
  const blockedAnnouncement = useRef<string | undefined>(undefined)
  const epoch = useRef(0)
  const [event, setEvent] = useState<SceneEvent>()
  useEffect(() => {
    blockedAnnouncement.current = announcement?.key
    scheduler.current.reset()
    setEvent(undefined)
  }, [frozen, roundKey])
  useEffect(() => {
    if (frozen) return
    const mapped = announcementScene(announcement, frozen, preview)
    if (!announcement && scheduler.current.active?.kind !== 'correct') scheduler.current.active = undefined
    if (mapped && mapped.key !== blockedAnnouncement.current) scheduler.current.push(mapped, performance.now(), true)
    if (!observed.current.has(deltas)) {
      observed.current.add(deltas)
      for (const solve of positiveSolveEvents(deltas, changed, `${roundKey}-${++epoch.current}`))
        scheduler.current.push(solve, performance.now())
    }
    setEvent(scheduler.current.advance(performance.now()))
  }, [announcement, changed, deltas, frozen, preview, roundKey])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = scheduler.current.advance(performance.now())
      setEvent((current) => (current === next ? current : next))
    }, 80)
    return () => window.clearInterval(timer)
  }, [])
  return frozen ? undefined : event
}
