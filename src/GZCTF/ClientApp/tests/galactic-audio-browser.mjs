import assert from 'node:assert/strict'
import { connect, pause } from './galactic-cdp.mjs'

const c = await connect()
const { call, evaluate } = c
const action = (name) => evaluate(`window.galactic.${name}()`)
const waitFor = async (expression, timeout = 8000) => {
  for (let elapsed = 0; elapsed < timeout; elapsed += 200) {
    if (await evaluate(expression)) return
    await pause(200)
  }
  throw new Error(`Timed out: ${expression}`)
}
try {
  const run = Date.now()
  await call('Page.navigate', { url: `http://127.0.0.1:${process.env.GALACTIC_TEST_PORT ?? 63000}/tests/galactic-preview.html?run=${run}` })
  for (let i = 0; i < 40; i++) {
    if (await evaluate(`location.search.includes('run=${run}') && !!window.galactic`)) break
    await pause(200)
  }
  c.errors.length = 0
  await evaluate(`window.audioAudit={plays:[], starts:0, stops:0};
    const originalPlay=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){window.audioAudit.plays.push({src:this.src,volume:this.volume});return originalPlay.call(this)};
    const originalStart=OscillatorNode.prototype.start, originalStop=OscillatorNode.prototype.stop;
    OscillatorNode.prototype.start=function(...args){window.audioAudit.starts++;return originalStart.apply(this,args)};
    OscillatorNode.prototype.stop=function(...args){window.audioAudit.stops++;return originalStop.apply(this,args)};`)
  await action('solve')
  await pause(200)
  assert.equal(await evaluate('window.audioAudit.plays.length'), 0)
  await call('Runtime.evaluate', { expression: 'document.querySelector("button").click()', userGesture: true })
  await pause(300)
  await action('firstBlood')
  await waitFor('window.audioAudit.starts === 6')
  assert.equal(await evaluate('window.audioAudit.starts'), 6)
  await call('Runtime.evaluate', { expression: 'document.querySelector("button").click()', userGesture: true })
  await pause(200)
  assert.equal(await evaluate('window.audioAudit.starts'), 6, 're-enabling sound must not replay the active event')
  const stops = await evaluate('window.audioAudit.stops')
  await action('toggleFreeze')
  await waitFor('document.body.innerText.toLowerCase().includes("standings sealed")', 5000)
  assert.ok((await evaluate('window.audioAudit.stops')) > stops, 'freeze must stop scheduled synth voices')
  await action('toggleFreeze')
  await pause(200)
  await evaluate(
    `window.galactic.override({config:{title:'fixture',enabled:true,soundEnabled:true,volume:.17,sounds:{firstBlood:'/src/assets/audio/live-scoreboard/correct-submit.wav'}}})`
  )
  await pause(200)
  const playsBeforeOverride = await evaluate('window.audioAudit.plays.length')
  await action('firstBlood')
  await waitFor(`window.audioAudit.plays.length > ${playsBeforeOverride}`)
  const custom = await evaluate('window.audioAudit.plays.at(-1)')
  assert.match(custom.src, /correct-submit.wav$/)
  assert.equal(custom.volume, 0.17)
  const count = await evaluate('window.audioAudit.plays.length')
  await evaluate(`window.galactic.override({config:{title:'fixture',enabled:true,soundEnabled:false,volume:.9}})`)
  await action('solve')
  await pause(300)
  assert.equal(await evaluate('window.audioAudit.plays.length'), count)
  await action('reset')
  await pause(200)
  await evaluate(
    `window.galactic.override({topTeams:[...window.galactic.state.topTeams].reverse().map((team,index)=>({...team,rank:index+1}))})`
  )
  await pause(300)
  assert.match(await evaluate('document.querySelectorAll("aside")[1].innerText'), /Blue Phoenix/)
  assert.match(await evaluate('document.querySelectorAll("aside")[1].innerText'), /10.*1/s)
  await evaluate(
    `window.galactic.override({topTeams:[{id:1,name:'Long team name '.repeat(20)},{id:1,name:'Duplicate'},{id:0},{},null],recentEvents:[{id:'bad-time',createdAt:1e100,message:'Timestamp unavailable'}]})`
  )
  await pause(300)
  assert.equal(await evaluate('document.querySelectorAll("aside")[1].querySelectorAll("[title]").length'), 1)
  assert.doesNotMatch(await evaluate('document.body.innerText'), /Duplicate|NaN|Infinity/)
  assert.deepEqual(c.errors, [])
  for (const blood of ['secondBlood', 'thirdBlood']) {
    const run = Date.now()
    await call('Page.navigate', { url: `http://127.0.0.1:${process.env.GALACTIC_TEST_PORT ?? 63000}/tests/galactic-preview.html?audio=${blood}-${run}` })
    await waitFor(`location.search.includes('audio=${blood}-${run}') && !!window.galactic`)
    await call('Runtime.evaluate', { expression: 'document.querySelector("button").click()', userGesture: true })
    await waitFor("!!document.querySelector('button[aria-label=\"Sound enabled\"]')")
    await evaluate(`window.cueAudit=[]; const originalCuePlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){window.cueAudit.push({at:performance.now(),src:this.src});return originalCuePlay.call(this)};`)
    const started = await evaluate('performance.now()')
    await action(blood)
    await pause(2800)
    assert.equal(await evaluate('window.cueAudit.length'), 0, `${blood} audio played before laser fire`)
    await waitFor('window.cueAudit.length > 0', 2000)
    const cue = await evaluate('window.cueAudit[0]')
    assert.match(cue.src, new RegExp(`${blood === 'secondBlood' ? 'second' : 'third'}-blood\\.wav`))
    assert.ok(cue.at - started >= 3200 && cue.at - started <= 3900, `${blood} cue delay: ${cue.at - started}ms`)
  }
  console.log(
    'PASS: sound unlock, no replay, freeze stop, overrides, invalid data, and Blood cues at laser fire'
  )
} finally {
  c.close()
}
