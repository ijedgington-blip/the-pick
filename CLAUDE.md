# The Pick — CLAUDE.md

A football betting intelligence tool. Fetches today's EPL/European fixtures and odds from Ladbrokes (via The Odds API), analyses for value using implied probability and team form (via API-Football), selects the single best bet of the day, and publishes it to a Next.js site deployed on Vercel via GitHub. Maintains a running £10 pot tracker with automated result updates.

---


## hpg3 Setup — Read This First

This is a **migrated copy** from another machine. The project and GitHub repo already exist. Do NOT create a new GitHub repo or a new Vercel project.

### Current state on this machine
- **GitHub repo**: `https://github.com/ijedgington-blip/the-pick.git` (already set as `origin`)
- **Node.js**: v18.19.1 / npm 9.2.0
- **`node_modules`**: not installed yet — run `npm install` first
- **`.env.local`**: does not exist — must be created before running any scripts
- **`.vercel/project.json`**: does not exist — Vercel setup required (see below)
- **`ts-node`**: not installed globally — use `npx ts-node` (comes via `npm install` from devDependencies)

### First-time setup on this machine

1. **Create `.env.local`** — ask the user to provide all keys, then write them:
   ```
   ODDS_API_KEY=...
   API_FOOTBALL_KEY=...
   GITHUB_TOKEN=...          # PAT with repo write access
   GITHUB_REPO=ijedgington-blip/the-pick
   VERCEL_TOKEN=...
   VERCEL_ORG_ID=...         # see below
   VERCEL_PROJECT_ID=...     # see below
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Link to the existing Vercel project** (do NOT run `vercel --prod`, that creates a new project):
   ```bash
   vercel link --token=$VERCEL_TOKEN --yes
   ```
   This writes `.vercel/project.json`. Then extract the IDs and add to `.env.local`:
   ```bash
   cat .vercel/project.json
   # orgId → VERCEL_ORG_ID, projectId → VERCEL_PROJECT_ID
   ```
   If the user doesn't know the Vercel project name, they can list their projects:
   ```bash
   vercel list --token=$VERCEL_TOKEN
   ```

4. **Verify git push works**:
   ```bash
   git push
   ```
   The GITHUB_TOKEN may need to be set as a credential. If push fails with auth error, configure:
   ```bash
   git remote set-url origin https://$GITHUB_TOKEN@github.com/ijedgington-blip/the-pick.git
   ```

5. **Test the daily script**:
   ```bash
   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/fetch-data.ts
   ```

### Value analysis — no Anthropic API key needed

The analysis step (Step 4 in the daily pick script) is performed **directly by Claude Code** in the conversation — not by calling the Anthropic API from the script. The script should gather all fixture/odds/form data and return it to Claude Code, which then does the analysis and writes the result. There is no `ANTHROPIC_API_KEY` required in `.env.local`.


## What This Project Does

1. **Daily pick script** — fetches odds + form data, runs value analysis, selects one bet, writes a dated JSON file to the repo, pushes to GitHub
2. **Automated result update** — before writing today's pick, checks yesterday's pick against match results and updates that JSON with win/loss outcome and return
3. **Next.js website** — displays today's pick prominently, history of all past picks, and a running £10 pot tracker showing cumulative return

---

## Project Structure

```
the-pick/
├── CLAUDE.md
├── .env.local               # Never committed — contains API keys
├── .gitignore               # Must include .env.local
├── data/
│   └── briefs/
│       └── YYYY-MM-DD.json  # One file per day's pick
├── scripts/
│   ├── fetch-data.ts        # Main daily script — fetches odds + Reddit context, writes pending-analysis.json
│   └── update-result.ts     # Result checker (called by fetch-data)
├── src/
│   └── app/
│       ├── page.tsx         # Today's pick (home page)
│       ├── history/
│       │   └── page.tsx     # All past picks + £10 pot tracker
│       └── layout.tsx
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## Environment Variables

Create `.env.local` in the project root. Never commit this file.

```
ODDS_API_KEY=your_the_odds_api_key_here
API_FOOTBALL_KEY=your_api_football_key_here
GITHUB_TOKEN=your_github_pat_here
GITHUB_REPO=username/the-pick
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=your_vercel_org_id_here
VERCEL_PROJECT_ID=your_vercel_project_id_here
```

**Getting your Vercel token**: Go to `vercel.com/account/tokens`, create a new token, paste it here. No browser login needed on the machine.

