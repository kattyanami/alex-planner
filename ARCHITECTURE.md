# Alex Planner — Architecture

**One-liner:** Multi-agent equity portfolio planner. Same product as the AWS
original, rebuilt fully on Vercel — `git push` to deploy, no Terraform, no
Docker, no VPC, ~70% lower run cost. Ships with real-time prices,
on-demand instrument catalog, pgvector RAG over real news, and streaming
multi-agent analysis.

> This is the **as-shipped** architecture. The planning doc that
> preceded it (AI Gateway + mixed Anthropic fleet + Workflow DevKit +
> Sandbox + Cron) was scoped down during build because the simpler
> patterns proved sufficient. See "What we deferred" at the bottom.

---

## System diagram

```
                                    ┌──────────────────────────┐
                                    │  Next.js 16 App Router   │
  Browser ──────── Clerk auth ────▶ │  (Vercel Edge Network)   │
                                    └────────────┬─────────────┘
                                                 │ Server Actions
                                                 │ + 2 streaming routes
                                                 │ (Reporter, Retirement)
                                                 ▼
                                    ┌──────────────────────────┐
                                    │   Client-side Planner    │  ← 4 parallel
                                    │   (Promise.all in React) │     fetches; each
                                    └────────────┬─────────────┘     card streams
                                                 │                   independently
                          ┌──────────┬───────────┼───────────┐
                          ▼          ▼           ▼           ▼
                       Tagger    Reporter    Charter    Retirement
                                  +RAG over
                                   pgvector
                          │          │           │           │
                          └──────────┴─────┬─────┴───────────┘
                                           ▼
                              ┌────────────────────────────┐
                              │  OpenAI Direct API         │ ← gpt-5-mini for all
                              │  (@ai-sdk/openai)          │   text + structured
                              │                            │   text-embedding-3-small
                              │                            │   for vectors
                              └────────────┬───────────────┘
                                           │
                                           ▼
                              ┌────────────────────────────┐
                              │  Neon Postgres + pgvector  │ ← 7 tables: users,
                              │  HNSW cosine index on      │   instruments, accounts,
                              │  research_documents.embed  │   positions, jobs,
                              └────────────────────────────┘   activity_events,
                                                               research_documents

       Pricing pipeline                              Research pipeline
                                                     (manual; cron deferred)
       ┌─────────────────────────┐                  ┌─────────────────────────┐
       │  Polygon (Massive) API  │                  │  Yahoo Finance news     │
       │  /v2/aggs/prev free tier│                  │  via yahoo-finance2     │
       └─────────────┬───────────┘                  │  search()               │
                     │  on miss                     └────────────┬────────────┘
                     ▼                                           │
       ┌─────────────────────────┐                               ▼
       │  Yahoo Finance quote()  │                  ┌─────────────────────────┐
       │  (yahoo-finance2)       │                  │  Embed via OpenAI       │
       └─────────────────────────┘                  │  text-embedding-3-small │
                                                    │  → pgvector HNSW index  │
                                                    └─────────────────────────┘
```

---

## AWS → Vercel component map (as shipped)

| Concern | AWS original | Vercel (shipped) |
|---|---|---|
| Frontend hosting | S3 + CloudFront | Vercel Edge Network |
| API layer | API Gateway + FastAPI Lambda | Next.js Server Actions + 2 streaming Route Handlers |
| Agent runtime | 5× Lambda (Python, OpenAI Agents SDK) | Vercel Functions (TypeScript, Vercel AI SDK v6) |
| **Agent orchestration** | **SQS + Step Functions** | **Plain `Promise.all`** in client + server actions |
| Researcher | App Runner + ECR + Playwright MCP | yahoo-finance2 search() (no Sandbox needed for v1) |
| LLM access | Bedrock + LiteLLM proxy | **`@ai-sdk/openai` direct** (no AI Gateway) |
| Embeddings | SageMaker Serverless (MiniLM-384d) | OpenAI `text-embedding-3-small` (1536d) direct |
| Vector store | S3 Vectors | **pgvector** on the same Neon instance |
| Relational DB | Aurora Serverless v2 + Data API | Neon Postgres + Drizzle ORM |
| Pricing | n/a | Polygon (Massive) primary + Yahoo fallback |
| Auth | Cognito | Clerk v7 |
| Secrets | Secrets Manager | Vercel env vars |
| Scheduling | EventBridge | (deferred — manual "Run now" button) |
| File uploads | S3 | (deferred — no PDF ingest in shipped product) |
| Observability | CloudWatch | Vercel Logs + structured `traceAgent()` (LangFuse-ready) |
| IaC | Terraform (7 stacks) | none — `git push` |

