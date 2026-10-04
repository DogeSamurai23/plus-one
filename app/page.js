'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useData, savePerson } from '../lib/store.js'
import { pairKey } from '../lib/rank.js'
import { Face } from './ui.js'

const STEPS = ['Reading their LinkedIn and Instagram', 'Working out who they are', 'Opening their profile']

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({ error: `The server stopped answering (${r.status}). Try again.` }))
  if (!r.ok || data.error) throw new Error(data.error || `Request failed (${r.status})`)
  return data
}

function Seat({ person, onClear }) {
  if (!person) return <a className="seat" href="#people"><span className="round round-lg">+</span><b>Pick someone</b></a>
  return (
    <div className="seat">
      <Face person={person} size={84} />
      <b>{person.name}</b>
      <button className="round round-sm" aria-label={`Take ${person.name} off the date`} onClick={onClear}>✕</button>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const { ready, people, scores } = useData()
  const [linkedin, setLinkedin] = useState('')
  const [instagram, setInstagram] = useState('')
  const [step, setStep] = useState(-1)
  const [error, setError] = useState('')
  // the two seats at the table
  const [pair, setPair] = useState([null, null])

  async function read(e) {
    e.preventDefault()
    setError('')
    try {
      setStep(0)
      const { raw, ...person } = await post('/api/scrape', { linkedin, instagram })
      setStep(1)
      const persona = await post('/api/analyze', { raw })
      setStep(2)
      savePerson({ ...person, persona })
      router.push(`/p/${person.id}`)
    } catch (err) {
      setError(err.message)
      setStep(-1)
    }
  }

  const [a, b] = pair.map((id) => people.find((p) => p.id === id))
  const dated = a && b && scores[pairKey(a.id, b.id)]

  // + fills the next empty seat, ✕ empties it; a third pick replaces the second seat
  function pick(id) {
    const [x, y] = pair
    setPair(x === id ? [null, y] : y === id ? [x, null] : !x ? [id, y] : [x, id])
  }

  const busy = step >= 0
  return (
    <div className="grid cols-2 home">
      <div className="grid stack">
        <section className="panel" data-tag="add" id="add">
          <h1 className="px">Date<sup>(by agent)</sup></h1>
          <p className="pinknote">{'{you stay home, your agent goes out}'}.</p>
          <p className="hero-text">
            Paste one person’s LinkedIn and public Instagram. An agent reads both, writes up who they are,
            then dates the other agents here and ranks who fits them best.
          </p>
          <form className="add" onSubmit={read}>
            <label className="field">
              <span>LinkedIn profile //</span>
              <input type="url" required disabled={busy} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/name" />
            </label>
            <label className="field">
              <span>Instagram profile, public only //</span>
              <input type="url" required disabled={busy} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://www.instagram.com/name" />
            </label>
            <button className="btn" disabled={busy}>{busy ? 'Reading…' : 'Read this person'}</button>
          </form>
          {busy && (
            <ol className="steps" aria-live="polite">
              {STEPS.map((s, i) => (
                <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>{s}</li>
              ))}
              <li className="steps-note">This takes about a minute. The scrape is live.</li>
            </ol>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section className="panel dater" data-tag="match" id="match">
          <h2 className="px">Match<sup>(pick two)</sup></h2>
          <div className="wire">
            <Seat person={a} onClear={() => pick(a.id)} />
            <span className="wire-line"><i aria-hidden="true">♥</i></span>
            <Seat person={b} onClear={() => pick(b.id)} />
          </div>
          <p className="dater-go">
            {a && b
              ? <Link className="btn" href={`/date/${a.id}/${b.id}`}>{dated ? 'Watch their date' : 'Start the date'}</Link>
              : <span className="pinknote">{'{use + in the list to seat two people}'}.</span>}
          </p>
        </section>
      </div>

      <section className="panel" data-tag="people" id="people">
        <h2 className="px">People<sup>({ready ? people.length : '…'})</sup></h2>
        <p className="pinknote">{'{each one has an agent}'}.</p>
        {ready && !people.length && <p className="hero-text">Nobody is here yet. Add the first person.</p>}
        <ul className="contacts">
          {people.map((p) => {
            const seated = pair.includes(p.id)
            return (
              <li key={p.id} className={`contact ${seated ? 'is-seated' : ''}`}>
                <Link href={`/p/${p.id}`} className="contact-who">
                  <Face person={p} size={52} />
                  <span>
                    <b>{p.name}{p.local && <em className="tag tag-green">added by you</em>}</b>
                    <small>{p.persona.tagline}</small>
                  </span>
                </Link>
                <button
                  className="round"
                  aria-label={seated ? `Take ${p.name} off the date` : `Seat ${p.name} on the date`}
                  title={seated ? 'Take off the date' : 'Seat on the date'}
                  onClick={() => pick(p.id)}
                >
                  {seated ? '✕' : '+'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
