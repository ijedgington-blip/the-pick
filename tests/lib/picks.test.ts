import { computePotStats, sortPicksNewestFirst } from '@/lib/picks'
import type { Pick, NoPick } from '@/types/pick'

const makePick = (overrides: Partial<Pick>): Pick => ({
  date: '2026-03-10',
  match: 'Arsenal vs Chelsea',
  league: 'Premier League',
  kickoff: '2026-03-10T15:00:00Z',
  pick: 'Home',
  pick_label: 'Arsenal to win',
  odds: 2.0,
  implied_prob: 50,
  our_prob: 60,
  edge: 10,
  kelly_fraction: 0.1,
  reasoning: 'test',
  confidence: 'high',
  result: null,
  return: null,
  settled: false,
  ...overrides,
})

const noPick: NoPick = { date: '2026-03-11', no_pick: true, reason: 'No fixtures' }

describe('sortPicksNewestFirst', () => {
  it('sorts picks newest first by date', () => {
    const picks = [
      makePick({ date: '2026-03-09' }),
      makePick({ date: '2026-03-11' }),
      makePick({ date: '2026-03-10' }),
    ]
    const sorted = sortPicksNewestFirst(picks)
    expect(sorted.map(p => p.date)).toEqual(['2026-03-11', '2026-03-10', '2026-03-09'])
  })

  it('handles a mix of Pick and NoPick, sorting by date correctly', () => {
    const picks = [makePick({ date: '2026-03-09' }), noPick] // noPick has date '2026-03-11'
    const sorted = sortPicksNewestFirst(picks)
    expect(sorted[0].date).toBe('2026-03-11') // NoPick comes first (newer)
    expect(sorted[1].date).toBe('2026-03-09') // Pick comes second (older)
    expect(sorted).toHaveLength(2)
  })
})

describe('computePotStats', () => {
  it('starts with £10 pot and no picks', () => {
    const stats = computePotStats([])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalPicks).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.roi).toBe(0)
  })

  it('adds winnings for a settled win (odds 2.0, stake £10)', () => {
    const pick = makePick({ odds: 2.0, result: 'win', return: 20, settled: true })
    const stats = computePotStats([pick])
    expect(stats.currentPot).toBe(20)
    expect(stats.wins).toBe(1)
    expect(stats.losses).toBe(0)
    expect(stats.winRate).toBe(100)
  })

  it('deducts stake for a settled loss', () => {
    const pick = makePick({ result: 'loss', return: 0, settled: true })
    const stats = computePotStats([pick])
    expect(stats.currentPot).toBe(0)
    expect(stats.wins).toBe(0)
    expect(stats.losses).toBe(1)
  })

  it('ignores unsettled picks in pot calculation', () => {
    const pick = makePick({ result: null, settled: false })
    const stats = computePotStats([pick])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalPicks).toBe(1)
  })

  it('ignores no-pick days entirely', () => {
    const stats = computePotStats([noPick])
    expect(stats.currentPot).toBe(10)
    expect(stats.totalPicks).toBe(0)
  })

  it('computes ROI correctly across wins and losses', () => {
    const picks = [
      makePick({ odds: 2.0, result: 'win', return: 20, settled: true }),
      makePick({ date: '2026-03-09', result: 'loss', return: 0, settled: true }),
    ]
    const stats = computePotStats(picks)
    expect(stats.currentPot).toBe(10)
    expect(stats.roi).toBe(0)
    expect(stats.winRate).toBe(50)
  })
})
