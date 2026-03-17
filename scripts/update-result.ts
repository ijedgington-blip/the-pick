import fs from 'fs'
import path from 'path'
import type { Pick, DailyBrief } from '../src/types/pick'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY!
const BASE_URL = 'https://v3.football.api-sports.io'

export function calculateReturn(result: 'win' | 'loss', odds: number, stake: number): number {
  return result === 'win' ? Math.round(stake * odds * 100) / 100 : 0
}

async function searchFixture(match: string, date: string): Promise<number | null> {
  const [home, away] = match.split(' vs ')
  const url = `${BASE_URL}/fixtures?date=${date}&search=${encodeURIComponent(home)}`
  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  })
  const data = await res.json() as { response: Array<{ fixture: { id: number }, teams: { home: { name: string }, away: { name: string } } }> }
  const fixture = data.response.find(f => {
    const h = f.teams.home.name.toLowerCase()
    const a = f.teams.away.name.toLowerCase()
    return h.includes(home.toLowerCase().trim()) || away.toLowerCase().trim().includes(a)
  })
  return fixture ? fixture.fixture.id : null
}

async function getFixtureResult(fixtureId: number): Promise<{ home: number; away: number; status: string } | null> {
  const res = await fetch(`${BASE_URL}/fixtures?id=${fixtureId}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  })
  const data = await res.json() as {
    response: Array<{
      fixture: { status: { short: string } }
      goals: { home: number | null; away: number | null }
    }>
  }
  if (!data.response.length) return null
  const f = data.response[0]
  return {
    home: f.goals.home ?? 0,
    away: f.goals.away ?? 0,
    status: f.fixture.status.short,
  }
}

export async function updateResult(pick: Pick): Promise<Pick> {
  if (pick.settled) return pick

  const fixtureId = await searchFixture(pick.match, pick.kickoff.split('T')[0])
  if (!fixtureId) {
    console.log(`Could not find fixture for: ${pick.match}`)
    return pick
  }

  const result = await getFixtureResult(fixtureId)
  if (!result || result.status !== 'FT') {
    console.log(`Fixture not finished yet (status: ${result?.status})`)
    return pick
  }

  const { home, away } = result
  let outcome: 'win' | 'loss'

  if (pick.pick === 'Home') {
    outcome = home > away ? 'win' : 'loss'
  } else if (pick.pick === 'Away') {
    outcome = away > home ? 'win' : 'loss'
  } else {
    outcome = home === away ? 'win' : 'loss'
  }

  return {
    ...pick,
    result: outcome,
    return: calculateReturn(outcome, pick.odds, 10),
    settled: true,
  }
}

export async function updateBriefResult(brief: DailyBrief): Promise<DailyBrief> {
  if (brief.picks.every(p => p.settled)) return brief

  // Settle each pick
  const updatedPicks = await Promise.all(brief.picks.map(p => updateResult(p)))

  // Derive acca result: win only if all picks win
  const allSettled = updatedPicks.every(p => p.settled)
  let accaResult: 'win' | 'loss' | null = null
  let accaReturn: number | null = null

  if (allSettled && brief.acca_available) {
    accaResult = updatedPicks.every(p => p.result === 'win') ? 'win' : 'loss'
    accaReturn = accaResult === 'win' && brief.acca_odds !== null
      ? Math.round(10 * brief.acca_odds * 100) / 100
      : 0
  }

  return {
    ...brief,
    picks: updatedPicks,
    acca_result: accaResult,
    acca_return: accaReturn,
  }
}

export async function updateYesterdaysResult(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  const filePath = path.join(process.cwd(), 'data', 'briefs', `${dateStr}.json`)

  if (!fs.existsSync(filePath)) {
    console.log(`No brief file for ${dateStr}`)
    return
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if ('no_pick' in raw && raw.no_pick) {
    console.log(`No pick day for ${dateStr}, skipping`)
    return
  }

  const brief = raw as DailyBrief
  if (brief.picks.every(p => p.settled)) {
    console.log(`${dateStr} already fully settled, skipping`)
    return
  }

  console.log(`Updating results for ${dateStr}...`)
  const updated = await updateBriefResult(brief)
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2))

  for (const p of updated.picks) {
    console.log(`  Pick ${p.rank}: ${p.pick_label} @ ${p.odds} → ${p.result ?? 'pending'}`)
  }
  if (updated.acca_available) {
    console.log(`  Acca (${updated.acca_odds}x): ${updated.acca_result ?? 'pending'} | Return: £${updated.acca_return ?? '-'}`)
  }
}
