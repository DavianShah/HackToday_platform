export interface PrioritizedLiveEvent {
  kind: string
}

const PRIORITY: Record<string, number> = {
  hint: 100,
  firstBlood: 90,
  blood: 80,
  overtime: 70,
  finished: 70,
  category: 60,
  start: 60,
  correct: 50,
  wrong: 50,
  spin: 40,
  reminder: 20,
  countdown: 10,
}

export const liveEventPriority = (event: PrioritizedLiveEvent) => PRIORITY[event.kind] ?? 0

/** Bound presentation backlog; the independent recent-events feed retains the real facts. */
export function appendLiveEvent<T extends PrioritizedLiveEvent>(queue: T[], event: T, limit = 32) {
  if (queue.length >= limit) {
    let lowest = 0
    for (let i = 1; i < queue.length; i++)
      if (liveEventPriority(queue[i]) < liveEventPriority(queue[lowest])) lowest = i
    if (liveEventPriority(event) < liveEventPriority(queue[lowest])) return
    queue.splice(lowest, 1)
  }
  queue.push(event)
}

/** Removes the highest-priority event while preserving FIFO order for equal priorities. */
export const dequeueLiveEvent = <T extends PrioritizedLiveEvent>(events: T[]): T | undefined => {
  if (events.length === 0) return undefined

  let selectedIndex = 0
  let selectedPriority = liveEventPriority(events[0])
  for (let index = 1; index < events.length; index++) {
    const priority = liveEventPriority(events[index])
    if (priority > selectedPriority) {
      selectedIndex = index
      selectedPriority = priority
    }
  }

  return events.splice(selectedIndex, 1)[0]
}

export const REMINDER_POINTS = [1200, 600, 300, 180, 60, 30, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

/** Returns timer thresholds crossed while counting down, including thresholds skipped between polls. */
export const crossedReminderPoints = (previous: number, current: number) =>
  current >= previous ? [] : REMINDER_POINTS.filter((point) => previous > point && current <= point)

/** Blood cinematics own their score change; only non-blood solves use the ordinary solve animation. */
export const withoutBloodScoreChanges = (changedTeamIds: number[], bloodTeamIds: ReadonlySet<number>) =>
  changedTeamIds.filter((teamId) => !bloodTeamIds.has(teamId))
