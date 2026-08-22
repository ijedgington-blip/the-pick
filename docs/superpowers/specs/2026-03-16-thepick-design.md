# The Pick — Design Spec
_2026-03-16_

## Overview

A football betting intelligence tool. Fetches today's EPL/European fixtures and Ladbrokes odds (via The Odds API), analyses for value using implied probability and team form (via API-Football), selects the single best bet of the day via Gemini, and publishes it to a Next.js site deployed on Vercel via GitHub. Maintains a running £10 pot tracker with automated result updates.

**Approach chosen:** Option A — local script, JSON data store, Vercel auto-deploy via GitHub push. No backend, no database, no cron automation (can be added later).

---

## Architecture & Data Flow

```
[Local machine — Gemini CLI session]
  ├─ Step A: Run scripts/fetch-data.ts
  │     ├─ 1. Load yesterday's JSON → fetch result from API-Football → update file
  │     ├─ 2. Fetch today's odds from The Odds API (6 sports, Ladbrokes only)
  │     ├─ 3. Fetch form/H2H from API-Football for each fixture
  │     └─ 4. Write data/pending-analysis.json (raw fixture data)
  │
  └─ Step B: Gemini CLI reads pending-analysis.json, performs value analysis,
             writes /data/briefs/YYYY-MM-DD.json, git commits and pushes

[GitHub: ijedgington-blip/the-pick] → triggers Vercel auto-deploy (~30s)

[Next.js on Vercel — fully static]
  ├─ / (home)     → reads today's JSON at build time
  └─ /history     → reads all JSONs, computes £10 pot tracker
```

Data store is flat JSON files in `/data/briefs/`. No database, no API routes. Site is fully static, rebuilt on every push.

---

## Scripts

### `scripts/fetch-data.ts`
Data-fetching script. Run with `npx ts-node scripts/fetch-data.ts`. Does NOT call Gemini — that step is performed by Gemini CLI directly.

1. **Update yesterday's result** — reads yesterday's date, loads its JSON. If `settled: false`, calls API-Football for the match result, calculates return (`stake * odds` for win, `0` for loss), updates the file with `result`, `return`, `settled: true`.
2. **Fetch today's fixtures** — calls The Odds API for each of 6 sports (`soccer_epl`, `soccer_efl_champ`, `soccer_uefa_champs_league`, `soccer_europa_league`, `soccer_germany_bundesliga`, `soccer_spain_la_liga`). Filters to fixtures with `commence_time` today (UTC). Extracts Ladbrokes odds only — skips fixtures not listed by Ladbrokes.
3. **Fetch form data** — for each remaining fixture, fetches last-5 results for both teams + H2H (last 5 meetings) from API-Football.
4. **Write `data/pending-analysis.json`** — saves the structured fixture + form data for Gemini CLI to analyse. If no Ladbrokes fixtures exist, writes `{ "no_fixtures": true }`.

### `scripts/update-result.ts`
Result-fetching logic extracted for clarity. Called internally by `fetch-data.ts`, not a standalone entry point. Accepts a pick JSON object, queries API-Football for the final score, returns the updated object.

### Gemini CLI analysis (not a script)
After `fetch-data.ts` runs, the user asks Gemini CLI to "generate today's pick". Gemini CLI reads `data/pending-analysis.json`, applies the value analysis logic (implied prob, estimated true prob, edge, half-Kelly), selects the best bet, writes `/data/briefs/YYYY-MM-DD.json`, and pushes to GitHub.

---

## JSON Schema

### Standard daily brief (top 3 picks)
```json
{
  "date": "2026-03-16",
  "picks": [
    {
      "rank": 1,
      "match": "Arsenal vs Chelsea",
      "league": "Premier League",
      "kickoff": "2026-03-16T15:00:00Z",
      "pick": "Home",
      "pick_label": "Arsenal to win",
      "odds": 2.10,
      "implied_prob": 47.6,
      "our_prob": 58.0,
      "edge": 10.4,
      "kelly_fraction": 0.049,
      "reasoning": "...",
      "confidence": "high",
      "result": null,
      "return": null,
      "settled": false
    },
    { "rank": 2, "...": "..." },
    { "rank": 3, "...": "..." }
  ],
  "acca_available": true,
  "acca_odds": 14.2,
  "acca_result": null,
  "acca_return": null
}
```

