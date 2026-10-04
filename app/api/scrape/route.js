import { scrape } from '../../../lib/apify.js'

export const maxDuration = 300

export async function POST(req) {
  try {
    const { linkedin, instagram } = await req.json()
    return Response.json(await scrape(linkedin, instagram))
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
