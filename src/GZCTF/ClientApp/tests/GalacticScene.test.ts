import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileSlots, orbitPose, uniqueTeams } from '../src/components/live/galactic/teamSlots.ts'

test('ranking and late entries preserve occupied lanes, exits release only after fade', () => {
  const first = reconcileSlots([], [{ id: 8, rank: 1 }, { id: 3, rank: 2 }], 0)
  const changed = reconcileSlots(first, [{ id: 3, rank: 1 }, { id: 8, rank: 2 }, { id: 12 }], 100)
  for (const slot of first) assert.equal(changed.find(s => s.id === slot.id)?.lane, slot.lane)
  const leaving = reconcileSlots(changed, [{ id: 3 }, { id: 12 }], 200)
  assert.equal(leaving.find(s => s.id === 8)?.leaving, 200)
  assert.equal(reconcileSlots(leaving, [{ id: 3 }, { id: 12 }], 1500).length, 2)
})

test('invalid and duplicate identities never produce anonymous ranked ships', () => {
  assert.deepEqual(uniqueTeams([{ id: 1 }, { id: 1 }, {}, { id: NaN }, { id: -1 }, { id: 2 }]).map(t => t.id), [1, 2])
})

test('orbit envelope stays inside camera world bounds for top ten', () => {
  for (let lane = 0; lane < 10; lane++) for (let time = 0; time < 400; time += 2) {
    const pose = orbitPose(lane, time)
    assert.ok(Math.abs(pose.x) < 6.5 && Math.abs(pose.y) < 3.8)
  }
})
