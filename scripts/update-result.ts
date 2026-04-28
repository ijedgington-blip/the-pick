import fs from 'fs'
import path from 'path'
import type { DailyBrief } from '../src/types/pick'

export function calculateReturn(result: 'win' | 'loss', odds: number, stake: number): number {
  return result === 'win' ? Math.round(stake * odds * 100) / 100 : 0
}

// Result settling is handled by Gemini CLI via WebSearch in the daily prompt.
// This function is kept as a no-op so fetch-data.ts can still call it.
export async function updateYesterdaysResult(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  const filePath = path.join(process.cwd(), 'data', 'briefs', `${dateStr}.json`)

  if (!fs.existsSync(filePath)) {
    console.log(`No brief file for ${dateStr} — skipping`)
    return
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if ('no_pick' in raw && raw.no_pick) return

  const brief = raw as DailyBrief
  if (brief.picks.every(p => p.settled)) {
    console.log(`${dateStr} already fully settled`)
    return
  }

  console.log(`${dateStr} results not yet settled — Gemini CLI will handle via WebSearch`)
}
