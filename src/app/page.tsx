import { readTodaysPick } from '@/lib/picks'
import Link from 'next/link'

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

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0]
  const pick = readTodaysPick(today)

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-display text-4xl font-black tracking-tight text-white">THE PICK</h1>
        <p className="font-mono text-sm text-neutral-500 mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {!pick ? (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="text-neutral-400 font-mono">No pick today yet.</p>
          <p className="text-neutral-600 font-mono text-sm mt-2">Check back later.</p>
        </div>
      ) : 'no_pick' in pick && pick.no_pick ? (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="text-neutral-400 font-mono">No pick today.</p>
          <p className="text-neutral-500 text-sm mt-2">{pick.reason}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Match info */}
          <div className="rounded border border-border bg-surface p-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xs text-accent uppercase tracking-widest">{pick.league}</span>
              <span className="font-mono text-xs text-neutral-500">
                {new Date(pick.kickoff).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="font-mono text-sm text-neutral-400">{pick.match}</p>
          </div>

          {/* The pick */}
          <div className="rounded border border-accent/20 bg-surface-2 p-8">
            <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-3">Today&apos;s bet</p>
            <p className="font-display text-5xl font-black text-white leading-tight mb-4">
              {pick.pick_label}
            </p>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="font-mono text-3xl font-bold text-accent">{pick.odds}</span>
              <span className="font-mono text-sm text-neutral-500">Ladbrokes</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <ConfidenceBadge level={pick.confidence} />
              {pick.confidence === 'low' && (
                <span className="inline-flex items-center px-3 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono">
                  ⚠ Proceed with caution
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded border border-border bg-surface p-4">
              <p className="font-mono text-xs text-neutral-500 mb-1">Edge</p>
              <p className="font-mono text-xl font-bold text-white">+{pick.edge.toFixed(1)}%</p>
            </div>
            <div className="rounded border border-border bg-surface p-4">
              <p className="font-mono text-xs text-neutral-500 mb-1">Our prob</p>
              <p className="font-mono text-xl font-bold text-white">{pick.our_prob.toFixed(1)}%</p>
            </div>
            <div className="rounded border border-border bg-surface p-4">
              <p className="font-mono text-xs text-neutral-500 mb-1">Implied</p>
              <p className="font-mono text-xl font-bold text-neutral-400">{pick.implied_prob.toFixed(1)}%</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="rounded border border-border bg-surface p-6">
            <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-3">Reasoning</p>
            <p className="text-neutral-300 leading-relaxed text-sm">{pick.reasoning}</p>
          </div>

          {/* Kelly */}
          <div className="rounded border border-border bg-surface p-4">
            <p className="font-mono text-xs text-neutral-500">
              Suggested stake:{' '}
              <span className="text-accent font-bold">
                {(pick.kelly_fraction * 100).toFixed(1)}% of bankroll
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-10">
        <Link
          href="/history"
          className="font-mono text-xs text-neutral-500 hover:text-accent transition-colors uppercase tracking-widest"
        >
          View history →
        </Link>
      </div>
    </div>
  )
}
