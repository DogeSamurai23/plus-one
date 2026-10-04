'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isMatch } from '../lib/rank.js'

const first = (p) => p.name.split(' ')[0]

// Lights up the panel a link points at, so it is obvious where the click landed.
function flash(id) {
  const el = document.getElementById(id)
  if (!el) return false
  el.classList.remove('flash')
  void el.offsetWidth // restart the animation if it is already running
  el.classList.add('flash')
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (id === 'add') el.querySelector('input')?.focus({ preventScroll: true })
  return true
}

// Sits in the layout: flashes whatever the URL's #hash points at, on every page.
export function HashFlash() {
  const pathname = usePathname()
  useEffect(() => {
    let tries = 0
    let timer
    // the target may not have rendered yet when the page first loads
    const go = () => {
      const id = location.hash.slice(1)
      if (id && !flash(id) && tries++ < 20) timer = setTimeout(go, 150)
    }
    const onClick = (e) => {
      if (!e.target.closest?.('a[href*="#"]')) return
      tries = 0
      clearTimeout(timer)
      timer = setTimeout(go, 60)
    }
    go()
    document.addEventListener('click', onClick)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', onClick)
    }
  }, [pathname])
  return null
}

export function AddLink() {
  return <Link href="/#add" className="btn">Add someone</Link>
}
export function Face({ person, size = 48 }) {
  const style = { width: size, height: size, fontSize: size * 0.5 }
  return person.avatar ? (
    <img className="face" src={person.avatar} alt="" style={style} />
  ) : (
    <span className="face face-blank" style={style} aria-hidden="true">
      {person.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
    </span>
  )
}

export function Sources({ person }) {
  return (
    <p className="sources">
      <a className="tag" href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
      <a className="tag tag-pink" href={person.instagram} target="_blank" rel="noreferrer">Instagram</a>
    </p>
  )
}

export function Fit({ value }) {
  return (
    <span className="fit" title="Fit out of 100">
      <span className="fit-bar"><span style={{ width: `${value}%` }} /></span>
      <b>{value}</b>
    </span>
  )
}

export function RankList({ me, rows }) {
  return (
    <ol className="rank">
      {rows.map((r) => (
        <li key={r.person.id}>
          <Link href={`/p/${r.person.id}`} className="rank-who">
            <Face person={r.person} size={52} />
            <span>
              <b>{r.person.name}{isMatch(r.mine, r.theirs) && <em className="tag tag-pink">♥ match</em>}</b>
              <small>{r.person.headline}</small>
            </span>
          </Link>
          <Fit value={r.fit} />
          <p className="rank-why">
            {r.mine.verdict}
            <span className="rank-meta">
              {first(me)}’s agent gave {r.mine.score}, theirs gave {r.theirs.score}.{' '}
              <Link href={`/date/${me.id}/${r.person.id}`}>Read the date</Link>
            </span>
          </p>
        </li>
      ))}
    </ol>
  )
}

// Two agents at a table. While the date is live a heart runs along the line between them.
export function Wire({ a, b, live, speaking }) {
  const seat = (p) => (
    <Link href={`/p/${p.id}`} className={`seat ${speaking === p.id ? 'is-speaking' : ''}`}>
      <Face person={p} size={84} />
      <b>{p.name}</b>
      <small>sent an agent</small>
    </Link>
  )
  return (
    <div className={`wire ${live ? 'is-live' : ''}`}>
      {seat(a)}
      <span className="wire-line"><i aria-hidden="true">♥</i></span>
      {seat(b)}
    </div>
  )
}

export function Turns({ turns, a, b, typing }) {
  return (
    <div className="turns">
      {turns.map((t, i) => {
        const who = t.who === a.id ? a : b
        return (
          <div key={i} className={`turn ${t.who === a.id ? 'turn-a' : 'turn-b'}`}>
            <Face person={who} size={34} />
            <div>
              <span className="turn-who">{first(who)}’s agent</span>
              <p>{t.text}{typing && i === turns.length - 1 && <span className="caret" />}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// The outcome of a date. A match is mutual: both agents told their person to book a second date.
export function Stamp({ a, b, debrief }) {
  const da = debrief[a.id]
  const db = debrief[b.id]
  const match = isMatch(da, db)
  return (
    <div className={`stamp ${match ? 'is-match' : ''}`} role="status">
      {match && (
        <span className="hearts" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i }}>♥</i>)}
        </span>
      )}
      <p className="px">{match ? 'Match' : 'No spark'}<sup>{match ? '(mutual)' : '(this time)'}</sup></p>
      <p>{first(a)}’s agent gave {da.score}. {first(b)}’s agent gave {db.score}.</p>
    </div>
  )
}
