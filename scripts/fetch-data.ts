import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { updateYesterdaysResult } from './update-result'

config({ path: path.join(process.cwd(), '.env.local') })

const ODDS_API_KEY = process.env.ODDS_API_KEY!

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

async function main(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  fs.mkdirSync(path.join(process.cwd(), 'data', 'briefs'), { recursive: true })

  console.log("Checking yesterday's result...")
  await updateYesterdaysResult()

  console.log("Fetching today's fixtures from The Odds API...")
  const rawFixtures = await fetchTodaysFixtures()

  const fixtures: Fixture[] = rawFixtures
    .map(f => {
      const odds = extractLadbrokesOdds(f)
      if (!odds) return null
      return {
        match: `${f.home_team} vs ${f.away_team}`,
        league: f.sport_title,
        kickoff: f.commence_time,
        homeTeam: f.home_team,
        awayTeam: f.away_team,
        homeOdds: odds.home,
        drawOdds: odds.draw,
        awayOdds: odds.away,
        homeImplied: Math.round((1 / odds.home) * 1000) / 10,
        drawImplied: Math.round((1 / odds.draw) * 1000) / 10,
        awayImplied: Math.round((1 / odds.away) * 1000) / 10,
      }
    })
    .filter((x): x is Fixture => x !== null)

  if (!fixtures.length) {
    console.log('No Ladbrokes fixtures today.')
    fs.writeFileSync(
      path.join(process.cwd(), 'data', 'pending-analysis.json'),
      JSON.stringify({ date: today, no_fixtures: true }, null, 2)
    )
    console.log('Written: data/pending-analysis.json (no fixtures)')
    return
  }

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
