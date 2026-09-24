import { useCallback, useEffect, useRef, useState } from 'react'
import { LiveAnnouncement } from '@Components/live/types'
import { appendLiveEvent, dequeueLiveEvent } from '@Utils/LiveEventQueue'

export const useLiveEventQueue = (onPlay: (event: LiveAnnouncement) => void) => {
  const [active, setActive] = useState<LiveAnnouncement>()
  const activeRef = useRef<LiveAnnouncement | undefined>(undefined)
  const [visible, setVisible] = useState<LiveAnnouncement>()
  const playRef = useRef(onPlay)
  playRef.current = onPlay
  const played = useRef<string | undefined>(undefined)
  const queue = useRef<LiveAnnouncement[]>([])
  const seen = useRef(new Set<string>())
  const activationTimer = useRef<number | undefined>(undefined)

  const scheduleActivation = useCallback(() => {
    if (activationTimer.current !== undefined) return
    activationTimer.current = window.setTimeout(() => {
      activationTimer.current = undefined
      if (!activeRef.current) {
        const next = dequeueLiveEvent(queue.current)
        activeRef.current = next
        setActive(next)
      }
    }, 0)
  }, [])

  const enqueue = useCallback(
    (event: LiveAnnouncement) => {
      if (seen.current.has(event.key)) return
      seen.current.add(event.key)
      appendLiveEvent(queue.current, event)
      // Defer activation by one task so events discovered in the same poll/render can be prioritized together.
      scheduleActivation()
    },
    [scheduleActivation]
  )

  const markSeen = useCallback((keys: string[]) => keys.forEach((key) => seen.current.add(key)), [])

  const clear = useCallback(() => {
    if (activationTimer.current !== undefined) window.clearTimeout(activationTimer.current)
    activationTimer.current = undefined
    queue.current = []
    activeRef.current = undefined
    setActive(undefined)
    setVisible(undefined)
  }, [])

  useEffect(() => {
    setVisible(undefined)
    if (!active) return

    if (played.current !== active.key) {
      played.current = active.key
      playRef.current(active)
    }
    const revealTimer =
      active.showPopup === false ? undefined : window.setTimeout(() => setVisible(active), active.popupDelay ?? 0)
    const advanceTimer = window.setTimeout(() => {
      const next = dequeueLiveEvent(queue.current)
      activeRef.current = next
      setActive(next)
    }, active.duration ?? 3200)

    return () => {
      if (revealTimer !== undefined) window.clearTimeout(revealTimer)
      window.clearTimeout(advanceTimer)
    }
  }, [active])

  useEffect(
    () => () => {
      if (activationTimer.current !== undefined) window.clearTimeout(activationTimer.current)
    },
    []
  )

  return { active, visible, enqueue, markSeen, clear }
}