- `picks` contains 1–3 items sorted by edge descending
- `acca_available`: true if `picks.length >= 2`
- `acca_odds`: product of all pick odds; null if acca not available
- `acca_result`: `'win'` only if ALL picks win; `'loss'` if any pick loses; null if unsettled
- `acca_return`: £10 × acca_odds on win, 0 on loss, null if unsettled

### No-pick day
```json
{
  "date": "2026-03-16",
  "no_pick": true,
  "reason": "No fixtures with Ladbrokes odds today."
}
```

---

## Next.js Site

**Framework:** Next.js 14, App Router, TypeScript, Tailwind CSS. Fully static — JSON files read at build time via Node `fs` in server components. No `getServerSideProps`, no API routes.

### Home page `/`
- Reads today's JSON from `/data/briefs/YYYY-MM-DD.json`
- If file missing or `no_pick: true` → clear "No pick today" state
- Otherwise displays:
  - Header: "THE PICK" + today's date
  - Match name, league, kickoff time
  - Pick label (largest text on page)
  - Ladbrokes odds (large, clear)
  - Edge % and our estimated probability (secondary)
  - Reasoning paragraph
  - Confidence badge (`high` / `medium` / `low`) — `low` includes a caution warning
  - Kelly stake suggestion (e.g. "Suggested stake: 4.9% of bankroll")
- Link to History page
- Footer: "For entertainment only. Gamble responsibly. BeGambleAware.org"

### History page `/history`
- Reads all JSONs, sorts newest-first, filters out `no_pick` entries from table
- **£10 Pot Tracker** at top (excludes no-pick days from all calculations):
  - Starting pot: £10
  - Each settled win: pot += (stake * odds) - stake (stake = £10 flat)
  - Each settled loss: pot -= £10
  - Displays: current pot value, total picks made, win rate %, ROI %
  - Note: Kelly fraction in pick JSON is advisory display only — tracker always uses flat £10 stake
- Table columns: Date | Match | Pick | Odds | Result | Return
- Row tinting: subtle green tint (win), subtle red tint (loss), neutral (pending / no_pick)
- Footer: responsible gambling note

---

## Styling

- **Background:** `#0a0a0a`
- **Cards/surfaces:** `#111` / `#161616`
- **Accent:** muted amber/gold — single colour only
- **Typography:** display serif (Playfair Display) for the pick label; monospace for odds and numbers
- **No gradients, no glow effects, no green**
- Single-pixel low-contrast borders on cards

---

## Environment Variables

Stored in `.env.local` (never committed):

| Variable | Source |
|---|---|
| `ODDS_API_KEY` | The Odds API dashboard |
| `API_FOOTBALL_KEY` | API-Football dashboard |
| `GITHUB_TOKEN` | GitHub PAT (or use `gh` CLI auth) |
| `GITHUB_REPO` | `ijedgington-blip/the-pick` |
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Auto-populated from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Auto-populated from `.vercel/project.json` |
| ~~`ANTHROPIC_API_KEY`~~ | Not needed — Gemini CLI performs the analysis step directly |

---

## Project Structure

```
the-pick/
├── GEMINI.md
├── .env.local               # Never committed
├── .gitignore
├── data/
│   └── briefs/
│       └── YYYY-MM-DD.json
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-03-16-thepick-design.md
├── scripts/
│   ├── fetch-data.ts        # Fetches odds + form, writes data/pending-analysis.json
│   └── update-result.ts     # Result-fetching module (used by fetch-data.ts)
├── data/
│   └── pending-analysis.json  # Temp file written by fetch-data.ts, read by Gemini CLI
├── src/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       └── history/
│           └── page.tsx
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## Constraints & Rules

- Ladbrokes odds only — skip any fixture not listed by Ladbrokes
- One pick per day — single best value bet
- Never overwrite a `settled: true` file
- Kelly fractions capped at 0.25
- Minimum odds: 1.50 (skip lower)
- If no value bets: write `no_pick: true` JSON
- `confidence: low` picks display a caution warning on the site
