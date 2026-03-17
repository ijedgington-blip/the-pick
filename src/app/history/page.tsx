import { readAllPicks, sortPicksNewestFirst, computePotStats } from '@/lib/picks'
import type { Pick } from '@/types/pick'
import Link from 'next/link'

export default function HistoryPage() {
  const allPicks = readAllPicks()
  const sorted = sortPicksNewestFirst(allPicks)
  const stats = computePotStats(allPicks)

  const realPicks = sorted.filter((p): p is Pick => !('no_pick' in p && p.no_pick))

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-black tracking-tight text-white">History</h1>
        <Link href="/" className="font-mono text-xs text-neutral-500 hover:text-accent transition-colors uppercase tracking-widest">
          ← Today
        </Link>
      </div>

      {/* £10 Pot Tracker */}
      <div className="rounded border border-border bg-surface p-6 mb-10">
        <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-5">£10 Pot Tracker</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="font-mono text-xs text-neutral-500 mb-1">Current Pot</p>
            <p className={`font-mono text-2xl font-bold ${stats.currentPot >= 10 ? 'text-accent' : 'text-red-400'}`}>
              £{stats.currentPot.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-neutral-500 mb-1">Total Picks</p>
            <p className="font-mono text-2xl font-bold text-white">{stats.totalPicks}</p>
          </div>
          <div>
            <p className="font-mono text-xs text-neutral-500 mb-1">Win Rate</p>
            <p className="font-mono text-2xl font-bold text-white">{stats.winRate}%</p>
          </div>
          <div>
            <p className="font-mono text-xs text-neutral-500 mb-1">ROI</p>
            <p className={`font-mono text-2xl font-bold ${stats.roi >= 0 ? 'text-accent' : 'text-red-400'}`}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      {realPicks.length === 0 ? (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="font-mono text-neutral-500">No picks yet.</p>
        </div>
      ) : (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="font-mono text-xs text-neutral-500 text-left px-4 py-3 uppercase tracking-widest">Date</th>
                <th className="font-mono text-xs text-neutral-500 text-left px-4 py-3 uppercase tracking-widest">Match</th>
                <th className="font-mono text-xs text-neutral-500 text-left px-4 py-3 uppercase tracking-widest hidden sm:table-cell">Pick</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest">Odds</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest">Result</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest hidden sm:table-cell">Return</th>
              </tr>
            </thead>
            <tbody>
              {realPicks.map((pick) => {
                const isWin = pick.result === 'win'
                const isLoss = pick.result === 'loss'
                const rowBg = isWin
                  ? 'bg-green-950/20'
                  : isLoss
                  ? 'bg-red-950/20'
                  : ''
                return (
                  <tr
                    key={pick.date}
                    className={`border-b border-border last:border-0 ${rowBg} hover:bg-white/[0.02] transition-colors`}
                  >
                    <td className="font-mono text-xs text-neutral-400 px-4 py-3 whitespace-nowrap">{pick.date}</td>
                    <td className="px-4 py-3">
                      <span className="text-neutral-200 text-xs">{pick.match}</span>
                      <span className="block font-mono text-xs text-neutral-500">{pick.league}</span>
                    </td>
                    <td className="font-mono text-xs text-neutral-300 px-4 py-3 hidden sm:table-cell">{pick.pick_label}</td>
                    <td className="font-mono text-sm font-bold text-accent text-right px-4 py-3">{pick.odds}</td>
                    <td className="font-mono text-xs text-right px-4 py-3">
                      {pick.result === 'win' ? (
                        <span className="text-green-400 font-bold">WIN</span>
                      ) : pick.result === 'loss' ? (
                        <span className="text-red-400 font-bold">LOSS</span>
                      ) : (
                        <span className="text-neutral-500">PENDING</span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-right px-4 py-3 hidden sm:table-cell">
                      {pick.return !== null ? (
                        <span className={pick.result === 'win' ? 'text-green-400' : 'text-red-400'}>
                          £{pick.return.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