---

## Single-fleet model strategy (the actual cost story)

After Phase 3 we tested gpt-5-mini against the planned mixed Haiku/Sonnet
fleet and found gpt-5-mini was good enough for every agent role. So we
collapsed to a single model — simpler ops, no model-routing logic, and
came out cheaper than the mixed plan anyway.

| Agent | Job | Model | Why |
|---|---|---|---|
| **Tagger** × N | Classify ETFs/stocks (asset class, region, sector, price) | gpt-5-mini · structured | Schema-strict output; gpt-5-mini handles it cleanly |
| **Reporter** | Markdown portfolio analysis with retrieved news context | gpt-5-mini · streaming | Streaming makes the long output feel instant |
| **Charter** | Pick 4-6 chart types + structured chart specs | gpt-5-mini · structured | Structured output, low complexity |
| **Retirement** | LLM commentary on Monte Carlo results | gpt-5-mini · streaming | Math is in TS; LLM only narrates |
| **Researcher** | Headline fetch per holding | (no LLM) yahoo-finance2 search | Free tier, structured news response |
| **Embedder** | Vectorize research docs + queries | text-embedding-3-small (1536d) | Cheap, fast, batched |

### Real per-analysis cost

For a typical 5-holding portfolio with 12 fresh research docs:

| Step | Model | Cost |
|---|---|---|
| Tagger × 5 | gpt-5-mini | ~$0.0015 |
| Reporter (RAG context build + streaming) | gpt-5-mini | ~$0.0020 |
| Charter (structured) | gpt-5-mini | ~$0.0010 |
| Retirement (Monte Carlo in TS, narrative streaming) | gpt-5-mini | ~$0.0010 |
| Embedder (1 query embedding) | text-embedding-3-small | < $0.00001 |
| **Total per analysis** | | **~$0.005** |

Researcher run (manual, separate):

| Step | Cost |
|---|---|
| Yahoo news fetch × 5 symbols | $0 (free) |
| Embed 12 fresh docs (batched) | < $0.0001 |
| **Total per researcher run** | **< $0.0001** |

That's **~half a cent per full analysis** including RAG. The original
$0.165 all-Sonnet projection in the planning doc was off by ~30×.

---

## Data flow: "Analyze my portfolio"

1. **User clicks "Analyze portfolio (Planner)"** on `/dashboard/analysis`
2. **Client kicks off 4 parallel calls** via `Promise.all` from React
   ([components/test-analyze.tsx:runAll()](components/test-analyze.tsx)):
   - `runTaggerAgent()` server action — fans out 1 LLM call per holding
   - `POST /api/agents/reporter` streaming route — RAG context + Reporter
   - `runCharterAgent()` server action — chart specs
   - `POST /api/agents/retirement` streaming route — Monte Carlo + LLM
3. **Each card updates independently** as its agent settles. Wall-clock =
   max(individual durations), not sum (~6s end-to-end).
4. **Reporter builds RAG context first**: one query embedding from a
   portfolio-aware question, then top-3 retrieval per symbol via
   pgvector `<=>` cosine distance, injected into the prompt.
5. **Streaming Reporter + Retirement** chunk text via
   [lib/streaming.ts](lib/streaming.ts), with a final `<<<META>>>{json}`
   sentinel carrying tokens, ms, and structured metadata so the card
   transitions from "running" to "done" with full stats.
6. **After all 4 settle**, client calls `saveAnalysisAction()` → row in
   `jobs` table → "Last analysis" card on the Overview page reflects the
   new run.
7. **Activity feed entry** logged for `analysis_completed`.

---

## Data flow: "Add a new holding the catalog doesn't have"

1. User types `MSFT` in the position picker (catalog only has 22 ETFs).
2. Combobox shows **"➕ Add 'MSFT' to catalog"** row.
3. `addInstrumentAction(MSFT)` runs Tagger + Polygon **in parallel**
   (`Promise.all`):
   - **Tagger** fills name, asset class, regions, sectors (LLM)
   - **Polygon** fills the *real* price (free-tier `/v2/aggs/prev`)
