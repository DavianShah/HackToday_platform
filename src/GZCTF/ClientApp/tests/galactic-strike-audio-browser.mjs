import assert from 'node:assert/strict'
import { connect, pause } from './galactic-cdp.mjs'

const client = await connect()
const { call, evaluate } = client
const waitFor = async (expression, timeout = 12000) => {
  for (let elapsed = 0; elapsed < timeout; elapsed += 100) {
    if (await evaluate(expression)) return
    await pause(100)
  }
  throw new Error(`Timed out: ${expression}`)
}

try {
  const run = Date.now()
  await call('Page.navigate', {
    url: `http://127.0.0.1:${process.env.GALACTIC_TEST_PORT ?? 63000}/tests/galactic-preview.html?strike-audio=${run}`,
  })
  await waitFor(`location.search.includes('strike-audio=${run}') && !!window.galactic && !!document.querySelector('canvas')`)
  await call('Runtime.evaluate', { expression: 'document.querySelector("button").click()', userGesture: true })
  await waitFor("!!document.querySelector('button[aria-label=\"Sound enabled\"]')")
  await evaluate(`window.cueAudit=[];
    const originalPlay=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      window.cueAudit.push({src:this.src,sceneVisible:!!document.querySelector('[class*="sceneCallout"]')});
      return originalPlay.call(this);
    };`)

  for (const [action, file] of [['solve', 'correct-submit.wav'], ['wrongSubmit', 'wrong-submit.wav']]) {
    const before = await evaluate('window.cueAudit.length')
    await evaluate(`window.galactic.${action}()`)
    await waitFor(`window.cueAudit.slice(${before}).some(cue => cue.src.endsWith('${file}'))`)
    const cue = await evaluate(`window.cueAudit.slice(${before}).find(cue => cue.src.endsWith('${file}'))`)
    assert.equal(cue.sceneVisible, true, `${action} cue must play during its scene`)
    await pause(4800)
    assert.equal(await evaluate(`window.cueAudit.slice(${before}).filter(cue => cue.src.endsWith('${file}')).length`), 1)
  }

  await evaluate(`window.galactic.override({config:{...window.galactic.state.config,sounds:{correctSubmit:'/src/assets/audio/live-scoreboard/wrong-submit.wav'}}})`)
  await pause(500)
  const before = await evaluate('window.cueAudit.length')
  await evaluate('window.galactic.solve()')
  await waitFor(`window.cueAudit.slice(${before}).some(cue => cue.src.endsWith('wrong-submit.wav'))`)
  const overrideCue = await evaluate(`window.cueAudit.slice(${before}).find(cue => cue.src.endsWith('wrong-submit.wav'))`)
  assert.equal(overrideCue.sceneVisible, true, 'admin override cue must play during the solve scene')
  assert.equal(await evaluate(`window.cueAudit.slice(${before}).filter(cue => cue.src.endsWith('correct-submit.wav')).length`), 0)
  assert.deepEqual(client.errors, [])
  console.log('PASS: solve and wrong-submit cues, including an admin override, play during their strike scenes once')
} finally {
  client.close()
}
