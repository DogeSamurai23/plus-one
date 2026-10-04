import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { rankFor, pairKey } from '../lib/rank.js'
import { parseLinks } from '../lib/apify.js'

// ranking: my score weighs 0.7, theirs 0.3
const ppl = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const s = (x, y) => ({ score: x }, { score: y })
const scores = {
  [pairKey('a', 'b')]: { a: { score: 80 }, b: { score: 20 } }, // 62
  [pairKey('a', 'c')]: { a: { score: 70 }, c: { score: 90 } }, // 76
}
assert.deepEqual(rankFor('a', ppl, scores).map((r) => [r.person.id, r.fit]), [['c', 76], ['b', 62]])
assert.deepEqual(rankFor('b', ppl, scores).map((r) => r.person.id), ['a'])

assert.equal(parseLinks('https://in.linkedin.com/in/some-one/?x=1', 'https://instagram.com/Some.One/').igUser, 'some.one')
assert.throws(() => parseLinks('https://linkedin.com/company/x', 'https://instagram.com/x'))
assert.throws(() => parseLinks('https://linkedin.com/in/x', 'https://example.com/x'))

if (existsSync('public/demo/scores.json')) {
  const people = JSON.parse(await readFile('public/demo/people.json', 'utf8'))
  const demo = JSON.parse(await readFile('public/demo/scores.json', 'utf8'))
  assert.ok(people.length >= 25, `only ${people.length} people`)
  for (const p of people) {
    assert.ok(p.linkedin && p.instagram, `${p.id} missing a link`)
    for (const k of ['needs', 'hobbies', 'interests']) assert.ok(p.persona[k].length, `${p.id} has no ${k}`)
    assert.equal(rankFor(p.id, people, demo).length, people.length - 1, `${p.id} ranking incomplete`)
  }
  console.log(`demo ok: ${people.length} people, ${Object.keys(demo).length} dates`)
}
console.log('ok')
