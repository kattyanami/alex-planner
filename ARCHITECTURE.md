# Alex Planner — Architecture

**One-liner:** Multi-agent equity portfolio planner. Same product as `alex` (AWS), rebuilt fully on Vercel — `git push` to deploy, no Terraform, no Docker, no VPC, ~70% lower run cost via mixed-model fleet.

---

## System diagram

```
                                    ┌──────────────────────────┐
                                    │  Next.js 16 App Router   │
  Browser ──────── Clerk auth ────▶ │  (Vercel Edge Network)   │
                                    └────────────┬─────────────┘
                                                 │ Server Actions / Route Handlers
                                                 ▼
                                    ┌──────────────────────────┐
                                    │   Vercel Workflow        │  ← durable, retries,
                                    │   (Planner orchestrator) │     pause/resume
                                    └────────────┬─────────────┘
                                                 │ workflow.step()
                          ┌──────────┬───────────┼───────────┬───────────┐
                          ▼          ▼           ▼           ▼           ▼
                       Tagger    Reporter    Charter   Retirement   Researcher
                      (Haiku)   (Sonnet)   (Haiku)   (Sonnet)     (Sonnet)
                                                                   in Sandbox
                                                                   + Playwright
                          │          │           │           │           │
                          └──────────┴─────┬─────┴───────────┴───────────┘
                                           ▼
                                  ┌────────────────────┐
                                  │  AI Gateway        │ ← model fallback,
                                  │  (Anthropic)       │   usage tracking
                                  └────────────────────┘
                                           │
                                           ▼
                              ┌────────────────────────────┐
                              │  Neon Postgres + pgvector  │ ← portfolios,
                              │  (Vercel Marketplace)      │   ETFs, embeddings,
                              └────────────────────────────┘   research notes

                              ┌────────────────────────────┐
                              │  Vercel Cron               │ → triggers Researcher
                              │  Vercel Blob               │ → uploaded statements
                              │  LangFuse                  │ → traces & evals
                              └────────────────────────────┘
```

---

## AWS → Vercel component map

| Concern | AWS (alex) | Vercel (alex-planner) |
|---|---|---|
| Frontend hosting | S3 + CloudFront | Vercel Edge Network |
| API layer | API Gateway + FastAPI Lambda | Next.js Route Handlers / Server Actions |
| Agent runtime | 5× Lambda (Python, OpenAI Agents SDK) | Vercel Functions (TS, AI SDK) |
| Agent orchestration | SQS + Lambda fan-out | Vercel Workflow DevKit (durable steps) |
| Researcher (browser) | App Runner + ECR + Playwright MCP | Vercel Sandbox (Firecracker microVM) + Playwright |
| LLM access | Bedrock Nova Pro via LiteLLM | Anthropic via Vercel AI Gateway |
| Embeddings | SageMaker Serverless (MiniLM-384d) | OpenAI text-embedding-3-small via AI Gateway |
| Vector store | S3 Vectors | pgvector on Neon (same DB as relational) |
| Relational DB | Aurora Serverless v2 + Data API | Neon Postgres (Vercel Marketplace) |
| Secrets | Secrets Manager | Vercel env vars |
| Auth | Clerk | Clerk (1-click via Marketplace) |
| Scheduling | EventBridge | Vercel Cron Jobs |
| File uploads | S3 | Vercel Blob |
| Observability | CloudWatch + LangFuse | Vercel Observability + LangFuse |
| IaC | Terraform (7 stacks) | none — `git push` |

---

## Mixed-fleet model strategy (the 70% cost cut)

| Agent | Job | Model | Why |
|---|---|---|---|
| **Planner** | Decompose user request, route to sub-agents | **Sonnet 4.6** | Reasoning + tool selection — needs the smartest model |
| **Tagger** | Classify ETFs/stocks by sector, asset class | **Haiku 4.5** | Pure classification — Haiku is plenty |
| **Reporter** | Synthesize portfolio analysis prose | **Sonnet 4.6** | Quality writing matters here |
| **Charter** | Pick chart types + structured chart specs | **Haiku 4.5** | Structured output, low complexity |
| **Retirement** | Multi-step financial projections | **Sonnet 4.6** | Math + reasoning — needs Sonnet |
| **Researcher** | Web browsing, market notes | **Sonnet 4.6** | Long-context synthesis |

### Rough per-analysis cost (one user request → all agents run)

Assumed: 25K input + 6K output tokens distributed across 6 agent calls.

| Strategy | Cost / analysis | vs all-Sonnet |
|---|---|---|
| All Sonnet 4.6 | ~$0.165 | baseline |
| All Bedrock Nova Pro (current) | ~$0.130 | -21% |
| **Mixed Haiku/Sonnet (this plan)** | **~$0.052** | **-68%** |
| All Haiku 4.5 | ~$0.025 | -85% (but quality drops on Planner/Reporter) |

Numbers are ballpark — real cost depends on portfolio size + research depth. We'll tune after Phase 4 with real LangFuse data.

---

## Data flow: "Analyze my portfolio"

1. **User uploads** broker statement → Vercel Blob → ingest workflow
2. **Ingest workflow** chunks PDF, embeds via AI Gateway, writes `documents` + `embeddings` to Neon
3. **User clicks "Analyze"** → Server Action triggers Planner workflow
4. **Planner** (Sonnet) reads portfolio from Neon, decides which sub-agents to call, emits steps
5. **Workflow runs in parallel:**
   - Tagger (Haiku) classifies holdings
   - Reporter (Sonnet) drafts summary + risk analysis
   - Charter (Haiku) generates chart specs
   - Retirement (Sonnet) projects scenarios
   - Researcher (Sonnet, Sandbox) — only if Planner asks for fresh market data
