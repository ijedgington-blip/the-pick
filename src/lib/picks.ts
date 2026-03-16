import fs from 'fs'
import path from 'path'
import type { Pick, NoPick, PickFile, PotStats } from '@/types/pick'

const BRIEFS_DIR = path.join(process.cwd(), 'data', 'briefs')
const STAKE = 10

export function readAllPicks(): PickFile[] {
  if (!fs.existsSync(BRIEFS_DIR)) return []
  const files = fs.readdirSync(BRIEFS_DIR).filter(f => f.endsWith('.json'))
  return files.map(f => JSON.parse(fs.readFileSync(path.join(BRIEFS_DIR, f), 'utf-8')) as PickFile)
}

export function readTodaysPick(date: string): PickFile | null {
  const filePath = path.join(BRIEFS_DIR, `${date}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PickFile
}

export function sortPicksNewestFirst(picks: PickFile[]): PickFile[] {
  return [...picks].sort((a, b) => b.date.localeCompare(a.date))
}

export function computePotStats(picks: PickFile[]): PotStats {
  const realPicks = picks.filter((p): p is Pick => !('no_pick' in p && p.no_pick))
  let pot = STAKE
  let wins = 0
  let losses = 0
  let totalStaked = 0

  for (const pick of realPicks) {
    if (!pick.settled) continue
    totalStaked += STAKE
    if (pick.result === 'win') {
      pot += (pick.odds - 1) * STAKE
      wins++
    } else if (pick.result === 'loss') {
      pot -= STAKE
      losses++
    }
  }

  const totalPicks = realPicks.length
  const settledPicks = wins + losses
  const roi = totalStaked > 0 ? ((pot - STAKE) / totalStaked) * 100 : 0

  return {
    currentPot: Math.round(pot * 100) / 100,
    totalPicks,
    wins,
    losses,
    winRate: settledPicks > 0 ? Math.round((wins / settledPicks) * 100) : 0,
    roi: Math.round(roi * 10) / 10,
  }
}
