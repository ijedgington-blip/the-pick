import { readTodaysBrief, readAllBriefs } from '@/lib/picks'
import type { Pick, DailyBrief } from '@/types/pick'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const briefs = readAllBriefs()
  return briefs.map(b => ({ date: b.date }))
}

function toFractional(decimal: number): string {
  const value = decimal - 1
  for (let d = 1; d <= 20; d++) {
    const n = Math.round(value * d)
    if (Math.abs(n / d - value) < 0.01) {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
      const g = gcd(n, d)
      const num = n / g, den = d / g
      return den === 1 ? `${num}/1` : `${num}/${den}`
    }
  }
  return `${Math.round(value)}/1`
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-accent/10 text-accent border-accent/30',
    medium: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
    low: 'bg-red-400/10 text-red-300 border-red-400/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono uppercase tracking-widest ${styles[level]}`}>
      {level}
    </span>
  )
}

function ResultBadge({ result }: { result: 'win' | 'loss' | null }) {
  if (result === 'win') return <span className="font-mono text-xs font-bold text-green-400 uppercase tracking-widest">WIN</span>
  if (result === 'loss') return <span className="font-mono text-xs font-bold text-red-400 uppercase tracking-widest">LOSS</span>
  return <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest">Pending</span>
}

function PickCard({ pick }: { pick: Pick }) {
  const isWin = pick.result === 'win'
  const isLoss = pick.result === 'loss'
  const borderColor = isWin ? 'border-green-800/40' : isLoss ? 'border-red-900/40' : 'border-border'
  const bgColor = isWin ? 'bg-green-950/20' : isLoss ? 'bg-red-950/20' : 'bg-surface'

  return (
    <div className={`rounded border ${borderColor} ${bgColor} p-6`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-neutral-600 uppercase tracking-widest">#{pick.rank}</span>
            <span className="font-mono text-xs text-accent uppercase tracking-widest">{pick.league}</span>
            <span className="font-mono text-xs text-neutral-500">
              {new Date(pick.kickoff).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="font-mono text-xs text-neutral-500">{pick.match}</p>
        </div>
        <ResultBadge result={pick.result} />
      </div>

      <p className="font-display text-2xl font-black text-white leading-tight mb-3">
        {pick.pick_label}
      </p>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-mono text-xl font-bold text-accent">{toFractional(pick.odds)}</span>
        <span className="font-mono text-xs text-neutral-600">({pick.odds})</span>
        <span className="font-mono text-xs text-neutral-500">Ladbrokes</span>
        <span className="font-mono text-xs text-neutral-500">edge +{pick.edge.toFixed(1)}%</span>
        <ConfidenceBadge level={pick.confidence} />
      </div>

      <p className="text-neutral-300 text-sm leading-relaxed border-t border-border pt-4">
        {pick.reasoning}
      </p>

      {pick.settled && (
        <p className="font-mono text-xs text-neutral-500 mt-3">
          Return: <span className={pick.result === 'win' ? 'text-green-400 font-bold' : 'text-red-400'}>
            £{pick.return?.toFixed(2) ?? '0.00'}
          </span> on £10 stake
        </p>
      )}
    </div>
  )
}

export default function BriefPage({ params }: { params: { date: string } }) {
  const brief = readTodaysBrief(params.date)
  if (!brief) notFound()

  const formatted = new Date(params.date).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  if ('no_pick' in brief && brief.no_pick) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight text-white">The Pick</h1>
            <p className="font-mono text-sm text-neutral-500 mt-1">{formatted}</p>
          </div>
          <Link href="/history" className="font-mono text-xs text-neutral-500 hover:text-accent transition-colors uppercase tracking-widest">
            ← History
          </Link>
        </div>
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="font-mono text-neutral-400">No pick this day.</p>
          <p className="font-mono text-neutral-600 text-sm mt-2">{brief.reason}</p>
        </div>
      </div>
    )
  }

  const db = brief as DailyBrief

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-white">The Pick</h1>
          <p className="font-mono text-sm text-neutral-500 mt-1">{formatted}</p>
        </div>
        <Link href="/history" className="font-mono text-xs text-neutral-500 hover:text-accent transition-colors uppercase tracking-widest">
          ← History
        </Link>
      </div>

      <div className="space-y-4">
        {db.picks.map(pick => (
          <PickCard key={pick.rank} pick={pick} />
        ))}

        {db.acca_available && db.acca_odds !== null && (
          <div className={`rounded border p-5 ${db.acca_result === 'win' ? 'border-green-800/40 bg-green-950/20' : db.acca_result === 'loss' ? 'border-red-900/40 bg-red-950/20' : 'border-border bg-surface'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest">Accumulator</p>
              <ResultBadge result={db.acca_result} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-bold text-accent">{toFractional(db.acca_odds)}</span>
              <span className="font-mono text-xs text-neutral-600">({db.acca_odds.toFixed(2)})</span>
              <span className="font-mono text-sm text-neutral-500">combined · £{(10 * db.acca_odds).toFixed(2)} on £10</span>
            </div>
            {db.acca_result !== null && (
              <p className="font-mono text-xs text-neutral-500 mt-2">
                Return: <span className={db.acca_result === 'win' ? 'text-green-400 font-bold' : 'text-red-400'}>
                  £{db.acca_return?.toFixed(2) ?? '0.00'}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
