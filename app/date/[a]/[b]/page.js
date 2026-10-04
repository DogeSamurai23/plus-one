'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useData, loadDate, saveDate, firstName } from '../../../../lib/store.js'
import { TURNS } from '../../../../lib/rank.js'
import { Stamp, Turns, Wire } from '../../../ui.js'
import { goOnDate, sleep, pause } from '../../../live.js'

function Debrief({ me, d }) {
  const name = firstName(me)
  return (
    <section className="panel debrief" data-tag="private report">
      <h2 className="px sm">{name}<sup>(what the agent told them)</sup></h2>
      <p className="debrief-score"><b>{d.score}</b> out of 100</p>
      <p className="debrief-verdict">{d.verdict}</p>
      <dl>
        <dt>What clicked //</dt><dd>{d.clicked}</dd>
        <dt>What worried it //</dt><dd>{d.worried}</dd>
        <dt>Second date //</dt>
        <dd><span className={`tag ${d.secondDate ? 'tag-green' : ''}`}>{d.secondDate ? 'Yes, book it' : 'No'}</span></dd>
      </dl>
    </section>
  )
}

export default function DatePage() {
  const { a: aId, b: bId } = useParams()
  const router = useRouter()
  const { ready, people, refresh } = useData()
  // undefined while loading, null when these two have not dated yet
  const [date, setDate] = useState()
  // a date happening right now: { turns, error }
  const [live, setLive] = useState(null)
  // replay position for a finished date: turn n, character c
  const [pos, setPos] = useState({ n: 0, c: 0 })

  useEffect(() => {
    loadDate(aId, bId).then((d) => {
      setDate(d)
      if (d && matchMedia('(prefers-reduced-motion: reduce)').matches) setPos({ n: d.turns.length, c: 0 })
    })
  }, [aId, bId])

  // Not dated yet: the two agents go on the date now, shown at talking pace.
  useEffect(() => {
    if (date !== null || !ready) return
    const a = people.find((p) => p.id === aId)
    const b = people.find((p) => p.id === bId)
    if (!a || !b) return
    const ctl = new AbortController()
    const turns = []
    let end = null
    let result = null
    setLive({ turns: [] })
    goOnDate(a, b, (t) => turns.push(t), ctl.signal).then(
      (d) => { result = d; saveDate(d); end = 'done' },
      (e) => { end = e.message },
    )
    ;(async () => {
      let shown = 0
      while (!ctl.signal.aborted && !(end && shown >= turns.length)) {
        if (turns.length > shown) {
          shown++
          setLive({ turns: turns.slice(0, shown) })
          await pause()
        } else await sleep(100)
      }
      if (ctl.signal.aborted) return
      if (!result) return setLive({ turns, error: end })
      setPos({ n: result.turns.length, c: 0 })
      setDate(result)
      setLive(null)
      refresh()
    })()
    return () => ctl.abort()
  }, [date, ready, aId, bId])

  const total = date?.turns.length ?? 0
  const playing = pos.n < total
  useEffect(() => {
    if (!playing) return
    const len = date.turns[pos.n].text.length
    const t = pos.c >= len
      ? setTimeout(() => setPos({ n: pos.n + 1, c: 0 }), 450)
      : setTimeout(() => setPos({ n: pos.n, c: pos.c + 4 }), 16)
    return () => clearTimeout(t)
  }, [pos, playing, date])

  if (!ready || date === undefined) return <p className="empty">Loading…</p>
  // a finished transcript's `a` is whoever opened the date
  const a = people.find((p) => p.id === (date?.a ?? aId))
  const b = people.find((p) => p.id === (date?.b ?? bId))
  if (!a || !b || a === b) return <p className="empty">That date needs two different people from the home page.</p>

  if (!date) {
    const turns = live?.turns ?? []
    const speaking = !live?.error && turns.length < TURNS ? (turns.length % 2 ? b : a) : null
    return (
      <div className="grid">
        <section className="panel" data-tag="date">
          <h1 className="px sm">Date<sup>(happening now)</sup></h1>
          <Wire a={a} b={b} live={!live?.error} speaking={speaking?.id} />
          <Turns turns={turns} a={a} b={b} />
          {live?.error
            ? <p className="error" role="alert">The date failed. {live.error}</p>
            : (
              <p className="live-note" aria-live="polite">
                {speaking
                  ? `${firstName(speaking)}’s agent is ${turns.length ? 'replying' : 'sitting down'}`
                  : 'Both agents are reporting back in private'}
              </p>
            )}
          <p className="skip">
            <button className="btn btn-sm btn-pink" onClick={() => router.push('/')}>{live?.error ? 'Back to the table' : 'Stop the date'}</button>
          </p>
        </section>
      </div>
    )
  }

  const shown = date.turns.slice(0, pos.n + 1).map((t, i) => (i === pos.n ? { ...t, text: t.text.slice(0, pos.c) } : t))
  return (
    <>
      <div className="grid">
        <section className="panel" data-tag="date">
          <h1 className="px sm">Date<sup>(agent to agent)</sup></h1>
          <Wire a={a} b={b} live={playing} speaking={playing ? date.turns[pos.n].who : null} />
          <Turns turns={shown} a={a} b={b} typing={playing} />
          {playing
            ? <p className="skip"><button className="link" onClick={() => setPos({ n: total, c: 0 })}>Skip to the end</button></p>
            : <Stamp a={a} b={b} debrief={date.debrief} />}
        </section>
      </div>
      {!playing && (
        <div className="grid cols-2">
          <Debrief me={a} d={date.debrief[a.id]} />
          <Debrief me={b} d={date.debrief[b.id]} />
        </div>
      )}
    </>
  )
}
