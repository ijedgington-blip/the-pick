export interface Pick {
  date: string           // YYYY-MM-DD
  match: string          // "Arsenal vs Chelsea"
  league: string
  kickoff: string        // ISO timestamp
  pick: 'Home' | 'Draw' | 'Away'
  pick_label: string     // "Arsenal to win"
  odds: number
  implied_prob: number   // percentage e.g. 47.6
  our_prob: number       // percentage
  edge: number           // our_prob - implied_prob
  kelly_fraction: number // capped at 0.25
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  result: 'win' | 'loss' | null
  return: number | null  // pounds returned on £10 stake
  settled: boolean
  no_pick?: false
}

export interface NoPick {
  date: string
  no_pick: true
  reason: string
}

export type PickFile = Pick | NoPick

export interface PotStats {
  currentPot: number    // current pot value in £
  totalPicks: number    // number of picks made (excludes no-pick days)
  wins: number
  losses: number
  winRate: number       // percentage
  roi: number           // percentage
}
