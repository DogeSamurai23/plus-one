import { generate } from './gemini.js'
import { TURNS } from './rank.js'

const claims = (description) => ({
  type: 'ARRAY',
  description,
  items: {
    type: 'OBJECT',
    properties: {
      claim: { type: 'STRING', description: 'Short and specific, 2 to 8 words.' },
      evidence: { type: 'STRING', description: 'The concrete thing in the source that shows it: a role, a post, a caption, a phrase they used.' },
      source: { type: 'STRING', enum: ['LinkedIn', 'Instagram'] },
    },
    required: ['claim', 'evidence', 'source'],
  },
})

const PERSONA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tagline: { type: 'STRING', description: 'One line a friend would use to set them up on a date. No job title.' },
    summary: { type: 'STRING', description: '3 to 4 sentences on who this person seems to be, and where LinkedIn and Instagram agree or disagree about them.' },
    needs: claims('4 to 6 things this person needs from a partner or a relationship, inferred from how they live and work.'),
    hobbies: claims('3 to 6 things they actually do for fun.'),
    interests: claims('4 to 6 subjects they keep coming back to.'),
    values: claims('3 to 5 things they visibly care about.'),
    personality: claims('4 to 6 traits.'),
    lifestyle: { type: 'STRING', description: 'Pace of life, travel, routine, how much of their week work takes. 2 sentences.' },
    idealDate: { type: 'STRING', description: 'A specific first date this person would enjoy, 1 sentence.' },
    friction: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 to 4 honest ways they would be hard to date.' },
    voice: { type: 'STRING', description: 'How they write and talk: rhythm, vocabulary, humour. 1 to 2 sentences.' },
  },
  required: ['tagline', 'summary', 'needs', 'hobbies', 'interests', 'values', 'personality', 'lifestyle', 'idealDate', 'friction', 'voice'],
}

const ANALYST = `You are a dating agent reading the one person you will represent. Everything you know about them is below: their LinkedIn profile and their public Instagram (bio, recent captions, and some of the photos). You know nothing else, so do not use outside knowledge about them even if you recognise the name.

Work out who they are as a person to date, not as a professional. LinkedIn tells you how they spend their days, what they chose, how long they stay, what they are proud of. Instagram tells you what they do when nobody is paying them, who is in the frame, and what they find worth showing. Read the photos, not only the captions.

Rules:
- Every claim needs evidence that is actually in the sources. If you cannot point to it, leave the claim out.
- Be specific to this person. "Values authenticity" or "needs good communication" could be anyone; do not write those.
- Needs are inferred: someone who posts from a different city every week needs a partner who is fine with distance or loves to travel.
- Do not guess gender, sexual orientation, relationship status, religion, politics or health. Refer to the person by first name or as "they", never he or she.
- Be honest about friction. A flattering reading is a useless one.`

async function image(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return { inlineData: { mimeType: r.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await r.arrayBuffer()).toString('base64') } }
  } catch {
    return null
  }
}

export async function analyze(raw) {
  const posts = raw.instagram.posts || []
  const photos = (await Promise.all(posts.slice(0, 6).map((p) => p.imageUrl && image(p.imageUrl)))).filter(Boolean)
  const instagram = { ...raw.instagram, posts: posts.map(({ imageUrl, ...p }) => p) }
  return generate({
    system: ANALYST,
    schema: PERSONA_SCHEMA,
    temperature: 0.6,
    contents: [{
      role: 'user',
      parts: [
        { text: `LINKEDIN\n${JSON.stringify(raw.linkedin)}\n\nINSTAGRAM\n${JSON.stringify(instagram)}\n\nThe first ${photos.length} Instagram photos follow, newest first.` },
        ...photos,
      ],
    }],
  })
}

const first = (p) => p.name.split(' ')[0]

const agentPrompt = (me, them) => `You are the dating agent for ${me.name}. ${first(me)} is not here. You go on dates for them, with the agents of other people, and report back on who is worth their time.

What you know about ${first(me)}, from their LinkedIn and Instagram only:
${JSON.stringify({ headline: me.headline, ...me.persona })}

Tonight you are on a date with the agent for ${them.name} (${them.headline}). All you have seen of ${first(them)} is this line: "${them.persona.tagline}"

How to date:
- You are an agent and you both know it. Talk about ${first(me)} by name ("${first(me)} would hate that", "${first(me)} spent last month in..."). Let ${first(me)}'s voice colour how you talk: ${me.persona.voice}
- You are here to find out whether ${first(them)} fits what ${first(me)} needs. Bring up real details from ${first(me)}'s life, react to what the other agent just said, and ask one pointed question.
- Be honest in both directions. When something genuinely fits what ${first(me)} needs, say so and build on it. When something would not work, say that too. You are looking for a reason this could work as much as a reason it could not.
- Only use facts about ${first(me)} from the notes above. Never invent quotes, events or people.
- Refer to both people by first name or as "they", never he or she. Do not name anyone's children or family members.
- 2 to 3 sentences, under 60 words. Plain spoken words, no stage directions, no emoji, no lists.`

const DEBRIEF_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clicked: { type: 'STRING', description: 'The most promising thing that came up, 1 sentence.' },
    worried: { type: 'STRING', description: 'The thing most likely to break it, 1 sentence.' },
    verdict: { type: 'STRING', description: 'One line to your person on whether to meet them, under 20 words.' },
    score: { type: 'INTEGER', description: '0 to 100. How well this person fits yours. 50 is a pleasant evening that goes nowhere. Use the whole range.' },
    secondDate: { type: 'BOOLEAN' },
  },
  required: ['clicked', 'worried', 'verdict', 'score', 'secondDate'],
}

// One date: two agents with separate prompts take turns, then each debriefs in private.
export async function date(a, b, onTurn = () => {}) {
  const turns = []
  for (let i = 0; i < TURNS; i++) {
    const [me, them] = i % 2 ? [b, a] : [a, b]
    const text = await generate({
      system: agentPrompt(me, them),
      contents: [
        { role: 'user', parts: [{ text: i ? '(The date has started.)' : '(You sat down first. Open the date.)' }] },
        ...turns.map((t) => ({ role: t.who === me.id ? 'model' : 'user', parts: [{ text: t.text }] })),
        ...(i === TURNS - 1 || i === TURNS - 2 ? [{ role: 'user', parts: [{ text: '(This is your last turn. Wrap up honestly.)' }] }] : []),
      ],
    })
    const turn = { who: me.id, text }
    turns.push(turn)
    await onTurn(turn)
  }
  const transcript = turns.map((t) => `${t.who === a.id ? a.name : b.name}'s agent: ${t.text}`).join('\n\n')
  const debrief = (me, them) =>
    generate({
      system: agentPrompt(me, them),
      schema: DEBRIEF_SCHEMA,
      temperature: 0.4,
      contents: [{ role: 'user', parts: [{ text: `The date is over. Here is what was said:\n\n${transcript}\n\nNow report privately to ${first(me)}. Judge the fit for ${first(me)} specifically, against their needs and friction points. Score honestly across the whole range: under 35 for a clear mismatch, 40 to 60 for pleasant but lukewarm, 65 and up when their lives, pace and values truly fit, even if the agents sparred. Say yes to a second date only when you would stake ${first(me)}'s evening on it.` }] }],
    })
  const [da, db] = await Promise.all([debrief(a, b), debrief(b, a)])
  return { a: a.id, b: b.id, turns, debrief: { [a.id]: da, [b.id]: db } }
}
