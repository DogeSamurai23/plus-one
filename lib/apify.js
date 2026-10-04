// The only two sources an agent ever sees: one LinkedIn profile, one public Instagram profile.
const IG_ACTOR = 'apify~instagram-profile-scraper'

const LI_RE = /^https?:\/\/([a-z]+\.)?linkedin\.com\/in\/([^/?#]+)/i
const IG_RE = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]+)/i

export function parseLinks(linkedin = '', instagram = '') {
  const li = linkedin.trim().match(LI_RE)
  const ig = instagram.trim().match(IG_RE)
  if (!li) throw new Error('That is not a LinkedIn profile link. It should look like https://www.linkedin.com/in/name')
  if (!ig) throw new Error('That is not an Instagram profile link. It should look like https://www.instagram.com/name')
  return {
    linkedin: `https://www.linkedin.com/in/${li[2]}`,
    instagram: `https://www.instagram.com/${ig[2]}`,
    liSlug: decodeURIComponent(li[2]),
    igUser: ig[2].toLowerCase(),
  }
}

async function run(actor, input, attempt = 0) {
  const r = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
  )
  // free Apify plans allow 5 runs at once; wait for a slot instead of failing
  if (r.status === 402 && attempt < 8 && (await r.clone().text()).includes('concurrent-runs')) {
    await new Promise((s) => setTimeout(s, 5000))
    return run(actor, input, attempt + 1)
  }
  if (!r.ok) throw new Error(`Apify ${actor} failed (${r.status}): ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

// LinkedIn actors return a lot of ids, urns and image links. Drop them, keep the words.
function trim(v, depth = 0) {
  if (typeof v === 'string') return v.length > 1500 ? v.slice(0, 1500) + '…' : v
  if (Array.isArray(v)) return v.slice(0, 12).map((x) => trim(x, depth + 1)).filter((x) => x != null)
  if (v && typeof v === 'object') {
    if (depth > 5) return undefined
    const out = {}
    for (const [k, x] of Object.entries(v)) {
      if (/url|urn|logo|picture|image|img|photo|^id$|Id$|tracking|email|phone/i.test(k)) continue
      const t = trim(x, depth + 1)
      if (t == null || t === '' || (Array.isArray(t) && !t.length)) continue
      out[k] = t
    }
    return Object.keys(out).length ? out : undefined
  }
  return v
}

async function toDataUrl(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const type = r.headers.get('content-type') || 'image/jpeg'
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

export async function scrapeInstagram(igUser) {
  const [p] = await run(IG_ACTOR, { usernames: [igUser] })
  if (!p || p.error || !p.username) throw new Error(`Instagram profile @${igUser} was not found.`)
  if (p.private) throw new Error(`@${igUser} is a private Instagram account. Only public profiles can be read.`)
  return {
    username: p.username,
    fullName: p.fullName,
    bio: p.biography,
    category: p.businessCategoryName,
    followers: p.followersCount,
    following: p.followsCount,
    postCount: p.postsCount,
    verified: p.verified,
    avatarUrl: p.profilePicUrlHD || p.profilePicUrl,
    posts: (p.latestPosts || []).slice(0, 12).map((x) => ({
      caption: (x.caption || '').slice(0, 700),
      type: x.type,
      location: x.locationName,
      likes: x.likesCount,
      date: x.timestamp?.slice(0, 10),
      alt: x.alt,
      imageUrl: x.displayUrl,
    })),
  }
}

// Two LinkedIn actors, tried in order. The first caps free Apify accounts at 50 runs,
// so the second takes over when it refuses.
const LI_ACTORS = [
  ['harvestapi~linkedin-profile-scraper', (url) => ({ queries: [url], profileScraperMode: 'Profile details no email ($4 per 1k)' })],
  ['apimaestro~linkedin-profile-detail', (url, slug) => ({ username: slug })],
]

export async function scrapeLinkedIn(url, slug) {
  for (const [actor, input] of LI_ACTORS) {
    const [p] = await run(actor, input(url, slug)).catch(() => [])
    const info = p?.basic_info || p
    const name = info?.fullname || [info?.firstName, info?.lastName].filter(Boolean).join(' ')
    if (name) return { name, headline: info.headline || '', profile: trim(p) }
  }
  throw new Error(`LinkedIn profile ${url} could not be read. Check that the link is right and the profile is public.`)
}

export async function scrape(linkedinUrl, instagramUrl) {
  const links = parseLinks(linkedinUrl, instagramUrl)
  const [li, ig] = await Promise.all([scrapeLinkedIn(links.linkedin, links.liSlug), scrapeInstagram(links.igUser)])
  const avatar = ig.avatarUrl ? await toDataUrl(ig.avatarUrl) : null
  return {
    id: links.igUser.replace(/[^a-z0-9]/g, '-'),
    name: li.name,
    headline: li.headline,
    linkedin: links.linkedin,
    instagram: links.instagram,
    avatar,
    followers: ig.followers,
    verified: !!ig.verified,
    raw: { linkedin: li.profile, instagram: { ...ig, avatarUrl: undefined } },
  }
}
