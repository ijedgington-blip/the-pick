import Link from 'next/link'
import { CURRENT_SEASON_ID, PREVIOUS_SEASON_ID } from '@/lib/picks'

interface SeasonTabsProps {
  activeSeasonId: string
}

export default function SeasonTabs({ activeSeasonId }: SeasonTabsProps) {
  return (
    <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
      <Link
        href="/history"
        className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-colors ${
          activeSeasonId === CURRENT_SEASON_ID
            ? 'bg-accent/15 text-accent border border-accent/40 font-bold'
            : 'text-neutral-400 hover:text-white hover:bg-surface border border-transparent'
        }`}
      >
        2026–27 (Current)
      </Link>
      <Link
        href="/history/2025-26"
        className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-colors ${
          activeSeasonId === PREVIOUS_SEASON_ID
            ? 'bg-accent/15 text-accent border border-accent/40 font-bold'
            : 'text-neutral-400 hover:text-white hover:bg-surface border border-transparent'
        }`}
      >
        2025–26 (Archive)
      </Link>
    </div>
  )
}
