import type { LiveAnnouncement } from '../types'

/** Seconds from the start of the authoritative First Blood announcement. */
export const attackTimeline = { duration: 7.6, acquire: 1, approach: 2.6, fire: 3.35, impact: 3.55, recognition: 4.8, return: 6.8 } as const
export type AttackPhase = 'idle' | 'acquire' | 'approach' | 'charge' | 'fire' | 'impact' | 'recognition' | 'return' | 'resume'
export function attackPhase(kind: SceneEvent['kind'] | undefined, age: number): AttackPhase {
  if (!kind || !['firstBlood', 'blood', 'correct', 'wrong'].includes(kind)) return 'idle'
  if (age < attackTimeline.acquire) return 'acquire'
  if (age < attackTimeline.approach) return 'approach'
  if (age < attackTimeline.fire) return 'charge'
  if (age < attackTimeline.impact) return 'fire'
  if (age < attackTimeline.recognition) return 'impact'
  if (age < attackTimeline.return) return 'recognition'
  if (age < attackTimeline.duration) return 'return'
  return 'resume'
}

export interface SceneEvent {
  key: string
  kind: LiveAnnouncement['kind']
  teamId?: number
  teamName?: string
  delta?: number
  duration: number
  started: number
  bloodTier?: 2 | 3
}

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/** Motion envelope in seconds, shared by the ship and camera choreography. */
export function attackBlend(kind: SceneEvent['kind'], age: number) {
  if (!['firstBlood', 'blood', 'correct', 'wrong'].includes(kind)) return 0
  return smooth((age - attackTimeline.acquire) / (attackTimeline.approach - attackTimeline.acquire)) *
    (1 - smooth((age - attackTimeline.return) / (attackTimeline.duration - attackTimeline.return)))
}

export function announcementScene(
  event: LiveAnnouncement | undefined,
  frozen: boolean,
  preview: boolean
): Omit<SceneEvent, 'started'> | undefined {
  if (!event || frozen || (event.kind === 'wrong' && !preview)) return undefined
  return {
    key: event.key,
    kind: event.kind,
    teamId: event.teamId,
    teamName: event.teamName,
    delta: event.delta,
    bloodTier: event.kind === 'blood' ? (event.sound === 'thirdBlood' ? 3 : 2) : undefined,
    duration: ['firstBlood', 'blood', 'wrong'].includes(event.kind) ? attackTimeline.duration * 1000 : event.duration ?? 3200,
  }
}

/** One visual foreground. Facts remain in the independent API-backed HUD. */
export class SceneScheduler {
  active?: SceneEvent
  pending: Omit<SceneEvent, 'started'>[] = []
  private seen = new Set<string>()
  reset() {
    this.active = undefined
    this.pending = []
    this.seen.clear()
  }
  push(event: Omit<SceneEvent, 'started'>, now: number, foreground = false) {
    if (this.seen.has(event.key)) return
    this.seen.add(event.key)
    if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!)
    if (foreground && this.active && ['firstBlood', 'blood'].includes(this.active.kind)) {
      // A current priority strike completes before another foreground event.
      if (this.pending.length >= 12) this.pending.pop()
      this.pending.unshift(event)
    } else if (foreground) {
      this.active = { ...event, started: now }
    } else {
      // Coalesce pending score effects for the same team without replaying polling snapshots.
      const old = this.pending.find((item) => item.kind === 'correct' && item.teamId === event.teamId)
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
  return [...deltas]
    .filter(
      ([id, value]) => Number.isSafeInteger(id) && id > 0 && Number.isFinite(value) && value > 0 && changed.has(id)
    )
    .map(([teamId, delta]) => ({ key: `${epoch}-${teamId}`, kind: 'correct' as const, teamId, delta, duration: attackTimeline.duration * 1000 }))
}
