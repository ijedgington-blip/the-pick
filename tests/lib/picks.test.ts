import {
  computeSinglePotStats,
  computeAccaPotStats,
  sortBriefsNewestFirst,
  getSeasonForDate,
  readBriefsForSeason,
  CURRENT_SEASON_ID,
  PREVIOUS_SEASON_ID,
  SEASONS,
} from '@/lib/picks'
import type { DailyBrief, NoPick } from '@/types/pick'

const makePick = (rank: number, odds: number, result: 'win' | 'loss' | null = null) => ({
  rank,
  match: 'Arsenal vs Chelsea',
  league: 'Premier League',
  kickoff: '2026-03-10T15:00:00Z',
  pick: 'Home' as const,
  pick_label: 'Arsenal to win',
  odds,
  implied_prob: 50,
  our_prob: 60,
  edge: 10,
  kelly_fraction: 0.1,
  reasoning: 'test',
  confidence: 'high' as const,
  result,
  return: result === 'win' ? odds * 10 : result === 'loss' ? 0 : null,
  settled: result !== null,
})

const makeBrief = (date: string, overrides: Partial<DailyBrief> = {}): DailyBrief => ({
  date,
  picks: [makePick(1, 2.0), makePick(2, 3.0), makePick(3, 2.5)],
  acca_available: true,
  acca_odds: 15.0,
  acca_result: null,
  acca_return: null,
  ...overrides,
})

const noPick: NoPick = { date: '2026-03-11', no_pick: true, reason: 'No fixtures' }

describe('sortBriefsNewestFirst', () => {
  it('sorts briefs newest first', () => {
    const briefs = [makeBrief('2026-03-09'), makeBrief('2026-03-11'), makeBrief('2026-03-10')]
    const sorted = sortBriefsNewestFirst(briefs)
    expect(sorted.map(b => b.date)).toEqual(['2026-03-11', '2026-03-10', '2026-03-09'])
  })

  it('handles mix of DailyBrief and NoPick', () => {
    const sorted = sortBriefsNewestFirst([makeBrief('2026-03-09'), noPick])
    expect(sorted[0].date).toBe('2026-03-11')
    expect(sorted[1].date).toBe('2026-03-09')
    expect(sorted).toHaveLength(2)
  })
})

describe('getSeasonForDate', () => {
  it('returns 2026-27 for dates on or after 2026-08-22', () => {
    expect(getSeasonForDate('2026-08-22')).toBe('2026-27')
    expect(getSeasonForDate('2026-08-23')).toBe('2026-27')
    expect(getSeasonForDate('2026-09-01')).toBe('2026-27')
  })

  it('returns 2025-26 for dates before 2026-08-22', () => {
    expect(getSeasonForDate('2026-08-21')).toBe('2025-26')
    expect(getSeasonForDate('2026-03-17')).toBe('2025-26')
    expect(getSeasonForDate('2026-05-15')).toBe('2025-26')
  })
})

describe('Season definitions', () => {
  it('defines current and previous season metadata', () => {
    expect(CURRENT_SEASON_ID).toBe('2026-27')
    expect(PREVIOUS_SEASON_ID).toBe('2025-26')
    expect(SEASONS['2026-27'].isCurrent).toBe(true)
    expect(SEASONS['2025-26'].isCurrent).toBe(false)
  })
})

describe('computeSinglePotStats', () => {
  it('starts with £10 pot', () => {
    const stats = computeSinglePotStats([])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalBets).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.roi).toBe(0)
  })

  it('uses picks[0] only — win at odds 2.0 adds £10 profit', () => {
    const brief = makeBrief('2026-03-10', {
      picks: [makePick(1, 2.0, 'win'), makePick(2, 3.0, 'loss'), makePick(3, 2.5, 'loss')],
    })
    const stats = computeSinglePotStats([brief])
    expect(stats.currentPot).toBe(20)
    expect(stats.wins).toBe(1)
    expect(stats.losses).toBe(0)
  })

  it('uses picks[0] only — loss deducts £10', () => {
    const brief = makeBrief('2026-03-10', {
      picks: [makePick(1, 2.0, 'loss'), makePick(2, 3.0, 'win'), makePick(3, 2.5, 'win')],
    })
    const stats = computeSinglePotStats([brief])
    expect(stats.currentPot).toBe(0)
    expect(stats.losses).toBe(1)
  })

  it('ignores no-pick days', () => {
    const stats = computeSinglePotStats([noPick])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalBets).toBe(0)
  })

  it('ignores unsettled picks in pot calculation but counts as a bet', () => {
    const brief = makeBrief('2026-03-10', {
      picks: [makePick(1, 2.0, null)],
    })
    const stats = computeSinglePotStats([brief])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalBets).toBe(1)
  })
})

describe('computeAccaPotStats', () => {
  it('starts with £10 pot', () => {
    const stats = computeAccaPotStats([])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalBets).toBe(0)
  })

  it('win: adds £10 * acca_odds profit', () => {
    const brief = makeBrief('2026-03-10', { acca_result: 'win', acca_return: 150, acca_odds: 15.0 })
    const stats = computeAccaPotStats([brief])
    expect(stats.currentPot).toBe(150)
    expect(stats.wins).toBe(1)
  })

  it('loss: deducts £10', () => {
    const brief = makeBrief('2026-03-10', { acca_result: 'loss', acca_return: 0 })
    const stats = computeAccaPotStats([brief])
    expect(stats.currentPot).toBe(0)
    expect(stats.losses).toBe(1)
  })

  it('ignores days where acca not available', () => {
    const brief = makeBrief('2026-03-10', { acca_available: false, acca_odds: null, acca_result: null })
    const stats = computeAccaPotStats([brief])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalBets).toBe(0)
  })

  it('ignores no-pick days', () => {
    const stats = computeAccaPotStats([noPick])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalBets).toBe(0)
  })
})