**VERCEL_ORG_ID and VERCEL_PROJECT_ID**: These are written automatically to `.vercel/project.json` after the first deploy. Claude Code will extract them and add them to `.env.local` during setup.

When setting up for the first time, prompt the user to provide ODDS_API_KEY, API_FOOTBALL_KEY, GITHUB_TOKEN, GITHUB_REPO, and VERCEL_TOKEN. The Vercel IDs will be populated automatically.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS — dark theme, clean, data-forward
- **Deployment**: Vercel (connected to GitHub repo, auto-deploys on push)
- **Data store**: JSON files in `/data/briefs/` committed to GitHub

---

## Data Sources

### The Odds API
- Base URL: `https://api.the-odds-api.com/v4`
- Auth: `?apiKey=ODDS_API_KEY`
- Bookmaker: always filter for `ladbrokes` specifically using the `bookmakers` param
- Region: `uk`
- Markets: `h2h` (match result — home/draw/away)
- Sports to cover (in priority order):
  - `soccer_epl` — English Premier League
  - `soccer_efl_champ` — Championship
  - `soccer_uefa_champs_league` — Champions League
  - `soccer_europa_league` — Europa League
  - `soccer_germany_bundesliga` — Bundesliga
  - `soccer_spain_la_liga` — La Liga

Fetch all sports that have fixtures today and combine into one pool for analysis.

### API-Football
- Base URL: `https://v3.football.api-sports.io`
- Auth header: `x-apisports-key: API_FOOTBALL_KEY`
- Use to fetch: team form (last 5 results), head-to-head record, any injury news
- Map fixtures from The Odds API to API-Football fixture IDs by team name + date

---

## Daily Pick Script (`scripts/fetch-data.ts`)

Run this script when the user wants today's pick. It should:

### Step 1 — Update yesterday's result
- Load yesterday's JSON from `/data/briefs/YYYY-MM-DD.json`
- If it has `result: null`, fetch the match result from API-Football
- Calculate return: if won, `stake * odds`; if lost, `0`
- Update the JSON with `result: 'win' | 'loss'`, `return: number`, `settled: true`

### Step 2 — Fetch today's fixtures and odds
- Call The Odds API for each sport listed above
- Filter to fixtures with `commence_time` today (UTC)
- Extract Ladbrokes odds only — if Ladbrokes isn't listed for a fixture, skip it
- Convert Ladbrokes decimal odds to implied probability: `1 / odds * 100`

### Step 3 — Fetch form and context from API-Football
- For each fixture, fetch last 5 results for both teams
- Fetch head-to-head record (last 5 meetings)
- Note any significant absences if available

### Step 4 — Value analysis via Claude Code

Claude Code (in the conversation) reads `data/pending-analysis.json` and performs value analysis directly. The script does NOT call the Anthropic API — it just writes the pending data file and instructs Claude to analyse it.

For each fixture, calculate:
- Ladbrokes implied probability (already provided)
- Estimated true probability based on form, context, and Reddit signals
- Edge: true prob minus implied prob (positive = value)

Eliminate bets with odds below 1.5. Select the top pick(s) with the strongest positive edge backed by clear reasoning.

Apply the Kelly Criterion:
- kelly_fraction = (edge / (odds - 1)) × 0.5  ← half-Kelly already applied
- Cap at 0.25 maximum

### Step 5 — Write JSON file
Write the result to `/data/briefs/YYYY-MM-DD.json` using this exact format:

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
      "reasoning": "Arsenal have won 4 of their last 5 at home. Chelsea have kept one clean sheet in seven away games. Ladbrokes are underestimating the home advantage here.",
      "confidence": "high",
      "result": null,
      "return": null,
      "settled": false
    }
  ],
  "acca_available": false,
  "acca_odds": null,
  "acca_result": null,
  "acca_return": null
}
```

**CRITICAL**: The JSON must use the `picks` array format above. A flat structure with `pick`/`odds` at the root level is wrong and will break the site. `acca_available` should be `true` only when there are 2+ picks and `acca_odds` is their product.

### Step 6 — Push to GitHub
- Stage the new/updated JSON files
- Commit with message: `pick: YYYY-MM-DD`
- Push to main branch
- Vercel will auto-deploy within ~30 seconds

---

## Website Design

Design a clean, minimal dark-theme Next.js site. Think: sports data dashboard, not a gambling advert. No flashy animations, no neon green. Data-forward typography, good use of space.

### Design direction
- **Background**: near-black (`#0a0a0a` or similar)
- **Surface**: dark grey cards (`#111` / `#161616`)
- **Accent**: a single clean colour — white or a muted amber/gold. Not green.
- **Typography**: a strong display font for the pick itself, monospace for numbers and odds. Avoid Inter/Roboto.
- **Borders**: subtle, single pixel, low contrast
- **No gradients**, no glow effects, no sports-betting-site clichés
- Invoke Claude Code's frontend design capabilities fully — this should look considered and distinctive

