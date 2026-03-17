import { readTodaysBrief } from '@/lib/picks'
import Link from 'next/link'
import type { Pick } from '@/types/pick'

function toFractional(decimal: number): string {
  const value = decimal - 1
  // Try denominators 1–20 to find a clean fraction
  for (let d = 1; d <= 20; d++) {
    const n = Math.round(value * d)
    if (Math.abs(n / d - value) < 0.01) {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
      const g = gcd(n, d)
      const num = n / g, den = d / g
      return den === 1 ? `${num}/1` : `${num}/${den}`
    }
  }
  // Fallback: round to nearest whole fraction
  return `${Math.round(value)}/1`
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-accent/10 text-accent border-accent/30',
    medium: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
    low: 'bg-red-400/10 text-red-300 border-red-400/30',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded border text-xs font-mono uppercase tracking-widest ${styles[level]}`}>
      {level} confidence
    </span>
  )
}

function PickCard({ pick, featured }: { pick: Pick; featured: boolean }) {
  return (
    <div className={`rounded border ${featured ? 'border-accent/20 bg-surface-2' : 'border-border bg-surface'} p-6`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs text-neutral-600 uppercase tracking-widest">#{pick.rank}</span>
        <span className="font-mono text-xs text-accent uppercase tracking-widest">{pick.league}</span>
        <span className="font-mono text-xs text-neutral-500">
          {new Date(pick.kickoff).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="font-mono text-xs text-neutral-500 mb-2">{pick.match}</p>
      <p className={`font-display font-black text-white leading-tight mb-3 ${featured ? 'text-4xl' : 'text-2xl'}`}>
        {pick.pick_label}
      </p>
      <div className="flex items-baseline gap-3 mb-3">
        <span className={`font-mono font-bold text-accent ${featured ? 'text-2xl' : 'text-xl'}`}>{toFractional(pick.odds)}</span>
        <span className="font-mono text-xs text-neutral-600">({pick.odds})</span>
        <span className="font-mono text-xs text-neutral-500">Ladbrokes</span>
        <span className="font-mono text-xs text-neutral-500">edge +{pick.edge.toFixed(1)}%</span>
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        <ConfidenceBadge level={pick.confidence} />
        {pick.confidence === 'low' && (
          <span className="inline-flex items-center px-3 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono">
            ⚠ Proceed with caution
          </span>
        )}
      </div>
      <p className={`leading-relaxed mt-3 ${featured ? 'text-neutral-300 text-sm' : 'text-neutral-500 text-xs'}`}>{pick.reasoning}</p>
    </div>
  )
}

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0]
  const brief = readTodaysBrief(today)

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-12">
        <h1 className="font-display text-4xl font-black tracking-tight text-white">THE PICK</h1>
        <p className="font-mono text-sm text-neutral-500 mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {!brief ? (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="text-neutral-400 font-mono">No picks today yet.</p>
          <p className="text-neutral-600 font-mono text-sm mt-2">Check back later.</p>
        </div>
      ) : 'no_pick' in brief && brief.no_pick ? (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="text-neutral-400 font-mono">No picks today.</p>
          <p className="text-neutral-500 text-sm mt-2">{brief.reason}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top pick — featured */}
          {brief.picks[0] && <PickCard pick={brief.picks[0]} featured={true} />}

          {/* Picks 2 and 3 */}
          {brief.picks.slice(1).map(pick => (
            <PickCard key={pick.rank} pick={pick} featured={false} />
          ))}

          {/* Accumulator */}
          {brief.acca_available && brief.acca_odds !== null && (
            <div className="rounded border border-border bg-surface p-4">
              <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-2">Accumulator</p>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-2xl font-bold text-accent">{toFractional(brief.acca_odds)}</span>
                <span className="font-mono text-xs text-neutral-600">({brief.acca_odds.toFixed(2)})</span>
                <span className="font-mono text-sm text-neutral-500">combined odds</span>
              </div>
              <p className="font-mono text-xs text-neutral-600 mt-1">
                All {brief.picks.length} picks combined · Returns £{(10 * brief.acca_odds).toFixed(2)} on £10 stake
              </p>
            </div>
          )}

          {/* Kelly for top pick */}
          <div className="rounded border border-border bg-surface p-4">
            <p className="font-mono text-xs text-neutral-500">
              Top pick suggested stake:{' '}
              <span className="text-accent font-bold">
                {(brief.picks[0]!.kelly_fraction * 100).toFixed(1)}% of bankroll
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-10">
        <Link href="/history" className="font-mono text-xs text-neutral-500 hover:text-accent transition-colors uppercase tracking-widest">
          View history →
        </Link>
      </div>
    </div>
  )
}
