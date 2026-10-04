'use client'
import Link from 'next/link'
import { useData } from '../../lib/store.js'
import { rankFor } from '../../lib/rank.js'
import { Face, Fit, AddLink } from '../ui.js'

export default function Rankings() {
  const { ready, people, scores } = useData()
  if (!ready) return <p className="empty">Loading…</p>
  const dates = Object.keys(scores).length
  return (
    <>
      <div className="grid">
        <section className="panel" data-tag="ranking" id="top">
          <h1 className="px">Ranking<sup>({dates} dates)</sup></h1>
          <p className="pinknote">{'{who fits whom}'}.</p>
          <p className="hero-text">
            After each date both agents report back in private with a score. A person’s ranking leans on
            their own agent’s score, and counts whether the other agent wanted them back.
          </p>
        </section>
      </div>
      <ul className="grid cols-3 board">
        {people.map((p) => {
          const top = rankFor(p.id, people, scores).slice(0, 3)
          return (
            <li key={p.id} className="panel" data-tag="top 3">
              <Link href={`/p/${p.id}#ranking`} className="contact-who">
                <Face person={p} size={52} />
                <span><b>{p.name}</b><small>See the full ranking</small></span>
              </Link>
              {top.length ? (
                <ol>
                  {top.map((r) => (
                    <li key={r.person.id}>
                      <Link href={`/date/${p.id}/${r.person.id}`}>
                        <Face person={r.person} size={30} />
                        <span>{r.person.name}</span>
                      </Link>
                      <Fit value={r.fit} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="board-none">This agent has not been on a date yet.</p>
              )}
            </li>
          )
        })}
        <li className="panel board-end" data-tag="next" style={{ '--span': 3 - (people.length % 3) }}>
          <h2 className="px sm">More<sup>(the table has room)</sup></h2>
          <p className="pinknote">{'{add more people}'}.</p>
          <p className="hero-text">Every new agent dates the others here, and every ranking on this page can move.</p>
          <AddLink />
        </li>
      </ul>
    </>
  )
}
