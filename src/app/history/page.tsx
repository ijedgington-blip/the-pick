import { readAllBriefs, sortBriefsNewestFirst, computeSinglePotStats, computeAccaPotStats } from '@/lib/picks'
import type { DailyBrief, PotStats } from '@/types/pick'
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'

function PotCard({ label, stats, subtitle }: { label: string; stats: PotStats; subtitle: string }) {
  return (
    <div className="rounded border border-border bg-surface p-5">
      <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-mono text-xs text-neutral-600 mb-4">{subtitle}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-xs text-neutral-500 mb-1">Pot</p>
          <p className={`font-mono text-xl font-bold ${stats.currentPot >= 10 ? 'text-accent' : 'text-red-400'}`}>
            £{stats.currentPot.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs text-neutral-500 mb-1">Bets</p>
          <p className="font-mono text-xl font-bold text-white">{stats.totalBets}</p>
        </div>
        <div>
          <p className="font-mono text-xs text-neutral-500 mb-1">Win Rate</p>
          <p className="font-mono text-xl font-bold text-white">{stats.winRate}%</p>
        </div>
        <div>
          <p className="font-mono text-xs text-neutral-500 mb-1">ROI</p>
          <p className={`font-mono text-xl font-bold ${stats.roi >= 0 ? 'text-accent' : 'text-red-400'}`}>
            {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const allBriefs = readAllBriefs()
  const sorted = sortBriefsNewestFirst(allBriefs)
  const singleStats = computeSinglePotStats(allBriefs)
  const accaStats = computeAccaPotStats(allBriefs)

  const realBriefs = sorted.filter((b): b is DailyBrief => !('no_pick' in b && b.no_pick))

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-10 flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-black tracking-tight text-white">History</h1>
        <Link href="/" className="font-mono text-xs text-neutral-500 hover:text-accent transition-colors uppercase tracking-widest">
          ← Today
        </Link>
      </div>

      {/* Dual pot tracker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <PotCard
          label="£10 Single Tracker"
          subtitle="£10 on top pick (#1) each day"
          stats={singleStats}
        />
        <PotCard
          label="£10 Acca Tracker"
          subtitle="£10 on all 3 as accumulator"
          stats={accaStats}
        />
      </div>

      {/* History table */}
      {realBriefs.length === 0 ? (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="font-mono text-neutral-500">No picks yet.</p>
        </div>
      ) : (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="font-mono text-xs text-neutral-500 text-left px-4 py-3 uppercase tracking-widest">Date</th>
                <th className="font-mono text-xs text-neutral-500 text-left px-4 py-3 uppercase tracking-widest">Top Pick</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest">Odds</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest">Single</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest hidden sm:table-cell">Acca</th>
                <th className="font-mono text-xs text-neutral-500 text-right px-4 py-3 uppercase tracking-widest hidden sm:table-cell">Acca Odds</th>
              </tr>
            </thead>
            <tbody>
              {realBriefs.map((brief) => {
                const top = brief.picks[0]
                const singleWin = top?.result === 'win'
                const singleLoss = top?.result === 'loss'
                const accaWin = brief.acca_result === 'win'
                const accaLoss = brief.acca_result === 'loss'
                const rowBg = singleWin ? 'bg-green-950/20' : singleLoss ? 'bg-red-950/20' : ''

                return (
                  <tr key={brief.date} className={`border-b border-border last:border-0 ${rowBg} hover:bg-white/[0.04] transition-colors cursor-pointer`}>
                    <td className="font-mono text-xs text-neutral-400 px-4 py-3 whitespace-nowrap">
                      <Link href={`/history/${brief.date}`} className="block w-full h-full">{brief.date}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/history/${brief.date}`} className="block">
                        <span className="text-neutral-200 text-xs block hover:text-white transition-colors">{top?.pick_label ?? '—'}</span>
                        <span className="font-mono text-xs text-neutral-500">{top?.match}</span>
                      </Link>
                    </td>
                    <td className="font-mono text-sm font-bold text-accent text-right px-4 py-3">
                      <Link href={`/history/${brief.date}`} className="block">{top?.odds}</Link>
                    </td>
                    <td className="font-mono text-xs text-right px-4 py-3">
                      <Link href={`/history/${brief.date}`} className="block">
                        {singleWin ? <span className="text-green-400 font-bold">WIN</span>
                          : singleLoss ? <span className="text-red-400 font-bold">LOSS</span>
                          : <span className="text-neutral-500">PENDING</span>}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-right px-4 py-3 hidden sm:table-cell">
                      <Link href={`/history/${brief.date}`} className="block">
                        {!brief.acca_available ? <span className="text-neutral-600">N/A</span>
                          : accaWin ? <span className="text-green-400 font-bold">WIN</span>
                          : accaLoss ? <span className="text-red-400 font-bold">LOSS</span>
                          : <span className="text-neutral-500">PENDING</span>}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-right px-4 py-3 hidden sm:table-cell text-neutral-400">
                      <Link href={`/history/${brief.date}`} className="block">
                        {brief.acca_available && brief.acca_odds ? brief.acca_odds.toFixed(2) : '—'}
                      </Link>
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
