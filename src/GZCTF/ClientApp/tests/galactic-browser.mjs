// Run with pnpm dev and Chrome --remote-debugging-port=9226 (see the feature guide).
import assert from 'node:assert/strict'
import { connect, pause, screenshot } from './galactic-cdp.mjs'

const client = await connect()
const { call, evaluate } = client
const origin = 'http://127.0.0.1:63000/tests/galactic-preview.html'
const invoke = (action) => evaluate(`window.galactic.${action}()`)
const text = () => evaluate('document.body.innerText')
const statuses = () =>
  evaluate(
    '[...document.querySelectorAll("[role=status]")].filter(e=>e.getBoundingClientRect().width).map(e=>e.innerText).join(" ")'
  )
const waitFor = async (expression, timeout = 12000) => {
  for (let at = 0; at < timeout; at += 200) {
    if (await evaluate(expression)) return
    await pause(200)
  }
  throw new Error(`Timed out: ${expression}`)
}
const checkLayout = async (width, height) => {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await pause(300)
  const size = await evaluate(`({ canvas: document.querySelectorAll('canvas').length,
    page: [document.documentElement.scrollWidth,document.documentElement.scrollHeight],
    panels: [...document.querySelectorAll('aside')].map(e=>[e.clientWidth,e.clientHeight]),
    timer: document.querySelector('[data-live-timer]').getBoundingClientRect().toJSON() })`)
  assert.equal(size.canvas, 1)
  assert.deepEqual(size.page, [width, height])
  assert.deepEqual(size.panels[0], size.panels[1])
  assert.ok(size.timer.x > 0 && size.timer.right < width && size.timer.bottom < 90)
  assert.ok(Math.abs(size.timer.x + size.timer.width / 2 - width / 2) < 2)
  await screenshot(client, `layout-${width}`)
  console.log('Layout passed', width, height, size.panels)
}

