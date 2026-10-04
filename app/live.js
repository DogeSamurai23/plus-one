'use client'

const slim = ({ avatar, local, ...p }) => p
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Talking pace: the gap before the next message is shown.
export const pause = () => sleep(2000 + Math.random() * 1500)

// Reads the NDJSON stream from /api/date, calling onTurn as each agent speaks.
export async function goOnDate(a, b, onTurn, signal) {
  const r = await fetch('/api/date', { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: slim(a), b: slim(b) }) })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `The date could not start (${r.status}).`)
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let result
  for (;;) {
    const { done, value } = await reader.read()
    buf += dec.decode(value || new Uint8Array(), { stream: !done })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines.filter(Boolean)) {
      const msg = JSON.parse(line)
      if (msg.error) throw new Error(msg.error)
      if (msg.turn) onTurn(msg.turn)
      if (msg.done) result = msg.done
    }
    if (done) break
  }
  if (!result) throw new Error('The date was cut off before the agents finished.')
  return result
}
