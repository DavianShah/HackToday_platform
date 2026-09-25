import assert from 'node:assert/strict'
import test from 'node:test'
import { announcementScene, positiveSolveEvents, SceneScheduler } from '../src/components/live/galactic/sceneEvents.ts'
import { reconcileSlots, orbitPose, resolveTeamId, uniqueTeams } from '../src/components/live/galactic/teamSlots.ts'

test('ranking and late entries preserve occupied lanes, exits release only after fade', () => {
  const first = reconcileSlots(
    [],
    [
      { id: 8, rank: 1 },
      { id: 3, rank: 2 },
    ],
    0
  )
  const changed = reconcileSlots(first, [{ id: 3, rank: 1 }, { id: 8, rank: 2 }, { id: 12 }], 100)
  for (const slot of first) assert.equal(changed.find((s) => s.id === slot.id)?.lane, slot.lane)
  const leaving = reconcileSlots(changed, [{ id: 3 }, { id: 12 }], 200)
  assert.equal(leaving.find((s) => s.id === 8)?.leaving, 200)
  assert.equal(reconcileSlots(leaving, [{ id: 3 }, { id: 12 }], 1500).length, 2)
})

test('invalid and duplicate identities never produce anonymous ranked ships', () => {
  assert.deepEqual(
    uniqueTeams([{ id: 1 }, { id: 1 }, {}, { id: NaN }, { id: -1 }, { id: 2 }]).map((t) => t.id),
    [1, 2]
  )
})

test('ship targeting uses an exact ID or an unambiguous name', () => {
  const teams = [{ id: 3, name: 'A' }, { id: 8, name: 'B' }, { id: 9, name: 'B' }]
  assert.equal(resolveTeamId(teams, 3, 'B'), 3)
  assert.equal(resolveTeamId(teams, 99, 'A'), undefined)
  assert.equal(resolveTeamId(teams, undefined, 'A'), 3)
  assert.equal(resolveTeamId(teams, undefined, 'B'), undefined)
})

test('orbit envelope stays inside camera world bounds for top ten', () => {
  for (let lane = 0; lane < 10; lane++)
    for (let time = 0; time < 400; time += 2) {
      const pose = orbitPose(lane, time)
      assert.ok(Math.abs(pose.x) < 6.5 && Math.abs(pose.y) < 3.8)
    }
})

test('only genuine positive ordinary deltas produce solve attacks', () => {
  const events = positiveSolveEvents(
    new Map([
      [1, 150],
      [2, -20],
      [3, 0],
      [4, NaN],
      [5, 250],
    ]),
    new Set([1, 2, 3, 4]),
    'poll'
  )
  assert.deepEqual(
    events.map((e) => [e.teamId, e.delta]),
    [[1, 150]]
  )
})

test('freeze and wrong-submit boundary are enforced before scheduling', () => {
  const wrong = { key: 'wrong', kind: 'wrong' as const, title: 'Wrong', sound: 'wrongSubmit' as const }
  assert.equal(announcementScene(wrong, false, false), undefined)
  assert.equal(announcementScene(wrong, true, true), undefined)
  assert.equal(announcementScene(wrong, false, true)?.kind, 'wrong')
})

test('cinematic starts at active event, deduplicates and interrupts solves, then recovers', () => {
  const scheduler = new SceneScheduler()
  scheduler.push({ key: 'score', kind: 'correct', duration: 1500 }, 0)
  const blood = announcementScene(
    { key: 'blood', kind: 'firstBlood', title: 'First Blood', sound: 'firstBlood', popupDelay: 5000, duration: 8600 },
    false,
    false
  )!
  scheduler.push(blood, 100, true)
  assert.equal(scheduler.active?.started, 100)
  scheduler.push(blood, 2100, true)
  assert.equal(scheduler.active?.started, 100)
  assert.equal(scheduler.advance(8099)?.kind, 'firstBlood')
  assert.equal(scheduler.advance(8100), undefined)
  scheduler.reset()
  assert.equal(scheduler.active, undefined)
  assert.equal(scheduler.pending.length, 0)
})

test('visual backlog is bounded and coalesces score facts per team', () => {
  const scheduler = new SceneScheduler()
  scheduler.push({ key: 'blood', kind: 'firstBlood', duration: 8000 }, 0, true)
  for (let i = 0; i < 50; i++)
    scheduler.push({ key: String(i), kind: 'correct', teamId: i % 15, delta: 1, duration: 1500 }, 1)
  assert.equal(scheduler.pending.length, 12)
  assert.ok(scheduler.pending[0].delta! > 1)
})
