import { analyze } from '../../../lib/agent.js'

export const maxDuration = 300

export async function POST(req) {
  try {
    const { raw } = await req.json()
    if (!raw?.linkedin || !raw?.instagram) throw new Error('Both a LinkedIn and an Instagram reading are needed.')
    return Response.json(await analyze(raw))
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
