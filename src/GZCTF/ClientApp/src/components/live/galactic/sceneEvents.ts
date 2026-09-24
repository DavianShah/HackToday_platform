import type { LiveAnnouncement } from '../types'

export interface SceneEvent {
  key: string; kind: LiveAnnouncement['kind']; teamId?: number; teamName?: string
  delta?: number; duration: number; started: number
}

export function announcementScene(event: LiveAnnouncement | undefined, frozen: boolean, preview: boolean): Omit<SceneEvent, 'started'> | undefined {
  if (!event || frozen || event.kind === 'correct' || (event.kind === 'wrong' && !preview)) return undefined
  return { key: event.key, kind: event.kind, teamId: event.teamId, teamName: event.teamName, duration: Math.min(event.duration ?? 3200, event.kind === 'firstBlood' ? 8000 : 5400) }
}

/** One visual foreground. Facts remain in the independent API-backed HUD. */
export class SceneScheduler {
  active?: SceneEvent
  pending: Omit<SceneEvent, 'started'>[] = []
  private seen = new Set<string>()
  reset() { this.active = undefined; this.pending = []; this.seen.clear() }
  push(event: Omit<SceneEvent, 'started'>, now: number, foreground = false) {
    if (this.seen.has(event.key)) return
    this.seen.add(event.key)
    if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!)
    if (foreground) {
      this.active = { ...event, started: now }
    } else {
      // Coalesce pending score effects for the same team without replaying polling snapshots.
      const old = this.pending.find(item => item.kind === 'correct' && item.teamId === event.teamId)
      if (old) old.delta = (old.delta ?? 0) + (event.delta ?? 0)
      else if (this.pending.length < 12) this.pending.push(event)
    }
    this.advance(now)
  }
  advance(now: number) {
    if (this.active && now - this.active.started >= this.active.duration) this.active = undefined
    if (!this.active && this.pending.length) this.active = { ...this.pending.shift()!, started: now }
    return this.active
  }
}

export function positiveSolveEvents(deltas: ReadonlyMap<number, number>, changed: ReadonlySet<number>, epoch: string) {
  return [...deltas].filter(([id, value]) => Number.isSafeInteger(id) && id > 0 && Number.isFinite(value) && value > 0 && changed.has(id))
    .map(([teamId, delta]) => ({ key: `${epoch}-${teamId}`, kind: 'correct' as const, teamId, delta, duration: 1500 }))
}