try {
  await call('Page.navigate', { url: origin })
  await waitFor('!!window.galactic && !!document.querySelector("canvas")')
  // Discard errors from an old document/hot-reload; every following assertion uses a fresh page.
  client.errors.length = 0
  for (const size of [
    [1920, 1080],
    [2560, 1440],
    [1366, 768],
  ])
    await checkLayout(...size)
  await invoke('spin')
  await pause(400)
  assert.match(await text(), /Scanning sectors/i)
  assert.match(await evaluate('document.querySelector("h1").innerText'), /Scanning sectors/i)
  await pause(6600)
  assert.equal(await evaluate('document.querySelector("h1").innerText'), 'WEB')
  await invoke('start')
  await pause(4100)
  await invoke('solve')
  await waitFor('document.body.innerText.includes("+150")', 3000)
  await pause(1600)
  await invoke('firstBlood')
  await waitFor('[...document.querySelectorAll("[role=status]")].some(e=>e.innerText.toLowerCase().includes("priority strike"))')
  assert.match(await statuses(), /Priority strike/i)
  assert.doesNotMatch(await statuses(), /FIRST BLOOD/)
  const beforeTimer = await evaluate('document.querySelector("[data-live-timer]").innerText')
  await pause(3450)
  assert.match(await statuses(), /FIRST BLOOD/)
  const afterTimer = await evaluate('document.querySelector("[data-live-timer]").innerText')
  assert.notEqual(beforeTimer, afterTimer)
  await screenshot(client, 'first-blood')
  await pause(4300)
  assert.doesNotMatch(await statuses(), /FIRST BLOOD/)
  console.log('Spin, real delta, active/visible First Blood and live timer passed')

  for (const [action, label, duration] of [
    ['secondBlood', 'SECOND BLOOD', 3900],
    ['thirdBlood', 'THIRD BLOOD', 3900],
    ['hint', 'HINT RELEASED', 5600],
  ]) {
    await invoke(action)
    await waitFor(`[...document.querySelectorAll('[role=status]')].some(e=>e.innerText.includes('${label}'))`)
    assert.match(await statuses(), new RegExp(label))
    await pause(duration)
  }
  await invoke('wrongSubmit')
  await waitFor('[...document.querySelectorAll("[role=status]")].some(e=>e.innerText.toLowerCase().includes("target deflected"))')
  assert.match(await statuses(), /Preview.*Target deflected/i)
  await pause(3500)
  await invoke('simultaneousSolves')
  await waitFor('document.body.innerText.includes("+100")', 3000)
  await pause(1600)
  assert.match(await statuses(), /ByteBenders/)
  await invoke('lateTeam')
  await pause(1400)
  assert.match(await text(), /Arrival Test Team/)
  await invoke('toggleFreeze')
  await pause(250)
  assert.doesNotMatch(await text(), /NULL SECTOR|ByteBenders|Arrival Test Team|\+100/)
  await invoke('firstBlood')
  await pause(300)
  await invoke('toggleFreeze')
  await pause(300)
  assert.doesNotMatch(await statuses(), /Priority strike|FIRST BLOOD/)
  console.log('Secondary events, serial solves, late team and freeze passed')

  await invoke('reminder')
  await pause(2300)
  await invoke('countdown')
  await pause(700)
  await invoke('overtime')
  await pause(4800)
  assert.match(await text(), /OVERTIME/)
  await invoke('finish')
  await pause(3800)
  assert.match(await text(), /STANDBY/)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await invoke('spin')
  await pause(700)
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('[aria-label="Scanning available galactic sectors"]')).animationName`
    ),
    'none'
  )
  await screenshot(client, 'reduced-motion')
  await invoke('reset')
  await call('Emulation.setCPUThrottlingRate', { rate: 4 })
  await evaluate(
    "window.galactic.override({ config: {title:'fixture',enabled:true,soundEnabled:false,visualIntensity:'Calm'} })"
  )
  await pause(500)
  assert.ok(await evaluate('document.querySelector("canvas").width <= innerWidth'))
  await call('Emulation.setCPUThrottlingRate', { rate: 1 })
  await call('Emulation.setEmulatedMedia', { features: [] })
  console.log('Lifecycle, reduced motion, Calm DPR and CPU throttling passed')

  // Exercise the actual route and useLiveState, with network responses controlled by CDP.
  const state = await evaluate('window.galactic.state')
  state.config.enabled = true
  state.speedrunState.currentRound = { id: 777, category: 'Web', status: 'Running', endsAtUtc: Date.now() + 90000 }
  let polls = 0
  const respond = async (message) => {
    if (message.method !== 'Fetch.requestPaused') return
    polls++
    await call('Fetch.fulfillRequest', {
      requestId: message.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(state)).toString('base64'),
    })
  }
  client.listeners.add(respond)
  await call('Fetch.enable', { patterns: [{ urlPattern: '*/api/game/1/live' }] })
  await call('Page.navigate', { url: `${origin}?live` })
  await waitFor('document.body?.innerText.includes("NULL SECTOR")')
  const timer1 = await evaluate('document.querySelector("[data-live-timer]").innerText')
  await pause(4300)
  assert.ok(polls >= 3)
  assert.notEqual(timer1, await evaluate('document.querySelector("[data-live-timer]").innerText'))
  assert.doesNotMatch(await statuses(), /Verified strike|Priority strike/)
  state.scoreboardFrozen = true
  await pause(2300)
  assert.doesNotMatch(await text(), /NULL SECTOR/)
  state.scoreboardFrozen = false
  state.topTeams[0].score += 500
  await pause(2300)
  assert.doesNotMatch(await statuses(), /\+500|Priority strike/)
  state.topTeams[0].score += 120
  await waitFor('document.body.innerText.includes("+120")', 4000)
  await evaluate('document.querySelector("canvas").dispatchEvent(new Event("webglcontextlost",{cancelable:true}))')
  await pause(300)
  assert.match(await text(), /3D unavailable/)
  assert.match(await text(), /NULL SECTOR/)
  await screenshot(client, 'webgl-fallback')
  console.log('Actual route: polling, timer, no historical replay, freeze and WebGL loss passed', { polls })
  assert.deepEqual(client.errors, [])
  console.log('PASS: browser suite; no uncaught runtime errors')
} finally {
  await call('Emulation.setCPUThrottlingRate', { rate: 1 })
  await call('Fetch.disable')
  client.close()
}