6. **Results stream to UI** via workflow event subscription
7. **Final report** written to Neon, traces sent to LangFuse

---

## Directory structure (target)

```
alex-planner/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Clerk sign-in, sign-up
│   ├── (dashboard)/
│   │   ├── portfolios/
│   │   ├── analyses/
│   │   └── upload/
│   ├── api/                      # Route handlers (webhooks, etc.)
│   └── layout.tsx
├── components/
│   ├── ui/                       # shadcn/ui
│   └── analysis/                 # streaming agent results UI
├── lib/
│   ├── agents/                   # one file per agent
│   │   ├── planner.ts
│   │   ├── tagger.ts
│   │   ├── reporter.ts
│   │   ├── charter.ts
│   │   ├── retirement.ts
│   │   └── researcher.ts
│   ├── workflows/                # Workflow DevKit definitions
│   │   ├── analyze-portfolio.ts
│   │   └── ingest-document.ts
│   ├── db/                       # Drizzle schema + queries
│   │   ├── schema.ts
│   │   └── queries.ts
│   ├── ai/                       # AI Gateway client, model registry
│   │   └── models.ts
│   └── tools/                    # AI SDK tools (DB lookups, etc.)
├── sandbox/                      # Vercel Sandbox config for Researcher
│   └── researcher/
├── drizzle/                      # migrations
│   └── seed/                     # 22 ETFs from alex/backend/database
├── public/
├── .env.local                    # secrets (gitignored)
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── ARCHITECTURE.md               # this file
```

---

## Tech stack (locked-in)

- **Runtime/lang:** Node 24, TypeScript 5.x
- **Framework:** Next.js 16 (App Router)
- **UI:** Tailwind 4, shadcn/ui
- **Auth:** Clerk
- **DB ORM:** Drizzle (typed, migration-friendly)
- **DB:** Neon Postgres + pgvector extension
- **File storage:** Vercel Blob
- **Agents:** Vercel AI SDK v5
- **LLM provider:** Anthropic via Vercel AI Gateway
- **Embeddings:** OpenAI text-embedding-3-small via AI Gateway
- **Orchestration:** Vercel Workflow DevKit
- **Sandbox:** Vercel Sandbox (for Playwright in Researcher)
- **Scheduling:** Vercel Cron
- **Observability:** Vercel Observability + LangFuse
- **Package manager:** pnpm

---

## Cost envelope (monthly, single user / personal use)

| Service | Plan | Est. cost |
|---|---|---|
| Vercel | Hobby | $0 |
| Neon | Free (0.5GB, auto-pause) | $0 |
| Clerk | Free (10K MAU) | $0 |
| Vercel Blob | Free (1GB) | $0 |
| LangFuse | Free (Hobby cloud) | $0 |
| **Anthropic API** | pay-as-you-go | **~$2-5/mo** at light personal use |
| OpenAI embeddings | pay-as-you-go | < $1/mo |
| **Total** | | **~$3-6/mo** |

For comparison, the AWS version idles at ~$50-80/mo just from Aurora + App Runner minimums even without traffic.

If this turns into a real SaaS (paying users), Vercel Pro ($20/mo) becomes mandatory and Neon scales with usage — but still ~5-10× cheaper than the AWS equivalent at the same scale.

---

## Security

- **Auth:** Clerk handles sign-in, session, MFA. All routes under `(dashboard)` are middleware-gated.
- **DB isolation:** Every Neon row tagged with Clerk `user_id`; Drizzle queries filter by it. RLS policies for defense in depth.
- **API:** No public agent endpoints — all agent calls are Server Actions, gated by Clerk middleware.
- **Secrets:** Vercel env vars, never committed. `.env.local` in `.gitignore`.
- **Sandbox:** Researcher's Playwright runs in Firecracker microVM with no network access to our DB — only outbound web. Results passed back via return value, not direct DB writes.
- **Rate limiting:** Vercel Firewall rules per route (TBD Phase 8).

---

## Open questions to resolve before scaffolding

1. **Repo:** Make `alex-planner` a fresh public repo on GitHub, or private? (Affects Vercel deploy hooks.)
2. **Domain:** Deploy to `alex-planner.vercel.app` for now, or do you have a custom domain in mind?
3. **Region:** Neon + Vercel region preference? Default I'd pick: **`iad1` (US East / Virginia)** — best Anthropic latency. Or `lhr1` (London) if you want EU.
4. **OpenAI API key:** Needed for embeddings. Do you have one, or should we use Voyage-3 via AI Gateway instead (no separate key)?

---

## Phase plan reminder

| # | Phase | Est. time | Verifies |
|---|---|---|---|
| 0 | Scaffold (Next.js, Clerk, Neon, AI Gateway) | 30 min | Empty app deploys, login works |
| 1 | DB + ORM + seed ETFs | 1-2 h | `select * from etfs` returns 22 rows |
| 2 | Auth shell + dashboard | 1 h | User logs in, sees their portfolios page |
| 3 | **First agent (Tagger) end-to-end** | 2-3 h | Submit holdings → tagged classification |
| 4 | Workflow + remaining agents | 3-4 h | Full analysis pipeline runs |
| 5 | Researcher + Sandbox + Playwright | 2-3 h | Cron-triggered web research lands in DB |
| 6 | Ingest + vector search | 1-2 h | PDF upload → searchable |
| 7 | Frontend polish + streaming UI | varies | Production-quality UX |
| 8 | LangFuse + observability + prod deploy | 1 h | Traces visible, metrics dashboard |