4. Insert into `instruments` table with `price_source = 'polygon'`.
5. Position row inserted, account total updates, activity feed logs the
   classification.

---

## Data flow: "Run Researcher"

1. User clicks **Run now** on `/dashboard/research`.
2. `runResearcherForUserAction()` reads unique symbols from user's holdings.
3. `Promise.all` fan-out: 1 Yahoo `search()` call per symbol → ~6 news
   docs each.
4. `upsertResearchDocs()` writes rows with `(symbol, hash)` unique
   constraint — repeat clicks are idempotent.
5. `listUnembeddedDocs()` finds rows missing an embedding (covers fresh
   inserts + any legacy rows from before Phase 6).
6. **Single batched** `embedMany` call to OpenAI vectorizes them all at
   once.
7. `setDocEmbedding()` per row writes the 1536-dim vector.
8. HNSW index automatically updates for sub-millisecond retrieval on
   the next analysis run.

---

## Database schema

7 tables, all in Neon Postgres.

```
users
├── clerk_user_id (PK, varchar 255)
├── display_name
├── current_age
├── years_until_retirement
├── target_retirement_income (decimal)
├── annual_contribution
├── asset_class_targets (jsonb)
└── region_targets (jsonb)

instruments
├── symbol (PK, varchar 20)
├── name
├── instrument_type
├── current_price (decimal)
├── price_source ('polygon' | 'yahoo' | 'tagger')
├── price_updated_at
├── allocation_asset_class (jsonb)
├── allocation_regions (jsonb)
└── allocation_sectors (jsonb)

accounts
├── id (PK, uuid)
├── clerk_user_id → users (cascade)
├── account_name
├── cash_balance
└── cash_interest

positions
├── id (PK, uuid)
├── account_id → accounts (cascade)
├── symbol → instruments
├── quantity (decimal 20,8)
└── unique(account_id, symbol)

jobs               # multi-agent analysis snapshots
├── id (PK, uuid)
├── clerk_user_id → users (cascade)
├── job_type ('analysis')
├── status ('completed' | ...)
├── request_payload, report_payload, charts_payload,
│   retirement_payload, summary_payload (jsonb)
└── started_at, completed_at

activity_events    # human-readable audit trail
├── id (PK, uuid)
├── clerk_user_id → users (cascade)
├── kind ('account_added' | 'analysis_completed' | …)
├── description, metadata (jsonb)
└── created_at

research_documents
├── id (PK, uuid)
├── symbol → instruments (cascade)
├── source ('yahoo_news' | …)
├── url, title, content
├── hash (sha256, unique with symbol)
├── published_at, fetched_at, metadata (jsonb)
├── embedding (vector(1536))     ← pgvector
├── embedded_at
└── HNSW index on embedding (vector_cosine_ops)
```

---

## Directory structure (as shipped)

