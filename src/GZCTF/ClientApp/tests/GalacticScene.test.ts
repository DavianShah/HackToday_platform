import assert from 'node:assert/strict'
import test from 'node:test'
import { announcementScene, attackBlend, attackPhase, attackTimeline, attackTimelineFor, frameSyncedStrike, positiveSolveEvents, SceneScheduler, solveTimeline, strikeCueReady } from '../src/components/live/galactic/sceneEvents.ts'
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
  for (let lane = 0; lane < 10; lane++) {
    const height = orbitPose(lane, 0).y
    for (let time = 0; time < 400; time += 2) {
      const pose = orbitPose(lane, time)
      assert.ok(Math.abs(pose.x) < 6.5 && Math.abs(pose.y) < 3.8)
      assert.equal(pose.y, height)
    }
  }
  assert.ok(orbitPose(0, 0).x > 0)
  assert.ok(orbitPose(0, Math.PI / 0.045).x < 0)
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
  assert.equal(announcementScene({ ...wrong, verified: true }, false, false)?.kind, 'wrong')
  assert.equal(announcementScene({ ...wrong, verified: true }, true, false), undefined)
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
  assert.equal(scheduler.advance(7699)?.kind, 'firstBlood')
  assert.equal(scheduler.advance(7700), undefined)
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

test('Blood strikes retain their full timeline and smooth return', () => {
  assert.equal(attackTimeline.duration, 7.6)
  for (const kind of ['firstBlood', 'blood'] as const) {
    assert.equal(attackTimelineFor(kind), attackTimeline)
    assert.equal(attackBlend(kind, 0.5), 0)
    assert.ok(attackBlend(kind, attackTimeline.approach) > 0.99)
    assert.ok(attackBlend(kind, attackTimeline.return) > 0.99)
    assert.ok(attackBlend(kind, 7.2) > 0 && attackBlend(kind, 7.2) < 1)
    assert.equal(attackBlend(kind, attackTimeline.duration), 0)
  }
  assert.equal(announcementScene({ key: 'first', kind: 'firstBlood', title: 'First Blood', sound: 'firstBlood' }, false, false)?.duration, 7600)
  assert.equal(announcementScene({ key: 'second', kind: 'blood', title: 'Second Blood', sound: 'secondBlood' }, false, false)?.duration, 7600)
  assert.equal(announcementScene({ key: 'third', kind: 'blood', title: 'Third Blood', sound: 'thirdBlood' }, false, false)?.duration, 7600)
})

test('solve and wrong-submit strikes finish three seconds earlier with aligned phases', () => {
  assert.equal(solveTimeline.duration, 4.6)
  assert.ok(solveTimeline.fire < solveTimeline.impact)
  assert.ok(solveTimeline.impact < solveTimeline.return)
  assert.deepEqual(
    [0, 1, 2.6, 3.35, 3.55, 4.8, 6.8, 7.6].map((age) => attackPhase('firstBlood', age)),
    ['acquire', 'approach', 'charge', 'fire', 'impact', 'recognition', 'return', 'resume']
  )
  for (const kind of ['firstBlood', 'blood', 'correct', 'wrong'] as const) {
    const timeline = attackTimelineFor(kind)
    assert.ok(attackBlend(kind, timeline.approach) > 0.99)
    assert.ok(attackBlend(kind, timeline.return) > 0.99)
    assert.ok(attackBlend(kind, (timeline.return + timeline.duration) / 2) > 0)
    assert.equal(attackBlend(kind, timeline.duration), 0)
  }
  for (const kind of ['correct', 'wrong'] as const) {
    assert.equal(attackTimelineFor(kind), solveTimeline)
    assert.equal(attackBlend(kind, solveTimeline.acquire / 2), 0)
    assert.deepEqual(
      [0, solveTimeline.acquire, solveTimeline.approach, solveTimeline.fire, solveTimeline.impact, solveTimeline.recognition, solveTimeline.return, solveTimeline.duration].map((age) => attackPhase(kind, age)),
      ['acquire', 'approach', 'charge', 'fire', 'impact', 'recognition', 'return', 'resume']
    )
  }
  assert.equal(positiveSolveEvents(new Map([[1, 1]]), new Set([1]), 'poll')[0].duration, 4600)
  assert.equal(announcementScene({ key: 'solve', kind: 'correct', title: 'Solve', sound: 'correctSubmit' }, false, false)?.duration, 4600)
  assert.equal(announcementScene({ key: 'wrong', kind: 'wrong', title: 'Wrong', sound: 'wrongSubmit' }, false, true)?.duration, 4600)
})

test('strike sounds cue on the laser-fire frame once', () => {
  assert.equal(frameSyncedStrike('firstBlood'), false)
  for (const [kind, sound] of [['blood', 'secondBlood'], ['correct', 'correctSubmit'], ['wrong', 'wrongSubmit']] as const) {
    assert.equal(frameSyncedStrike(kind), true)
    const timeline = attackTimelineFor(kind)
    const mapped = announcementScene({ key: kind, kind, title: kind, sound }, false, true)!
    const event = { ...mapped, started: 0 }
    assert.equal(strikeCueReady(event, timeline.fire - 0.001), false)
    assert.equal(strikeCueReady(event, timeline.fire), true)
    assert.equal(strikeCueReady(event, timeline.fire, event.key), false)
    assert.equal(strikeCueReady(event, timeline.duration), false)
    assert.equal(event.sound, sound)
  }
  const first = announcementScene({ key: 'first', kind: 'firstBlood', title: 'First', sound: 'firstBlood' }, false, false)!
  assert.equal(strikeCueReady({ ...first, started: 0 }, attackTimeline.fire), false)
})
