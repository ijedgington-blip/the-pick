import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { config } from 'dotenv'
import { updateYesterdaysResult } from './update-result'

config({ path: path.join(process.cwd(), '.env.local') })

const ODDS_API_KEY = process.env.ODDS_API_KEY!
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET

const SPORTS = [
  'soccer_epl',
  'soccer_efl_champ',
  'soccer_uefa_champs_league',
  'soccer_europa_league',
  'soccer_germany_bundesliga',
  'soccer_spain_la_liga',
]

interface OddsFixture {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Array<{
    key: string
    title: string
    markets: Array<{
      key: string
      outcomes: Array<{ name: string; price: number }>
    }>
  }>
}

export interface RedditPost {
  title: string
  score: number
  url: string
  topComment?: string
}

export interface Fixture {
  match: string
  league: string
  kickoff: string
  homeTeam: string
  awayTeam: string
  homeOdds: number
  drawOdds: number
  awayOdds: number
  homeImplied: number
  drawImplied: number
  awayImplied: number
  redditContext: RedditPost[]
}

async function fetchTodaysFixtures(): Promise<OddsFixture[]> {
  const today = new Date().toISOString().split('T')[0]
  const allFixtures: OddsFixture[] = []

  for (const sport of SPORTS) {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=uk&markets=h2h&bookmakers=ladbrokes_uk`
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`Failed to fetch ${sport}: ${res.status}`)
      continue
    }
    const data = await res.json() as OddsFixture[]
    const todaysFixtures = data.filter(f => f.commence_time.startsWith(today))
    allFixtures.push(...todaysFixtures)
  }

  return allFixtures
}

function extractLadbrokesOdds(fixture: OddsFixture): { home: number; draw: number; away: number } | null {
  const ladbrokes = fixture.bookmakers.find(b => b.key === 'ladbrokes_uk')
  if (!ladbrokes) return null
  const h2h = ladbrokes.markets.find(m => m.key === 'h2h')
  if (!h2h) return null
  const homeOutcome = h2h.outcomes.find(o => o.name === fixture.home_team)
  const awayOutcome = h2h.outcomes.find(o => o.name === fixture.away_team)
  const drawOutcome = h2h.outcomes.find(o => o.name === 'Draw')
  if (!homeOutcome || !awayOutcome || !drawOutcome) return null
  return { home: homeOutcome.price, draw: drawOutcome.price, away: awayOutcome.price }
}

let redditToken: string | null = null

async function getRedditToken(): Promise<string | null> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) return null
  if (redditToken) return redditToken
  try {
    const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ThePick/1.0',
      },
      body: 'grant_type=client_credentials',
    })
    const data = await res.json() as { access_token?: string }
    redditToken = data.access_token ?? null
    return redditToken
  } catch {
    return null
  }
}

async function fetchRedditContext(homeTeam: string, awayTeam: string): Promise<RedditPost[]> {
  const token = await getRedditToken()
  if (!token) return []

  // Shorten team names for search (e.g. "Manchester City" -> "Man City" doesn't matter, Reddit handles it)
  const query = `${homeTeam} ${awayTeam}`
  const subreddits = ['soccer', 'PremierLeague', 'championsleague', 'footballhighlights']
  const results: RedditPost[] = []

  try {
    for (const sub of subreddits.slice(0, 2)) {
      const res = await fetch(
        `https://oauth.reddit.com/r/${sub}/search?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=3&t=week`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'ThePick/1.0',
          },
        }
      )
      if (!res.ok) continue
      const data = await res.json() as {
        data: {
          children: Array<{
            data: {
              title: string
              score: number
              permalink: string
              selftext?: string
            }
          }>
        }
      }

      for (const post of data.data.children) {
        results.push({
          title: post.data.title,
          score: post.data.score,
          url: `https://reddit.com${post.data.permalink}`,
          topComment: post.data.selftext
            ? post.data.selftext.slice(0, 200)
            : undefined,
        })
      }
    }

    // Also search r/soccer more broadly for team news
    const newsQuery = `${homeTeam} injury OR "team news" OR lineup`
    const newsRes = await fetch(
      `https://oauth.reddit.com/r/soccer/search?q=${encodeURIComponent(newsQuery)}&sort=new&limit=3&t=week`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'ThePick/1.0',
        },
      }
    )
    if (newsRes.ok) {
      const newsData = await newsRes.json() as {
        data: { children: Array<{ data: { title: string; score: number; permalink: string } }> }
      }
      for (const post of newsData.data.children) {
        results.push({
          title: post.data.title,
          score: post.data.score,
          url: `https://reddit.com${post.data.permalink}`,
        })
      }
    }
  } catch {
    // Reddit is a bonus, not required
  }

  // Deduplicate by title and return top 6 by score
  const seen = new Set<string>()
  return results
    .filter(r => { if (seen.has(r.title)) return false; seen.add(r.title); return true })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

