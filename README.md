# Alex Planner

A multi-agent AI portfolio analysis platform — Next.js 16 + Neon Postgres
+ Clerk + Vercel AI SDK on OpenAI gpt-5-mini, with real-time prices from
Polygon (Yahoo fallback) and pgvector RAG over per-holding news.

Originally an AWS architecture (Lambda, Aurora, SageMaker, S3 Vectors,
Bedrock, App Runner). Ported to Vercel-native with the same multi-agent
fan-out pattern but ~70% lower operating cost.

## What it does

Sign in → add holdings (or load the sample portfolio) → click **Analyze**.
Four agents fan out in parallel:

| Agent | Job | Model |
|---|---|---|
| **Tagger** × N | Re-classifies each holding (asset class, regions, sectors, price) | gpt-5-mini · structured output |
| **Reporter** | Markdown portfolio analysis with retrieval over real news | gpt-5-mini · streaming text |
| **Charter** | Chart specs (pie / bar / horizontalBar) for the dashboard | gpt-5-mini · structured output |
| **Retirement** | Monte Carlo simulation (500 stochastic paths) + LLM commentary | TS + gpt-5-mini streaming |

Wall-clock latency is `max(individual durations)`, not sum. Total ~6s,
~$0.005 per run.

A separate **Researcher** pipeline fetches news headlines per holding from
Yahoo Finance, embeds them via `text-embedding-3-small` into pgvector,
and the Reporter retrieves the top-3 most relevant per symbol on every
run — so the analysis cites *real* recent news instead of training-data
generalities.

## Stack

| Layer | Service |
|---|---|
| Hosting | Vercel (Functions + Edge) |
| Auth | Clerk v7 |
| DB | Neon Postgres + Drizzle ORM |
| Vector store | Neon `pgvector` extension, HNSW index, cosine distance |
| LLM | OpenAI `gpt-5-mini` (text + structured) + `text-embedding-3-small` |
| Prices | Polygon.io (rebranded → Massive) primary, Yahoo Finance fallback |
| News | Yahoo Finance via `yahoo-finance2` |
| Charts | Recharts |
| Icons | lucide-react |
| Fonts | Geist + Geist Mono |

## Project structure

```
app/
  dashboard/
    layout.tsx            # Auth gate + DashboardShell + cmd-K wiring
    page.tsx              # Overview (KPI hero, accounts, last analysis, activity)
    holdings/page.tsx     # Portfolio editor with type-ahead instrument picker
    analysis/page.tsx     # 4 streaming agent panels
    research/page.tsx     # Researcher panel + per-symbol doc lists
    settings/page.tsx     # Profile + system info
    error.tsx             # Dashboard error boundary
  api/agents/
    reporter/route.ts     # Streaming Reporter
    retirement/route.ts   # Streaming Retirement
  global-error.tsx        # Last-resort error boundary
components/
  dashboard-shell.tsx     # Topbar + sidebar + cmd-K mount
  command-palette.tsx     # ⌘K palette with real action execution
  charts/                 # Recharts wrappers (donut, allocation legend, etc.)
  ui/primitives.tsx       # Card, Button, Badge, KPITile, etc.
lib/
  agents/
    tagger.ts             # generateObject classification
    reporter.ts           # generateText/streamText + RAG context build
    charter.ts            # generateObject chart specs
    retirement.ts         # Monte Carlo + LLM commentary (streaming)
    researcher.ts         # Yahoo news fetch + dedup hash
    embedder.ts           # OpenAI text-embedding-3-small wrapper
  finance/
    aggregate.ts          # Pure-TS portfolio aggregation
    assumptions.ts        # Market constants (means, stds, inflation)
    prices.ts             # Provider dispatcher (Polygon → Yahoo)
    providers/
      polygon.ts
      yahoo.ts
  db/
    schema.ts             # Drizzle table definitions
    queries.ts            # All DB read/write functions
  actions/                # Server actions (portfolio, profile, analyze, research)
  ai/models.ts            # Model registry
  telemetry.ts            # Structured agent logging (Vercel + LangFuse-ready)
  streaming.ts            # Client-side stream reader with metadata sentinel
drizzle/
  migrations/             # Generated SQL migrations
  seed/etfs.ts            # 22 seeded ETFs
```

## Local dev

```bash
pnpm install
cp .env.example .env.local             # fill in real keys
vercel link                            # connect to your Vercel project
vercel env pull .env.local             # populate from Vercel
pnpm db:migrate                        # run Drizzle migrations against Neon
pnpm db:seed                           # seed the 22 ETFs
pnpm dev                               # http://localhost:3000
```

The build verifies TypeScript and produces a fully tree-shaken bundle:

```bash
pnpm build
```

## Database

```bash
pnpm db:generate    # generate a migration from schema changes
pnpm db:migrate     # apply pending migrations
pnpm db:push        # (alternative) push schema directly without migration files
pnpm db:studio      # open Drizzle Studio
pnpm db:seed        # re-seed the 22 ETF instruments
```

The pgvector extension was enabled via `scripts/check-pgvector.ts` (one
time, idempotent).

## Phase journey

| Phase | What landed |
|---|---|
| 0 | Scaffold Next.js 16 + Vercel + Neon + Clerk |
| 1 | Drizzle schema (users, instruments, accounts, positions, jobs) + seeded 22 ETFs |
| 2 | Auth shell + dashboard route |
| 3 | First agent (Tagger) end-to-end |
| 4 | Multi-agent Planner pattern + per-user portfolios + UI overhaul |
| 4d | On-demand instrument creation via Tagger (any symbol) |
| 4e | Polygon.io prices, Yahoo fallback, hybrid bulk refresh |
| Polish | Hero donut, sparklines, aurora bg, animations, last-analysis card, activity feed |
| 5 | Researcher pipeline (Yahoo news per holding, dedup hash, manual run) |
| 6 | pgvector embeddings + retrieval, Reporter RAG over real news |
| 7 | Streaming Reporter + Retirement, ⌘K command palette |
| 8 | Telemetry, error boundaries, docs |

## Cost reality (per analysis run)

| Step | Cost |
|---|---|
| 4 LLM calls (Tagger×N + Reporter + Charter + Retirement) on gpt-5-mini | ~$0.005 |
| ~12 doc embeds + 1 query embed via text-embedding-3-small | ~$0.0001 |
| 5 Polygon API calls (free tier) | $0 |
| Neon DB queries | $0 (free tier) |
| Vercel function execution | $0 (free tier) |

Total: **~half a cent per full analysis**. No paid integrations needed
to hit feature parity with the AWS original.

## See also

- [OBSERVABILITY.md](OBSERVABILITY.md) — telemetry today + LangFuse upgrade path
- [.env.example](.env.example) — full env var list with sources

## License

MIT
