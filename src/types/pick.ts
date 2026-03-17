export interface Pick {
  rank: number              // 1, 2, or 3
  match: string
  league: string
  kickoff: string           // ISO timestamp
  pick: 'Home' | 'Draw' | 'Away'
  pick_label: string
  odds: number
  implied_prob: number
  our_prob: number
  edge: number
  kelly_fraction: number
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  result: 'win' | 'loss' | null
  return: number | null     // £ returned on £10 stake for this pick
  settled: boolean
}

export interface DailyBrief {
  date: string
  picks: Pick[]             // 1–3 items, sorted by edge desc
  acca_available: boolean   // picks.length >= 2
  acca_odds: number | null  // product of all pick odds; null if not available
  acca_result: 'win' | 'loss' | null
  acca_return: number | null  // £10 * acca_odds on win, 0 on loss
  no_pick?: false
}

export interface NoPick {
  date: string
  no_pick: true
  reason: string
}

export type BriefFile = DailyBrief | NoPick

export interface PotStats {
  currentPot: number
  totalBets: number
  wins: number
  losses: number
  winRate: number   // percentage
  roi: number       // percentage
}