async function main(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = yesterdayDate.toISOString().split('T')[0]

  fs.mkdirSync(path.join(process.cwd(), 'data', 'briefs'), { recursive: true })

  console.log("Checking yesterday's result...")
  await updateYesterdaysResult()

  console.log("Fetching today's fixtures from The Odds API...")
  const rawFixtures = await fetchTodaysFixtures()

  const fixturesWithOdds = rawFixtures
    .map(f => {
      const odds = extractLadbrokesOdds(f)
      if (!odds) return null
      return { fixture: f, odds }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (!fixturesWithOdds.length) {
    console.log('No Ladbrokes fixtures today.')
    fs.writeFileSync(
      path.join(process.cwd(), 'data', 'pending-analysis.json'),
      JSON.stringify({ date: today, no_fixtures: true }, null, 2)
    )
    console.log('Written: data/pending-analysis.json (no fixtures)')

    // Still need to settle yesterday's results even when there are no fixtures today
    const settlePrompt = `## Step 1 — Settle yesterday's results

Read data/briefs/${yesterday}.json. If any picks have settled: false, look up the actual match results using WebSearch (search for the match name + date). For each unsettled pick:
- Set result: 'win' or 'loss'
- Set return: stake * odds if win, 0 if loss (assume stake = 10)
- Set settled: true
Also update acca_result and acca_return if acca_available is true (win only if all picks won).
Write the updated JSON back to data/briefs/${yesterday}.json.

## Step 2 — Write today's no-pick brief

Write data/briefs/${today}.json with this exact content:
{"date":"${today}","no_pick":true,"reason":"No Ladbrokes fixtures today.","picks":[],"acca_available":false,"acca_odds":null,"acca_result":null,"acca_return":null}

## Step 3 — Commit and push

  git add data/briefs/${yesterday}.json data/briefs/${today}.json
  git commit -m "settle ${yesterday}, no fixtures ${today}"
  git push`

    execSync(
      `/home/edge/.local/bin/claude -p ${JSON.stringify(settlePrompt)} --dangerously-skip-permissions`,
      { stdio: 'inherit', cwd: process.cwd() }
    )
    return
  }

  console.log(`Fetching Reddit context for ${fixturesWithOdds.length} fixtures...`)
  const fixtures: Fixture[] = await Promise.all(
    fixturesWithOdds.map(async ({ fixture, odds }) => {
      const redditContext = await fetchRedditContext(fixture.home_team, fixture.away_team)
      if (redditContext.length) {
        console.log(`  ${fixture.home_team} vs ${fixture.away_team}: ${redditContext.length} Reddit posts`)
      }
      return {
        match: `${fixture.home_team} vs ${fixture.away_team}`,
        league: fixture.sport_title,
        kickoff: fixture.commence_time,
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        homeOdds: odds.home,
        drawOdds: odds.draw,
        awayOdds: odds.away,
        homeImplied: Math.round((1 / odds.home) * 1000) / 10,
        drawImplied: Math.round((1 / odds.draw) * 1000) / 10,
        awayImplied: Math.round((1 / odds.away) * 1000) / 10,
        redditContext,
      }
    })
  )

  const output = { date: today, fixtures }
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'pending-analysis.json'),
    JSON.stringify(output, null, 2)
  )
  console.log(`Written: data/pending-analysis.json (${fixtures.length} fixtures)`)
  console.log('Running Claude Code analysis...')

  const prompt = `## Step 1 — Settle yesterday's results

Read data/briefs/${yesterday}.json. If any picks have settled: false, look up the actual match results using WebSearch (search for the match name + date). For each unsettled pick:
- Set result: 'win' or 'loss'
- Set return: stake * odds if win, 0 if loss (assume stake = 10)
- Set settled: true
Also update acca_result and acca_return if acca_available is true (win only if all picks won).
Write the updated JSON back to data/briefs/${yesterday}.json.

## Step 2 — Analyse today's fixtures

Read the file data/pending-analysis.json. It contains today's football fixtures with Ladbrokes odds and Reddit context.

Perform value analysis following the rules in CLAUDE.md:
- Calculate edge (our estimated true probability minus Ladbrokes implied probability) for every outcome (home/draw/away) of every fixture
- Skip any bet with odds below 1.5
- IMPORTANT: Only one pick per match is allowed — if multiple outcomes of the same match have positive edge, keep only the single outcome with the highest edge for that match and discard the rest
- Select the top 3 picks by edge from different matches, ranked 1–3
- Apply half-Kelly: kelly_fraction = (edge / (odds - 1)) * 0.5, capped at 0.25
- Set acca_available: true and acca_odds to the product of all three odds

Write the result to data/briefs/${today}.json using the exact picks array format from CLAUDE.md.

## Step 3 — Commit and push both files

  git add data/briefs/${yesterday}.json data/briefs/${today}.json data/pending-analysis.json
  git commit -m "pick: ${today} (auto), settle ${yesterday}"
  git push`

  execSync(
    `/home/edge/.local/bin/claude -p ${JSON.stringify(prompt)} --dangerously-skip-permissions`,
    { stdio: 'inherit', cwd: process.cwd() }
  )
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
