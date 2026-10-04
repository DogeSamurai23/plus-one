# Plus One

Every person gets an agent. The agent reads that person's LinkedIn and public Instagram, writes up who they are, goes on a date with every other agent, and ranks who fits its person best.

## How it works

1. **Two links go in.** One LinkedIn profile and one public Instagram profile. These are the only two sources an agent ever sees.
2. **Scrape.** Apify runs `harvestapi/linkedin-profile-scraper` for LinkedIn (falling back to `apimaestro/linkedin-profile-detail`) and `apify/instagram-profile-scraper` for Instagram (bio, the latest 12 posts with captions, and the photos). Private Instagram accounts are rejected.
3. **Read.** One Gemini call (flash-lite models) with structured output turns both sources, including the six newest photos, into a persona: needs, hobbies, interests, values, personality, lifestyle, ideal first date, friction points and voice. Every claim carries the evidence it came from and which source it was seen on. The prompt forbids outside knowledge and forbids guessing gender, orientation, relationship status, religion, politics or health.
4. **Date.** Two separate agents, each with its own system prompt holding only its own person's persona and a one-line card for the other. They alternate for six turns, one model call per turn, talking as agents about their people. Then each agent reports to its person in private: a 0 to 100 score, what clicked, what worried it, and whether to book a second date. The two scores are independent and often differ.
5. **Rank.** For person X, everyone else is sorted by `0.7 × X's agent's score + 0.3 × the other agent's score`. It is X's ranking, but being wanted back counts.

## Layout

```
lib/apify.js            scrape(linkedinUrl, instagramUrl)
lib/gemini.js           generate(), a plain fetch to the Gemini REST API
lib/agent.js            analyze(raw) and date(a, b, onTurn): the prompts live here
lib/rank.js             rankFor(id, people, scores)
lib/store.js            browser-side data: static demo JSON merged with localStorage
app/live.js             runs one date from the browser and paces the messages
app/api/scrape          POST {linkedin, instagram}
app/api/analyze         POST {raw}
app/api/date            POST {a, b}, streams turns as NDJSON
app/page.js             paste links, seat any two agents on a date, list of people
app/p/[id]              profile page, then the ranking
app/date/[a]/[b]        one date, live if it has not happened yet, replayed if it has, with both private reports
app/rankings            everyone's top three
scripts/build-demo.mjs  builds the finished example into public/demo
scripts/check.mjs       self-check for ranking, link parsing and demo completeness
```

There is no database. The example run is static JSON in `public/demo`. People you add on the live site are kept in your own browser, and their agent dates the demo agents through the same API routes.

A match is mutual: both agents told their person to book a second date.

## Run it

```
cp .env.example .env     # add APIFY_TOKEN and GEMINI_API_KEY
npm install
npm run dev
npm run demo             # rebuild the example from data/people.json (resumable)
npm run check
```

## Status of the example run

68 of the 300 pairwise dates between the 25 demo people have been generated so far; the rest are waiting on Gemini quota. `npm run demo` resumes where it stopped, and `npm run check` reports the example as incomplete until every pair has dated. Dates that are missing can still be run one at a time from the site.

## About the people

The demo uses public figures with an official LinkedIn and a verified public Instagram. It is a simulation: nobody shown took part, and nothing an agent says is a quote from them.
