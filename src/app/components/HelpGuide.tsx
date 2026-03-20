'use client'

import { useState } from 'react'

export default function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-5 right-5 z-50 font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded border transition-colors"
        style={{
          backgroundColor: isOpen ? '#1a1a1a' : '#1a1a1a',
          borderColor: isOpen ? '#d4a853' : '#262626',
          color: isOpen ? '#d4a853' : '#737373',
        }}
      >
        {isOpen ? '✕ close' : '? help'}
      </button>

      {isOpen && (
        <div className="fixed top-14 right-5 z-50 w-72 rounded border border-border bg-surface shadow-2xl p-5">
          <h3 className="font-mono text-xs uppercase tracking-widest text-accent mb-4">How to read the picks</h3>

          <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">

            <div>
              <p className="font-mono text-white mb-1">Edge %</p>
              <p>The gap between Ladbrokes' implied probability and our estimated true probability. An edge of +5% means we think the bet is 5 percentage points more likely to win than the bookmaker does. Positive edge = value. No edge = skip it.</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-mono text-white mb-1">Confidence</p>
              <div className="space-y-1.5">
                <p><span className="text-accent font-bold">High</span> — edge ≥ 8% with multiple factors all pointing the same way (form, injuries, H2H). Rare. Take notice.</p>
                <p><span className="text-amber-300 font-bold">Medium</span> — edge 4–7%, or good edge with one conflicting factor. Solid value, normal bet.</p>
                <p><span className="text-red-400 font-bold">Low</span> — edge &lt; 4%, or meaningful uncertainty despite the edge. Worth a look but tread carefully.</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-mono text-white mb-1">Kelly stake %</p>
              <p>Half-Kelly criterion — a formula that sizes your bet based on the edge and the odds. Higher edge at bigger odds = bigger suggested stake. Capped at 25% of bankroll. Treat it as a guide, not gospel.</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-mono text-white mb-1">Accumulator</p>
              <p>All picks combined into one bet. Higher reward, all legs must win. The single tracker (top pick only) is the safer long-term measure of performance.</p>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
