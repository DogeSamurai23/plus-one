import { date } from '../../../lib/agent.js'

export const maxDuration = 300

// Streams one date as NDJSON: {turn} for each thing said, then {done} with both debriefs.
export async function POST(req) {
  const { a, b } = await req.json()
  if (!a?.persona || !b?.persona) return Response.json({ error: 'Two analysed people are needed for a date.' }, { status: 400 })
  const enc = new TextEncoder()
  let stopped = false
  const stream = new ReadableStream({
    async start(c) {
      const send = (o) => c.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      try {
        send({ done: await date(a, b, (turn) => {
          // the browser hung up: stop spending model calls on a date nobody is watching
          if (stopped) throw new Error('stopped')
          send({ turn })
        }) })
      } catch (e) {
        if (!stopped) send({ error: e.message })
      }
      if (!stopped) c.close()
    },
    cancel() {
      stopped = true
    },
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } })
}
