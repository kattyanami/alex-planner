# Observability

## Today

Every agent / LLM call is wrapped in `traceAgent()` from
[`lib/telemetry.ts`](lib/telemetry.ts). It emits a single structured JSON
line per call:

```json
{
  "kind": "llm",
  "ts": "2026-05-04T01:23:45.678Z",
  "agent": "reporter",
  "model": "gpt-5-mini",
  "ok": true,
  "ms": 4231,
  "tokensIn": 1842,
  "tokensOut": 712,
  "meta": { "streaming": true }
}
```

Vercel automatically captures these in **Project → Logs**. Filter syntax:

```
kind:llm                    # all agent calls
kind:llm agent:reporter     # only Reporter
kind:llm ok:false           # failed runs
kind:llm ms:>5000           # slow calls
```

Errors emit via `console.warn`, success via `console.log`, so they sort
correctly in Vercel's UI.

## Upgrading to LangFuse (optional)

For per-prompt diff views, cost dashboards, conversation tracing across
users, and saved evals, LangFuse Cloud is the natural step up. The
`AgentSpan` shape in `lib/telemetry.ts` was deliberately designed to map
1:1 onto LangFuse's `generation` schema, so the swap is mechanical.

### 1. Sign up + grab keys

[https://cloud.langfuse.com](https://cloud.langfuse.com) — free tier is
generous. From Project Settings → API Keys, copy:

- `LANGFUSE_PUBLIC_KEY` (pk-lf-...)
- `LANGFUSE_SECRET_KEY` (sk-lf-...)
- Base URL: `https://cloud.langfuse.com` (or self-hosted)

### 2. Set Vercel env vars

```bash
vercel env add LANGFUSE_PUBLIC_KEY production
vercel env add LANGFUSE_SECRET_KEY production
vercel env add LANGFUSE_BASEURL production    # https://cloud.langfuse.com
```

### 3. Install the SDK

```bash
pnpm add langfuse
```

### 4. Edit `lib/telemetry.ts`

Replace the `emit()` console calls with langfuse trace + generation
events. Pseudocode:

```ts
import { Langfuse } from "langfuse";

const langfuse =
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
    ? new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL,
      })
    : null;

function emit(span: AgentSpan) {
  // Existing console.log stays — Vercel logs are still useful
  console.log(JSON.stringify({ kind: "llm", ...span }));

  if (!langfuse) return;
  const trace = langfuse.trace({ name: span.agent });
  trace.generation({
    name: span.agent,
    model: span.model,
    usage: {
      input: span.tokensIn,
      output: span.tokensOut,
    },
    output: span.ok ? "ok" : span.error,
    level: span.ok ? "DEFAULT" : "ERROR",
    startTime: new Date(Date.now() - span.ms),
    endTime: new Date(),
    metadata: span.meta,
  });
}
```

### 5. (Optional) Per-user trace correlation

To group traces by Clerk user, pass `userId` through `traceAgent`'s
`meta` from the calling action:

```ts
return traceAgent("reporter", () => ..., { userId, model: "..." });
```

Then `langfuse.trace({ userId: span.meta.userId, ... })` so each user
gets a session view in the LangFuse UI.

### 6. Flush before serverless function ends

Vercel functions exit fast. Add to the end of agent actions:

```ts
import { langfuse } from "@/lib/telemetry";
// ...
await langfuse?.flushAsync();
```

That's it. Existing structured logs keep flowing to Vercel; LangFuse
gets a parallel, richer trace stream.

## Why this two-step approach?

- **Day 1**: zero-setup, free, observable in Vercel UI.
- **When ready**: 5-minute upgrade to LangFuse with no code rewrites
  beyond the central `emit()` function.
