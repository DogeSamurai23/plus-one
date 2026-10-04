// A free-tier key allows about 15 requests a minute per model. Models are listed in
// order of preference; a call moves to the next one when the current one is busy.
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.1-flash-lite,gemini-3.5-flash-lite').split(',')
const spent = new Set() // models whose daily quota is gone
let cursor = 0

const sleep = (ms) => new Promise((s) => setTimeout(s, ms))

// contents: [{ role: 'user' | 'model', parts: [{ text } | { inlineData }] }]
export async function generate({ system, contents, schema, temperature = 0.9 }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature,
      ...(schema && { responseMimeType: 'application/json', responseSchema: schema }),
    },
  }
  for (let attempt = 0; ; attempt++) {
    const live = MODELS.filter((m) => !spent.has(m))
    if (!live.length) throw new Error('The Gemini key has used up its daily quota. Try again tomorrow, or use a key with billing enabled.')
    const model = live[cursor % live.length]
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    )
    if (r.ok) {
      const text = (await r.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
      if (text) return schema ? JSON.parse(text) : text.trim()
    }
    const detail = r.ok ? 'empty reply' : await r.text()
    if (detail.includes('PerDay')) {
      spent.add(model)
      continue
    }
    const retryable = r.ok || r.status === 429 || r.status >= 500
    if (!retryable || attempt >= 60) throw new Error(`Gemini failed (${r.status}): ${detail.slice(0, 300)}`)
    if (r.status === 429) cursor++
    await sleep(1000)
  }
}