```
alex-planner/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx              # auth gate + DashboardShell + ⌘K wiring
│   │   ├── page.tsx                # Overview (KPI hero, allocation donut)
│   │   ├── holdings/page.tsx       # portfolio editor + type-ahead picker
│   │   ├── analysis/page.tsx       # 4 streaming agent panels
│   │   ├── research/page.tsx       # Researcher + per-symbol doc lists
│   │   ├── settings/page.tsx       # profile editor + account info
│   │   └── error.tsx               # dashboard error boundary
│   ├── api/agents/
│   │   ├── reporter/route.ts       # streaming POST
│   │   └── retirement/route.ts     # streaming POST
│   ├── sign-in/[[...sign-in]]/
│   ├── sign-up/[[...sign-up]]/
│   ├── global-error.tsx
│   ├── layout.tsx
│   └── page.tsx                    # root → /dashboard
├── components/
│   ├── dashboard-shell.tsx         # topbar + sidebar + ⌘K mount
│   ├── command-palette.tsx         # ⌘K palette w/ real action runner
│   ├── test-analyze.tsx            # 4 agent cards, client orchestrator
│   ├── researcher-panel.tsx
│   ├── portfolio-editor.tsx
│   ├── profile-editor.tsx
│   ├── instrument-combobox.tsx     # type-ahead w/ Tagger fallback
│   ├── activity-feed.tsx
│   ├── last-analysis.tsx
│   ├── refresh-prices-button.tsx
│   ├── holdings-strip.tsx
│   ├── auth-buttons.tsx
│   ├── charts/
│   │   ├── allocation-donut.tsx
│   │   └── portfolio-charts.tsx
│   └── ui/
│       ├── primitives.tsx          # Card, Button, Badge, KPITile, etc.
│       ├── animations.tsx          # FadeIn, Stagger, CountUp
│       ├── sparkline.tsx           # tiny inline SVG sparkline
│       └── sparkline-data.ts       # server-safe data helper
├── lib/
│   ├── ai/models.ts                # MODELS registry — all gpt-5-mini
│   ├── agents/
│   │   ├── tagger.ts               # generateObject classification
│   │   ├── reporter.ts             # generateText + streamText + RAG
│   │   ├── charter.ts              # generateObject chart specs
│   │   ├── retirement.ts           # Monte Carlo + streamText commentary
│   │   ├── researcher.ts           # yahoo-finance2 search() wrapper
│   │   ├── embedder.ts             # OpenAI embedText / embedBatch
│   │   └── planner.ts              # legacy server-side orchestrator
│   ├── finance/
│   │   ├── aggregate.ts            # pure-TS portfolio aggregation
│   │   ├── assumptions.ts          # market constants
│   │   ├── prices.ts               # provider dispatcher
│   │   └── providers/
│   │       ├── polygon.ts
│   │       └── yahoo.ts
│   ├── db/
│   │   ├── index.ts                # Drizzle + Neon HTTP driver
│   │   ├── schema.ts               # 7 tables
│   │   └── queries.ts              # all read/write functions
│   ├── actions/                    # server actions
│   │   ├── analyze.ts
│   │   ├── instruments.ts
│   │   ├── portfolio.ts
│   │   ├── profile.ts
│   │   └── research.ts
│   ├── format.ts                   # fmtUsd, fmtPct, fmtNumber
│   ├── streaming.ts                # client stream reader + sentinel
│   └── telemetry.ts                # structured agent logging
├── drizzle/
│   ├── migrate.ts                  # custom migration runner
│   ├── migrations/                 # 6 generated SQL migrations
│   └── seed/
│       ├── etfs.ts                 # 22 seeded ETFs
│       └── seed.ts
├── scripts/
│   ├── check-pgvector.ts
│   ├── check-prices.ts
│   ├── test-prices.ts
│   └── test-rag.ts
├── public/
├── middleware.ts                   # Clerk route protection
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
├── README.md
├── ARCHITECTURE.md                 # this file
├── OBSERVABILITY.md                # LangFuse upgrade path
├── LICENSE
└── .env.example
```

---

## Tech stack (locked-in, as shipped)

- **Runtime/lang:** Node ≥20, TypeScript 5.x
- **Framework:** Next.js 16 (App Router, RSC, streaming)
- **UI:** Tailwind 4, lucide-react icons, Recharts for visualization
- **Auth:** Clerk v7
- **DB ORM:** Drizzle 0.45
- **DB:** Neon Postgres + pgvector extension (HNSW index, vector_cosine_ops)
- **AI SDK:** Vercel AI SDK v6
- **LLM provider:** **OpenAI direct** via `@ai-sdk/openai` (no AI Gateway)
- **LLM model:** **gpt-5-mini** for all 4 generation agents
- **Embeddings:** **OpenAI text-embedding-3-small** (1536d) direct
- **Prices:** Polygon.io (rebranded Massive) primary, Yahoo Finance fallback
- **News:** `yahoo-finance2` v3 search()
- **Orchestration:** **`Promise.all`** (no Workflow DevKit, no queue, no scheduler)
- **Streaming:** Custom `ReadableStream` with metadata sentinel
- **Observability:** Structured `console.log` (Vercel Logs); LangFuse-ready
- **Package manager:** pnpm

---

## Cost envelope (single user / personal use)

| Service | Plan | Est. cost |
|---|---|---|
| Vercel | Hobby | $0 |
| Neon | Free (0.5GB, auto-pause) | $0 |
| Clerk | Free (10K MAU) | $0 |
| Polygon (Massive) | Free (5/min, EOD) | $0 |
| **OpenAI API** | pay-as-you-go | **~$0.50-2/mo** at light personal use |
| **Total** | | **~$0.50-2/mo** |

For comparison, the AWS version idled at ~$50-80/mo from Aurora + App
Runner minimums *with no traffic*.

If this turns into a real SaaS:
- Vercel Pro ($20/mo) — needed for analytics + observability features
- Neon scales linearly with storage / compute — still 5-10× cheaper than
  the AWS equivalent at the same scale
