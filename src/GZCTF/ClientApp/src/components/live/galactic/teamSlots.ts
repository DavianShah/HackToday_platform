import type { LiveScoreboardTeamModel } from '../../../Api'

export interface TeamSlot {
  id: number
  lane: number
  entered: number
  leaving?: number
  team: LiveScoreboardTeamModel
}
export const validTeamId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
export function uniqueTeams(teams: LiveScoreboardTeamModel[]) {
  const seen = new Set<number>()
  return teams.filter((team) => {
    if (!team || !validTeamId(team.id) || seen.has(team.id)) return false
    seen.add(team.id)
    return true
  })
}

/** A name is usable only when it identifies exactly one roster entry. */
export function resolveTeamId(
  teams: LiveScoreboardTeamModel[],
  id?: number,
  name?: string
): number | undefined {
  const roster = uniqueTeams(teams)
  if (id !== undefined && id !== null) return roster.some((team) => team.id === id) ? id : undefined
  if (!name?.trim()) return undefined
  const matches = roster.filter((team) => team.name?.trim() === name.trim())
  return matches.length === 1 ? matches[0].id : undefined
}

/** Keep occupied lanes through exit; polling/rank changes never shuffle an existing ship. */
export function reconcileSlots(
  previous: TeamSlot[],
  teams: LiveScoreboardTeamModel[],
  now: number,
  exitMs = 1200
): TeamSlot[] {
  const incoming = new Map(uniqueTeams(teams).map((team) => [team.id!, team]))
  const next: TeamSlot[] = []
  for (const slot of previous) {
    const team = incoming.get(slot.id)
    if (team) {
      next.push({ ...slot, team, leaving: undefined })
      incoming.delete(slot.id)
    } else if (slot.leaving === undefined || now - slot.leaving < exitMs) {
      next.push({ ...slot, leaving: slot.leaving ?? now })
    }
  }
  const occupied = new Set(next.map((slot) => slot.lane))
  for (const [id, team] of [...incoming].sort((a, b) => a[0] - b[0])) {
    let lane = 0
    while (occupied.has(lane)) lane++
    occupied.add(lane)
    next.push({ id, lane, team, entered: now })
  }
  return next
}

export const teamAccent = (id: number) => ['#86ced2', '#9bbdcf', '#c3c9ba', '#86aabf'][Math.abs(id * 31) % 4]
export const orbitPose = (lane: number, time: number, speed = 0.045, target = { x: 0, y: 0, z: 0, angle: 0 }) => {
  // Golden-angle placement avoids overlapping lane 10 with lane 0 when the API returns >10 teams.
  const angle = lane * 2.399963229728653 + time * speed
  const radius = 5.6 + (lane % 3) * 0.42
  target.x = Math.cos(angle) * radius
  target.y = Math.sin(angle) * (2.8 + (lane % 2) * 0.55) + 0.35
  target.z = Math.sin(angle * 2) * 0.65 + 1
  target.angle = angle
  return target
}
