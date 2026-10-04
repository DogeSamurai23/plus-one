// Builds the finished example under public/demo: scrape -> analyze -> every pair dates.
// Usage: npm run demo            (everything, resumable; finished steps are cached on disk)
//        npm run demo -- people  (stop before the dates)
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { scrape, parseLinks } from '../lib/apify.js'
import { analyze, date } from '../lib/agent.js'
import { pairKey } from '../lib/rank.js'

const MAX_PEOPLE = Number(process.env.MAX_PEOPLE || 25)
const json = async (f) => JSON.parse(await readFile(f, 'utf8'))
const save = (f, v) => writeFile(f, JSON.stringify(v, null, 1))

async function pool(items, n, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift())
  }))
}

// LinkedIn and Instagram must be the same human: their names have to share a word.
const sameName = (a = '', b = '') => {
  const words = (s) => s.toLowerCase().match(/[a-z]{3,}/g) || []
  return words(a).some((w) => words(b).includes(w))
}

for (const d of ['data/raw', 'public/demo/dates', 'public/demo/avatars']) await mkdir(d, { recursive: true })

const people = []
await pool(await json('data/people.json'), 2, async (links) => {
  const { igUser } = parseLinks(links.linkedin, links.instagram)
  const file = `data/raw/${igUser}.json`
  try {
    let p = existsSync(file) ? await json(file) : null
    if (!p) {
      p = await scrape(links.linkedin, links.instagram)
      await save(file, p)
    }
    if (!sameName(p.name, p.raw.instagram.fullName)) throw new Error(`name mismatch: LinkedIn "${p.name}" vs Instagram "${p.raw.instagram.fullName}"`)
    if (!p.raw.instagram.posts.length) throw new Error('no Instagram posts to read')
    if (!p.persona) {
      p.persona = await analyze(p.raw)
      await save(file, p)
    }
    if (p.avatar?.startsWith('data:')) {
      await writeFile(`public/demo/avatars/${p.id}.jpg`, Buffer.from(p.avatar.split(',')[1], 'base64'))
    }
    const { raw, ...person } = p
    people.push({ ...person, avatar: `/demo/avatars/${p.id}.jpg` })
    console.log('ok  ', p.name, '|', p.headline.slice(0, 70), '| ig', p.raw.instagram.fullName, p.verified ? 'verified' : 'UNVERIFIED', p.followers)
  } catch (e) {
    console.log('skip', igUser, '-', e.message)
  }
})

people.sort((a, b) => a.name.localeCompare(b.name))
people.length = Math.min(people.length, MAX_PEOPLE)
await save('public/demo/people.json', people)
console.log(`${people.length} people ready`)
if (process.argv[2] === 'people') process.exit()

const pairs = []
for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) pairs.push([people[i], people[j]])
let done = 0
await pool(pairs, Number(process.env.CONCURRENCY || 4), async ([a, b]) => {
  const file = `public/demo/dates/${pairKey(a.id, b.id)}.json`
  if (!existsSync(file)) {
    // alternate who opens so nobody always speaks first
    const [x, y] = (pairs.length + done) % 2 ? [a, b] : [b, a]
    try {
      await save(file, await date(x, y))
    } catch (e) {
      console.log('date failed', a.id, b.id, e.message)
    }
  }
  if (++done % 20 === 0) console.log(`${done}/${pairs.length} dates`)
})

const ids = new Set(people.map((p) => p.id))
const scores = {}
for (const f of await readdir('public/demo/dates')) {
  const d = await json(`public/demo/dates/${f}`)
  if (!ids.has(d.a) || !ids.has(d.b)) continue
  scores[pairKey(d.a, d.b)] = Object.fromEntries(
    Object.entries(d.debrief).map(([id, { score, verdict, secondDate }]) => [id, { score, verdict, secondDate }]),
  )
}
await save('public/demo/scores.json', scores)
console.log(`${Object.keys(scores).length}/${pairs.length} dates scored`)
