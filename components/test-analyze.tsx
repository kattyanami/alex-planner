"use client";

import { useEffect, useState } from "react";
import {
  runTaggerAgent,
  runReporterAgent,
  runCharterAgent,
  runRetirementAgent,
  type TaggerActionResult,
  type ReporterActionResult,
  type CharterActionResult,
  type RetirementActionResult,
} from "@/lib/actions/analyze";

type AgentStatus = "idle" | "running" | "done" | "error";

type AgentState<T> = {
  status: AgentStatus;
  startedAt?: number;
  finishedAt?: number;
  data?: T;
  error?: string;
};

type TaggerData = Extract<TaggerActionResult, { ok: true }>;
type ReporterData = Extract<ReporterActionResult, { ok: true }>["result"];
type CharterData = Extract<CharterActionResult, { ok: true }>["result"];
type RetirementData = Extract<RetirementActionResult, { ok: true }>["result"];

const initial = <T,>(): AgentState<T> => ({ status: "idle" });

export function TestAnalyze({ hasPortfolio = true }: { hasPortfolio?: boolean }) {
  const [tagger, setTagger] = useState<AgentState<TaggerData>>(initial);
  const [reporter, setReporter] = useState<AgentState<ReporterData>>(initial);
  const [charter, setCharter] = useState<AgentState<CharterData>>(initial);
  const [retirement, setRetirement] = useState<AgentState<RetirementData>>(initial);

  const anyRunning =
    tagger.status === "running" ||
    reporter.status === "running" ||
    charter.status === "running" ||
    retirement.status === "running";

  async function runAll() {
    const now = Date.now();
    setTagger({ status: "running", startedAt: now });
    setReporter({ status: "running", startedAt: now });
    setCharter({ status: "running", startedAt: now });
    setRetirement({ status: "running", startedAt: now });

    // Fire all four in parallel — each settles independently and updates its own card.
    void runTaggerAgent().then((r) => {
      if ("error" in r) setTagger({ status: "error", error: r.error, finishedAt: Date.now() });
      else setTagger({ status: "done", data: r, finishedAt: Date.now() });
    });
    void runReporterAgent().then((r) => {
      if ("error" in r) setReporter({ status: "error", error: r.error, finishedAt: Date.now() });
      else setReporter({ status: "done", data: r.result, finishedAt: Date.now() });
    });
    void runCharterAgent().then((r) => {
      if ("error" in r) setCharter({ status: "error", error: r.error, finishedAt: Date.now() });
      else setCharter({ status: "done", data: r.result, finishedAt: Date.now() });
    });
    void runRetirementAgent().then((r) => {
      if ("error" in r) setRetirement({ status: "error", error: r.error, finishedAt: Date.now() });
      else setRetirement({ status: "done", data: r.result, finishedAt: Date.now() });
    });
  }

  function reset() {
    setTagger(initial);
    setReporter(initial);
    setCharter(initial);
    setRetirement(initial);
  }

  const totalIn =
    (tagger.data?.results.reduce((s, t) => s + t.tokensIn, 0) ?? 0) +
    (reporter.data?.tokensIn ?? 0) +
    (charter.data?.tokensIn ?? 0) +
    (retirement.data?.tokensIn ?? 0);
  const totalOut =
    (tagger.data?.results.reduce((s, t) => s + t.tokensOut, 0) ?? 0) +
    (reporter.data?.tokensOut ?? 0) +
    (charter.data?.tokensOut ?? 0) +
    (retirement.data?.tokensOut ?? 0);
  const cost = (totalIn * 0.25 + totalOut * 2) / 1_000_000;

  return (
    <section className="mt-8 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Multi-agent portfolio analysis (Planner)</h2>
        {(totalIn > 0 || totalOut > 0) && (
          <div className="text-xs text-zinc-500 font-mono">
            {totalIn} in / {totalOut} out · ${cost.toFixed(4)}
          </div>
        )}
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        Planner fans out to <strong>Tagger × N + Reporter + Charter + Retirement</strong> via{" "}
        <code className="text-xs">Promise.all</code>. Runs against <strong>your</strong> portfolio + profile above. Each card below updates independently as its agent finishes.
      </p>

      {!hasPortfolio && (
        <div className="mb-4 p-3 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          Add at least one holding above (or click <strong>Load sample portfolio</strong>) before running the analysis.
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={runAll}
          disabled={anyRunning || !hasPortfolio}
          className="h-10 px-5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50"
        >
          {anyRunning ? "Running 4 agents in parallel…" : "Analyze portfolio (Planner)"}
        </button>
        {(tagger.status !== "idle" || reporter.status !== "idle") && !anyRunning && (
          <button
            onClick={reset}
            className="h-10 px-5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
          >
            Reset
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AgentCard
          title="Tagger"
          subtitle="Re-classifies each holding (1 call per position)"
          state={tagger}
          stats={
            tagger.data
              ? {
                  tokensIn: tagger.data.results.reduce((s, t) => s + t.tokensIn, 0),
                  tokensOut: tagger.data.results.reduce((s, t) => s + t.tokensOut, 0),
                  ms: Math.max(...tagger.data.results.map((t) => t.ms)),
                }
              : undefined
          }
        >
          {tagger.data && (
            <div className="space-y-1.5">
              {tagger.data.results.map((t) => (
                <div key={t.symbol} className="text-xs bg-zinc-50 dark:bg-zinc-900 p-2 rounded font-mono">
                  <span className="font-semibold">{t.symbol}</span>{" "}
                  · ${t.classification.current_price.toFixed(2)}
                  {" · "}
                  {Object.entries(t.classification.allocation_asset_class)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k}: ${v.toFixed(0)}%`)
                    .join(", ")}
                  {" · "}
                  <span className="text-zinc-500">
                    {t.tokensIn}/{t.tokensOut} · {t.ms}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </AgentCard>

        <AgentCard
          title="Reporter"
          subtitle="Markdown portfolio analysis (generateText)"
          state={reporter}
          stats={
            reporter.data
              ? { tokensIn: reporter.data.tokensIn, tokensOut: reporter.data.tokensOut, ms: reporter.data.ms }
              : undefined
          }
        >
          {reporter.data && (
            <pre className="text-xs whitespace-pre-wrap font-sans bg-zinc-50 dark:bg-zinc-900 p-3 rounded max-h-[300px] overflow-y-auto">
              {reporter.data.markdown}
            </pre>
          )}
        </AgentCard>

        <AgentCard
          title="Charter"
          subtitle="Chart specs from pre-computed aggregates (generateObject)"
          state={charter}
          stats={
            charter.data
              ? { tokensIn: charter.data.tokensIn, tokensOut: charter.data.tokensOut, ms: charter.data.ms }
              : undefined
          }
        >
          {charter.data && (
            <div className="space-y-2">
              {charter.data.charts.map((c) => (
                <div key={c.key} className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                  <div className="text-xs font-semibold">
                    {c.title}{" "}
                    <span className="text-zinc-500 font-normal">({c.type})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.data.map((d) => (
                      <span
                        key={d.name}
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ backgroundColor: d.color + "33", color: d.color }}
                      >
                        {d.name}: ${d.value.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AgentCard>

        <AgentCard
          title="Retirement"
          subtitle="Monte Carlo (500 sims, TS) + LLM commentary"
          state={retirement}
          stats={
            retirement.data
              ? { tokensIn: retirement.data.tokensIn, tokensOut: retirement.data.tokensOut, ms: retirement.data.ms }
              : undefined
          }
        >
          {retirement.data && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <Stat label="Success" value={`${retirement.data.metrics.monteCarlo.success_rate}%`} />
                <Stat label="Expected at retirement" value={`$${retirement.data.metrics.monteCarlo.expected_at_retirement.toLocaleString()}`} />
                <Stat label="Median final" value={`$${retirement.data.metrics.monteCarlo.median_final.toLocaleString()}`} />
                <Stat label="Avg years lasted" value={`${retirement.data.metrics.monteCarlo.avg_years_lasted}/30`} />
              </div>
              <pre className="text-xs whitespace-pre-wrap font-sans bg-zinc-50 dark:bg-zinc-900 p-3 rounded max-h-[300px] overflow-y-auto">
                {retirement.data.markdown}
              </pre>
            </div>
          )}
        </AgentCard>
      </div>
    </section>
  );
}

function AgentCard({
  title,
  subtitle,
  state,
  stats,
  children,
}: {
  title: string;
  subtitle: string;
  state: AgentState<unknown>;
  stats?: { tokensIn: number; tokensOut: number; ms: number };
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <StatusDot status={state.status} />
          <h3 className="font-semibold">{title}</h3>
        </div>
        {stats && (
          <span className="text-[10px] text-zinc-500 font-mono">
            {stats.tokensIn}/{stats.tokensOut} · {stats.ms}ms
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500 mb-3">{subtitle}</p>
      <div className="flex-1">
        {state.status === "idle" && (
          <div className="text-xs text-zinc-400 italic">Waiting for Planner trigger…</div>
        )}
        {state.status === "running" && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Spinner /> Running on gpt-5-mini…
            {state.startedAt && (
              <ElapsedCounter startedAt={state.startedAt} />
            )}
          </div>
        )}
        {state.status === "error" && (
          <div className="text-xs text-red-600 dark:text-red-400 font-mono break-words">
            {state.error}
          </div>
        )}
        {state.status === "done" && children}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  const cls =
    status === "idle"
      ? "bg-zinc-400"
      : status === "running"
        ? "bg-amber-500 animate-pulse"
        : status === "done"
          ? "bg-emerald-500"
          : "bg-red-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} aria-hidden />;
}

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-200 rounded-full animate-spin" />
  );
}

function ElapsedCounter({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono">{((now - startedAt) / 1000).toFixed(1)}s</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900">
      <div className="text-zinc-500 text-[10px]">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
