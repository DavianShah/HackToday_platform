import { writeFile, mkdir } from 'node:fs/promises'

export async function connect() {
  const pages = await (await fetch('http://127.0.0.1:9226/json/list')).json()
  const page = pages.find((p) => p.type === 'page' && !p.url.startsWith('chrome:'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => {
    ws.onopen = resolve
  })
  let id = 0
  const waiting = new Map()
  const errors = []
  const listeners = new Set()
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      const pending = waiting.get(message.id)
      waiting.delete(message.id)
      if (message.error) pending?.reject(new Error(JSON.stringify(message.error)))
      else pending?.resolve(message.result)
    } else {
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
      for (const listener of listeners) listener(message)
    }
  }
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      waiting.set(++id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await call('Runtime.enable')
  await call('Page.enable')
  return { call, evaluate, errors, listeners, close: () => ws.close() }
}
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export async function screenshot(client, name) {
  await mkdir('node_modules/.galactic-qa', { recursive: true })
  const shot = await client.call('Page.captureScreenshot', { format: 'png' })
  await writeFile(`node_modules/.galactic-qa/${name}.png`, Buffer.from(shot.data, 'base64'))
}
