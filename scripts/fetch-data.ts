import fs from 'fs'
import path from 'path'
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
  console.log('Now ask Claude Code to analyse and generate the picks.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