- OpenAI scales linearly with usage; ~$0.005 / analysis run

---

## Security

- **Auth:** Clerk handles sign-in, sessions, MFA. Route protection via
  `middleware.ts` matching `/dashboard(.*)`.
- **Per-user isolation:** Every Neon row scoped by `clerk_user_id`.
  Drizzle queries filter by it; no cross-user data leakage.
- **API:** Streaming agent routes (`/api/agents/reporter`, `/api/agents/retirement`)
  re-check `auth()` server-side. Server actions inherit the Clerk
  session via cookies.
- **Catalog mutations:** `addInstrumentAction` validates symbol shape via
  regex (1-12 chars, alphanumeric/dot/dash) before invoking Tagger.
  Prevents prompt-injection via crafted symbols.
- **Secrets:** All in Vercel env vars; `.env.local` gitignored;
  `.env.example` ships the variable list with empty values.
- **Rate limiting:** Polygon free-tier is naturally rate-limited (5/min).
  No app-level rate limiting yet — add Vercel Firewall rules if going
  to public SaaS.

---

## Observability

- Every agent call wrapped in `traceAgent()` from `lib/telemetry.ts`
- One structured JSON line per call → Vercel Logs
- Filter syntax: `kind:llm`, `kind:llm agent:reporter`, `kind:llm ok:false`
- Designed for drop-in LangFuse upgrade (see [OBSERVABILITY.md](OBSERVABILITY.md))

---

## What we deferred (and why)

The planning doc had a few features that didn't ship:

| Planned | Why deferred | Re-enable cost |
|---|---|---|
| **Vercel Workflow DevKit** orchestration | `Promise.all` did the same job in 4 lines. No need for durable steps below 60s. | Refactor when single ops > 60s OR retries / cross-user coordination needed |
| **Vercel Sandbox + Playwright** for Researcher | yahoo-finance2's `search()` returns the same data without browser scraping. Free tier covers everything. | Add when SEC EDGAR / earnings transcripts are needed |
| **Vercel Cron** scheduling | User specifically wanted manual control. The route file (`app/api/cron/research`) was removed; flip-on cost is creating a vercel.json + setting a `CRON_SECRET` | ~5 min |
| **Vercel Blob** PDF upload + ingest | Out of scope for v1 (no broker statement parsing). | New `/upload` page + ingest worker |
| **AI Gateway** | OpenAI direct via `@ai-sdk/openai` was simpler, no model fallback was actually needed. | Add when multi-provider failover is required |
| **Mixed Haiku/Sonnet fleet** | Single-model gpt-5-mini was cheaper *and* good enough. | Add a `model:` parameter back to each agent and route in `MODELS` |
| **LangFuse** observability | Vercel Logs + structured `traceAgent()` covered observability needs. | See [OBSERVABILITY.md](OBSERVABILITY.md) — 5-step upgrade |

The pattern: **start simple, add complexity only when measurable need
appears**. Everything in this list could be added without touching
agent code — they all live at the orchestration / infrastructure layer.

---

## Phase journey

| # | Phase | Verifies |
|---|---|---|
| 0 | Scaffold (Next.js, Clerk, Neon) | Empty app deploys, login works |
| 1 | DB schema + Drizzle + seed 22 ETFs | `select * from instruments` returns 22 rows |
| 2 | Auth shell + dashboard route | User logs in, sees dashboard |
| 3 | First agent (Tagger) end-to-end | Submit holdings → tagged classification |
| 4 | Multi-agent Planner + per-user portfolios + UI | Full analysis runs against user data |
| 4d | On-demand instrument creation | Type AAPL → Tagger creates row → pickable |
| 4e | Polygon prices + Yahoo fallback | Refresh button updates 25 prices in 1.5s |
| Polish | Hero donut, sparklines, animations, last-analysis, activity feed | Dashboard feels A-tier |
| 5 | Researcher (yahoo-finance2 news) | Run now button → 12 docs in DB |
| 6 | pgvector embeddings + Reporter RAG | Reporter cites real news headlines |
| 7 | Streaming Reporter/Retirement + ⌘K palette | Tokens stream; ⌘K runs actions |
| 8 | Telemetry, error boundaries, docs | `kind:llm` filters work in Vercel Logs |

All shipped on production at https://alex-planner.vercel.app.
