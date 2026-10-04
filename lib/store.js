'use client'
import { useCallback, useEffect, useState } from 'react'
import { pairKey } from './rank.js'

// The finished example is static JSON under /demo. People you add live in this browser only.
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d
  } catch {
    return d
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {}
}

let demo
const loadDemo = () =>
  (demo ??= Promise.all(
    ['people', 'scores'].map((f) => fetch(`/demo/${f}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)),
  ))

export function useData() {
  const [state, set] = useState({ ready: false, people: [], scores: {} })
  const refresh = useCallback(async () => {
    const [people, scores] = await loadDemo()
    const mine = read('ad.people', [])
    const local = Object.fromEntries(Object.entries(read('ad.dates', {})).map(([k, d]) => [k, d.debrief]))
    set({
      ready: true,
      people: [...mine.map((p) => ({ ...p, local: true })), ...(people || []).filter((p) => !mine.some((m) => m.id === p.id))],
      scores: { ...scores, ...local },
    })
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { ...state, refresh }
}

export const savePerson = (p) => write('ad.people', [p, ...read('ad.people', []).filter((x) => x.id !== p.id)])

export const saveDate = (d) => write('ad.dates', { ...read('ad.dates', {}), [pairKey(d.a, d.b)]: d })

export function removePerson(id) {
  write('ad.people', read('ad.people', []).filter((p) => p.id !== id))
  write('ad.dates', Object.fromEntries(Object.entries(read('ad.dates', {})).filter(([, d]) => d.a !== id && d.b !== id)))
}

export async function loadDate(a, b) {
  const k = pairKey(a, b)
  return read('ad.dates', {})[k] || fetch(`/demo/dates/${k}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
}

export const firstName = (p) => p.name.split(' ')[0]
