import { useEffect, useRef, useState } from 'react'
import { LiveAnnouncement } from '../types'
import { announcementScene, SceneEvent, SceneScheduler } from './sceneEvents'

export function useSceneDirector({
  announcement,
  frozen,
  preview,
  roundKey,
}: {
  announcement?: LiveAnnouncement
  frozen: boolean
  preview: boolean
  roundKey: string
}) {
  const scheduler = useRef(new SceneScheduler())
  const blockedAnnouncement = useRef<string | undefined>(undefined)
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
    setEvent(scheduler.current.advance(performance.now()))
  }, [announcement, frozen, preview, roundKey])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = scheduler.current.advance(performance.now())
      setEvent((current) => (current === next ? current : next))
    }, 80)
    return () => window.clearInterval(timer)
  }, [])
  return frozen ? undefined : event
}
