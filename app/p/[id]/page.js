'use client'
import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useData, saveDate, removePerson, firstName } from '../../../lib/store.js'
import { rankFor, pairKey, TURNS } from '../../../lib/rank.js'
import { Face, Sources, RankList, Turns, Wire, Stamp } from '../../ui.js'
import { goOnDate, sleep, pause } from '../../live.js'

const SECTIONS = [
  ['needs', 'Needs'],
  ['hobbies', 'Hobbies'],
  ['interests', 'Interests'],
  ['values', 'Values'],
  ['personality', 'Traits'],
]

export default function Profile() {
  const { id } = useParams()
  const router = useRouter()
  const { ready, people, scores, refresh } = useData()
  const [run, setRun] = useState(null)
  const [picked, setPicked] = useState([])
  const abort = useRef(null)
  const me = people.find((p) => p.id === id)

  if (!ready) return <p className="empty">Loading…</p>
  if (!me) return <p className="empty">Nobody here goes by that name. Pick someone from the home page, or add them there.</p>

  const name = firstName(me)
  const rows = rankFor(me.id, people, scores)
  const waiting = people.filter((p) => p.id !== me.id && !scores[pairKey(me.id, p.id)])
  const chosen = waiting.filter((p) => picked.includes(p.id))
  const toggle = (pid) => setPicked((ids) => (ids.includes(pid) ? ids.filter((x) => x !== pid) : [...ids, pid]))

  // Dates are shown one at a time at talking pace: 2 to 3.5 seconds between messages.
  // The agents answer faster than that, so each date is generated one step ahead of
  // the one on screen and the next is usually ready the moment this one ends.
  async function sendOnDates() {
    const queue = [...chosen]
    const ctl = (abort.current = new AbortController())
    const stopped = () => ctl.signal.aborted
    const made = queue.map(() => ({ turns: [], end: null }))
    let playing = 0

    ;(async () => {
      for (const [i, them] of queue.entries()) {
        while (playing < i - 1 && !stopped()) await sleep(200)
        if (stopped()) return
        try {
          made[i].result = await goOnDate(me, them, (t) => made[i].turns.push(t), ctl.signal)
          saveDate(made[i].result)
          made[i].end = 'done'
        } catch (e) {
          made[i].end = e.message
        }
      }
    })()

    setRun({ done: 0, total: queue.length })
    for (const [i, them] of queue.entries()) {
      playing = i
      let shown = 0
      const show = (extra) => setRun((r) => ({ ...r, done: i, live: { them, turns: made[i].turns.slice(0, shown), ...extra } }))
      show()
      while (!stopped() && !(made[i].end && shown >= made[i].turns.length)) {
        if (made[i].turns.length > shown) {
          shown++
          show()
          await pause()
        } else await sleep(100)
      }
      if (stopped()) break
      if (made[i].result) {
        // hold on the verdict long enough to read it
        show({ result: made[i].result })
        refresh()
        await sleep(4500)
      } else setRun((r) => ({ ...r, error: `${them.name}: ${made[i].end}` }))
      if (stopped()) break
    }
    refresh()
    setPicked([])
    setRun((r) => ({ error: r.error, finished: true }))
  }

  const dating = run && !run.finished
  const live = run?.live
  const speaking = live && !live.result && live.turns.length < TURNS ? (live.turns.length % 2 ? live.them : me) : null
  return (
    <div className="grid cols-2">
      <section className="panel card" data-tag="agent">
        <div className="frame"><Face person={me} size={168} /></div>
        <div>
          <h1 className="name">{me.name}<sup>[agent]</sup></h1>
          <p className="label dim">{me.headline}</p>
          <p className="label">Sources //</p>
          <Sources person={me} />
          <p className="label">About //</p>
          <p className="body">{me.persona.tagline}</p>
        </div>
      </section>

      <section className="panel read" data-tag="read">
        <h2 className="px">Read<sup>(by agent)</sup></h2>
        <p className="pinknote">{'{linkedin + instagram, nothing else}'}.</p>
        <p className="body">{me.persona.summary}</p>
      </section>

      {SECTIONS.map(([key, title]) => (
        <section key={key} className="panel claims" data-tag={key}>
          <h2 className="px sm">{title}<sup>({me.persona[key].length})</sup></h2>
          <ul>
            {me.persona[key].map((c, i) => (
              <li key={i}>
                <b>{c.claim}</b>
                <span className={`tag ${c.source === 'Instagram' ? 'tag-pink' : ''}`}>{c.source}</span>
                <p>{c.evidence}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="panel" data-tag="notes">
        <h2 className="px sm">Notes<sup>(for a date)</sup></h2>
        <div className="notes-grid">
          <div><p className="label">How {name} lives //</p><p className="body">{me.persona.lifestyle}</p></div>
          <div><p className="label">A first date {name} would like //</p><p className="body">{me.persona.idealDate}</p></div>
          <div>
            <p className="label">Hard to date because //</p>
            <ul className="body">{me.persona.friction.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
          <div><p className="label">How the agent talks //</p><p className="body">{me.persona.voice}</p></div>
        </div>
      </section>

      <section id="ranking" className="panel span-all" data-tag="matches">
        <h2 className="px">Matches<sup>(for {name})</sup></h2>
        {waiting.length > 0 && !dating && (
          <div className="send">
            <p className="pinknote">
              {'{'}pick who {name}’s agent should meet{'}'}.
              {rows.length > 0 && ` ${waiting.length} left.`}
            </p>
            <ul className="pick">
              {waiting.map((p) => (
                <li key={p.id}>
                  <label>
                    <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                    <Face person={p} size={26} />
                    <span>{p.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="pick-all">
              <button className="link" onClick={() => setPicked(waiting.map((p) => p.id))}>Select all {waiting.length}</button>
              <button className="link" onClick={() => setPicked([])}>Clear</button>
            </p>
            <button className="btn" disabled={!chosen.length} onClick={sendOnDates}>
              {chosen.length ? `Send on ${chosen.length} ${chosen.length === 1 ? 'date' : 'dates'}` : 'Pick someone first'}
            </button>
          </div>
        )}
        {run?.error && <p className="error" role="alert">A date failed. {run.error}</p>}
        {dating && live && (
          <div className="live">
            <p className="live-count" aria-live="polite">
              Date {run.done + 1} of {run.total}
              <span className="fit-bar"><span style={{ width: `${(run.done / run.total) * 100}%` }} /></span>
              <button className="btn btn-sm btn-pink" onClick={() => abort.current.abort()}>Stop</button>
            </p>
            <Wire a={me} b={live.them} live={!live.result} speaking={speaking?.id} />
            <Turns turns={live.turns} a={me} b={live.them} />
            {live.result
              ? <Stamp a={me} b={live.them} debrief={live.result.debrief} />
              : (
                <p className="live-note">
                  {speaking
                    ? `${firstName(speaking)}’s agent is ${live.turns.length ? 'replying' : 'sitting down'}`
                    : 'Both agents are reporting back in private'}
                </p>
              )}
          </div>
        )}
        {rows.length > 0 && <RankList me={me} rows={rows} />}
        {me.local && !dating && (
          <p className="label"><button className="link dim" onClick={() => { removePerson(me.id); router.push('/') }}>Remove {name} from this browser</button></p>
        )}
      </section>
    </div>
  )
}
