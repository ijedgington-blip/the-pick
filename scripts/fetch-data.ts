import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { updateYesterdaysResult } from './update-result'

config({ path: path.join(process.cwd(), '.env.local') })

const ODDS_API_KEY = process.env.ODDS_API_KEY!
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY!

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

interface FormData {
  last5: string[]
  h2h: string[]
}

export interface FixtureWithForm {
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
  homeForm: FormData
  awayForm: FormData
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

async function fetchTeamForm(teamName: string): Promise<FormData> {
  try {
    const searchRes = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(teamName)}`,
      { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
    )
    const searchData = await searchRes.json() as { response: Array<{ team: { id: number } }> }
    if (!searchData.response.length) return { last5: [], h2h: [] }

    const teamId = searchData.response[0].team.id
    const fixturesRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=5&status=FT`,
      { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
    )
    const fixturesData = await fixturesRes.json() as {
      response: Array<{
        teams: { home: { id: number }; away: { id: number } }
        goals: { home: number | null; away: number | null }
      }>
    }

    const last5 = fixturesData.response.map(f => {
      const isHome = f.teams.home.id === teamId
      const homeGoals = f.goals.home ?? 0
      const awayGoals = f.goals.away ?? 0
      if (homeGoals === awayGoals) return 'D'
      if (isHome) return homeGoals > awayGoals ? 'W' : 'L'
      return awayGoals > homeGoals ? 'W' : 'L'
    })

    return { last5, h2h: [] }
  } catch {
    return { last5: [], h2h: [] }
  }
}

async function fetchH2H(homeTeam: string, awayTeam: string): Promise<string[]> {
  try {
    const [homeSearch, awaySearch] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/teams?search=${encodeURIComponent(homeTeam)}`, {
        headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      }).then(r => r.json()) as Promise<{ response: Array<{ team: { id: number } }> }>,
      fetch(`https://v3.football.api-sports.io/teams?search=${encodeURIComponent(awayTeam)}`, {
        headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      }).then(r => r.json()) as Promise<{ response: Array<{ team: { id: number } }> }>,
    ])

    if (!homeSearch.response.length || !awaySearch.response.length) return []
    const homeId = homeSearch.response[0].team.id
    const awayId = awaySearch.response[0].team.id

    const h2hRes = await fetch(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`,
      { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
    )
    const h2hData = await h2hRes.json() as {
      response: Array<{
        teams: { home: { id: number } }
        goals: { home: number | null; away: number | null }
      }>
    }

    return h2hData.response.map(f => {
      const homeGoals = f.goals.home ?? 0
      const awayGoals = f.goals.away ?? 0
      if (homeGoals === awayGoals) return 'D'
      return f.teams.home.id === homeId
        ? homeGoals > awayGoals ? 'H' : 'A'
        : awayGoals > homeGoals ? 'H' : 'A'
    })
  } catch {
    return []
  }
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

  console.log(`Fetching form data for ${fixturesWithOdds.length} fixtures...`)
  const fixturesWithForm: FixtureWithForm[] = await Promise.all(
    fixturesWithOdds.map(async ({ fixture, odds }) => {
      const [homeForm, awayForm, h2h] = await Promise.all([
        fetchTeamForm(fixture.home_team),
        fetchTeamForm(fixture.away_team),
        fetchH2H(fixture.home_team, fixture.away_team),
      ])
      homeForm.h2h = h2h
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
        homeForm,
        awayForm,
      }
    })
  )

  const output = { date: today, fixtures: fixturesWithForm }
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'pending-analysis.json'),
    JSON.stringify(output, null, 2)
  )
  console.log(`Written: data/pending-analysis.json (${fixturesWithForm.length} fixtures)`)
  console.log('Now ask Claude Code to analyse and generate the pick.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