### Home page (`/`)
- Large header: "THE PICK"
- Today's date
- The pick displayed prominently:
  - Match name
  - League + kickoff time
  - **The bet** (e.g. "Arsenal to win") — largest text on the page
  - Ladbrokes odds (large, clear)
  - Edge % and our estimated probability (smaller, secondary)
  - Reasoning paragraph
  - Confidence badge (high / medium / low)
  - Kelly stake suggestion (e.g. "Suggested stake: 4.9% of bankroll")
- If today's pick hasn't been generated yet, show a clear "No pick today yet" state
- Link to History

### History page (`/history`)
- **£10 Pot tracker** at the top — running total if £10 had been placed on every pick
  - Display: current pot value, total picks, win rate %, ROI %
- Table of all past picks, newest first:
  - Date | Match | Pick | Odds | Result (Win/Loss/Pending) | Return
  - Row colour: subtle green tint for wins, subtle red tint for losses, neutral for pending
- Clean table, not cards

---

## Setup Instructions for Claude Code

When a user runs this project for the first time:

1. Check if `.env.local` exists. If not, ask the user for ODDS_API_KEY, API_FOOTBALL_KEY, GITHUB_TOKEN, GITHUB_REPO, and VERCEL_TOKEN. Write them to `.env.local`.
2. Run `npm install`
3. Install Vercel CLI if not present: `npm i -g vercel`
4. Create the GitHub repo: `gh repo create the-pick --public --source=. --push`
5. Deploy to Vercel using token (no browser needed):
   ```bash
   vercel --prod --token=$VERCEL_TOKEN --yes
   ```
6. Extract the generated Vercel IDs from `.vercel/project.json` and append to `.env.local`:
   ```bash
   cat .vercel/project.json
   # Copy orgId → VERCEL_ORG_ID, projectId → VERCEL_PROJECT_ID
   ```
7. Link GitHub repo to Vercel project for auto-deploy via Vercel API:
   ```bash
   curl -X POST "https://api.vercel.com/v1/projects/$VERCEL_PROJECT_ID/link" \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"type":"github","repo":"$GITHUB_REPO"}'
   ```
8. Output the live Vercel URL to the user

After initial setup, all future deploys happen automatically via `git push` — Vercel CLI is not used again.

---

## Running the Daily Pick

When the user asks for today's pick, run:

```bash
npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/fetch-data.ts
```

Or via the cron wrapper:
```bash
bash run-pick.sh
```

This will:
- Update yesterday's result automatically
- Fetch today's fixtures, Ladbrokes odds, and Reddit context
- Write `data/pending-analysis.json`
- Claude Code then reads that file, performs value analysis, and writes the dated JSON brief

After Claude writes the brief, commit and push:
```bash
git add data/briefs/YYYY-MM-DD.json && git commit -m "pick: YYYY-MM-DD" && git push
```
Vercel auto-deploys within ~30 seconds.

---

## Important Rules

- **Always use Ladbrokes odds** — if Ladbrokes doesn't list a fixture, skip it. The user bets on Ladbrokes.
- **Three picks per day** — always select the top 3 value bets ranked by edge descending (rank 1, 2, 3). Set `acca_available: true` and calculate `acca_odds` as the product of all three odds.
- **Never overwrite a settled result** — if `settled: true`, do not modify that file.
- **Kelly fractions above 0.25 should be capped at 0.25** — never suggest staking more than 25% of bankroll.
- **Do not pick bets with odds below 1.5** — too little value upside even if edge exists.
- **If no value bets exist today** — write a JSON with `"no_pick": true` and a brief explanation. Display this clearly on the site rather than forcing a bad pick.
- **Confidence: low picks should include a warning** on the site — "Proceed with caution"

---

## Responsible Gambling Note

Include a small, unobtrusive footer on every page:
"For entertainment only. Gamble responsibly. BeGambleAware.org"
