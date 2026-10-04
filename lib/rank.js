export const TURNS = 6
export const pairKey = (a, b) => [a, b].sort().join('__')

// How well `other` fits `me`: mostly my agent's read, partly whether their agent wants me back.
export const fit = (mine, theirs) => Math.round(0.7 * mine + 0.3 * theirs)

// A match is mutual: both agents told their person to book a second date.
export const isMatch = (mine, theirs) => !!(mine?.secondDate && theirs?.secondDate)

// scores: { [pairKey]: { [personId]: { score, verdict, secondDate } } }
export function rankFor(id, people, scores) {
  return people
    .filter((p) => p.id !== id && scores[pairKey(id, p.id)])
    .map((p) => {
      const s = scores[pairKey(id, p.id)]
      return { person: p, mine: s[id], theirs: s[p.id], fit: fit(s[id].score, s[p.id].score) }
    })
    .sort((x, y) => y.fit - x.fit || y.mine.score - x.mine.score)
}
