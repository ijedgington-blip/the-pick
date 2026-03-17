import fs from 'fs'
import path from 'path'
import type { DailyBrief, NoPick, BriefFile, PotStats } from '@/types/pick'

const BRIEFS_DIR = path.join(process.cwd(), 'data', 'briefs')
const STAKE = 10

export function readAllBriefs(): BriefFile[] {
  if (!fs.existsSync(BRIEFS_DIR)) return []
  const files = fs.readdirSync(BRIEFS_DIR).filter(f => f.endsWith('.json'))
  return files.map(f => JSON.parse(fs.readFileSync(path.join(BRIEFS_DIR, f), 'utf-8')) as BriefFile)
}

export function readTodaysBrief(date: string): BriefFile | null {
  const filePath = path.join(BRIEFS_DIR, `${date}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BriefFile
}

export function sortBriefsNewestFirst(briefs: BriefFile[]): BriefFile[] {
  return [...briefs].sort((a, b) => b.date.localeCompare(a.date))
}

function isDailyBrief(b: BriefFile): b is DailyBrief {
  return !('no_pick' in b && b.no_pick)
}

export function computeSinglePotStats(briefs: BriefFile[]): PotStats {
  const realBriefs = briefs.filter(isDailyBrief)
  let pot = STAKE
  let wins = 0
  let losses = 0
  let totalStaked = 0

  for (const brief of realBriefs) {
    const top = brief.picks[0]
    if (!top || !top.settled) continue
    totalStaked += STAKE
    if (top.result === 'win') {
      pot += (top.odds - 1) * STAKE
      wins++
    } else if (top.result === 'loss') {
      pot -= STAKE
      losses++
    }
  }

  const settledBets = wins + losses
  return {
    currentPot: Math.round(pot * 100) / 100,
    totalBets: realBriefs.length,
    wins,
    losses,
    winRate: settledBets > 0 ? Math.round((wins / settledBets) * 100) : 0,
    roi: totalStaked > 0 ? Math.round(((pot - STAKE) / totalStaked) * 1000) / 10 : 0,
  }
}

export function computeAccaPotStats(briefs: BriefFile[]): PotStats {
  const accaBriefs = briefs.filter(isDailyBrief).filter(b => b.acca_available)
  let pot = STAKE
  let wins = 0
  let losses = 0
  let totalStaked = 0

  for (const brief of accaBriefs) {
    if (brief.acca_result === null || brief.acca_odds === null) continue
    totalStaked += STAKE
    if (brief.acca_result === 'win') {
      pot += (brief.acca_odds - 1) * STAKE
      wins++
    } else {
      pot -= STAKE
      losses++
    }
  }

  const settledBets = wins + losses
  return {
    currentPot: Math.round(pot * 100) / 100,
    totalBets: accaBriefs.length,
    wins,
    losses,
    winRate: settledBets > 0 ? Math.round((wins / settledBets) * 100) : 0,
    roi: totalStaked > 0 ? Math.round(((pot - STAKE) / totalStaked) * 1000) / 10 : 0,
  }
}
