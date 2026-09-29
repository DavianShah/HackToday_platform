// Run with Vite and Chrome CDP on 9226. GALACTIC_TEST_PORT overrides Vite's port.
import assert from 'node:assert/strict'
import { connect, pause, screenshot } from './galactic-cdp.mjs'

const c = await connect()
const { call, evaluate } = c
const waitFor = async (expression, timeout = 12000) => {
  for (let elapsed = 0; elapsed < timeout; elapsed += 150) {
    if (await evaluate(expression)) return
    await pause(150)
  }
  throw new Error(`Timed out: ${expression}; state: ${JSON.stringify(await evaluate(`({url:location.href,status:[...document.querySelectorAll('[role=status]')].map(e=>e.innerText),events:window.galactic?.state?.recentEvents?.length,body:document.body.innerText.slice(0,400)})`))}`)
}
const measure = () => evaluate(`(() => {
  const title = document.querySelector('[data-blood-title]')
  if (!title) return null
  const overlay = title.closest('[role=status]')
  const rect = title.getBoundingClientRect()
  const stage = document.querySelector('main')
  const timer = document.querySelector('[data-live-timer]').getBoundingClientRect()
  const outer = overlay.getBoundingClientRect()
  return { title: title.innerText, width: rect.width, left: rect.left, right: rect.right,
    height: rect.height, lineHeight: parseFloat(getComputedStyle(title).lineHeight),
    overlay: [outer.x,outer.y,outer.width,outer.height],
    stage: [stage.clientWidth,stage.clientHeight],
    background: getComputedStyle(overlay).backgroundColor,
    backdrop: getComputedStyle(overlay).backdropFilter,
    copyBackground: getComputedStyle(title.parentElement).backgroundImage,
    z: Number(getComputedStyle(overlay).zIndex),
    timerCenter: timer.x + timer.width / 2 }
})()`)
const captureRecognition = async (width, height) => {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await pause(350)
  await evaluate('window.galactic.firstBlood()')
  await waitFor('!!document.querySelector("[data-blood-title]")')
  await pause(380)
  const value = await measure()
  assert.equal(value.title.toUpperCase(), 'FIRST BLOOD')
  assert.ok(value.width >= width * 0.85 && value.width <= width * 0.94, JSON.stringify(value))
  assert.ok(value.left >= 0 && value.right <= width)
  assert.ok(value.left < width * 0.2 && value.right > width * 0.8)
  assert.ok(value.height <= value.lineHeight * 1.15, JSON.stringify(value))
  assert.deepEqual(value.overlay, [0, 0, width, height])
  assert.deepEqual(value.stage, [width, height])
  assert.equal(value.background, 'rgba(0, 0, 0, 0)')
  assert.equal(value.backdrop, 'none')
  assert.equal(value.copyBackground, 'none')
  assert.ok(value.z > 2)
  assert.ok(Math.abs(value.timerCenter - width / 2) < 2)
  await screenshot(c, `first-blood-recognition-${width}`)
  console.log('Recognition geometry passed', width, value.width.toFixed(1), value.left.toFixed(1))
  if (width === 1920) {
    await pause(1400)
    await screenshot(c, 'first-blood-exit-1920')
  }
  await pause(7400)
}

try {
  const run = Date.now()
  await call('Page.navigate', { url: `http://127.0.0.1:${process.env.GALACTIC_TEST_PORT ?? 63000}/tests/galactic-preview.html?run=${run}` })
  await waitFor(`location.search.includes('run=${run}') && !!window.galactic && !!document.querySelector("canvas")`)
  await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await screenshot(c, 'cinematic-idle-1920')
  await evaluate('window.galactic.firstBlood()')
  await pause(1950)
  await screenshot(c, 'first-blood-acquisition-1920')
  await pause(940)
  await screenshot(c, 'first-blood-impact-1920')
  await pause(5500)
  await captureRecognition(1920, 1080)
  await captureRecognition(1366, 768)
  await captureRecognition(2560, 1440)
  if (c.errors.length) throw new Error(`Browser exceptions: ${JSON.stringify(c.errors)}`)
} finally {
  c.close()
}
