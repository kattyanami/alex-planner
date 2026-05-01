"use client";

import { useState, useTransition } from "react";
import { analyzePortfolio } from "@/lib/actions/analyze";

type AnalyzeResult = Awaited<ReturnType<typeof analyzePortfolio>>;

export function TestAnalyze() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const r = await analyzePortfolio();
      setResult(r);
    });
  }

  return (
    <section className="mt-8 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-1">Multi-agent portfolio analysis (Planner)</h2>
      <p className="text-sm text-zinc-500 mb-4">
        Planner fans out to <strong>Tagger × N + Reporter + Charter + Retirement</strong> via{" "}
        <code className="text-xs">Promise.all</code>. Sample portfolio: 401(k) + Roth IRA, 4 holdings (VOO, BND, QQQ, VEA, GLD), 25 years to retirement.
      </p>

      <button
        onClick={onClick}
        disabled={pending}
        className="h-10 px-5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50"
      >
        {pending ? "Running 7 agent calls in parallel..." : "Analyze portfolio (Planner)"}
      </button>

      {result && "error" in result && result.error && (
        <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
          {result.error}
        </div>
      )}

      {result && "ok" in result && result.ok && (
        <div className="mt-6 space-y-6">
          <div className="text-xs text-zinc-500 font-mono">
            {result.parallelCalls} parallel calls · {result.totalTokensIn} in / {result.totalTokensOut} out · {result.totalMs} ms · estimated cost: ${(
              (result.totalTokensIn * 0.25 + result.totalTokensOut * 2) / 1_000_000
            ).toFixed(4)}
          </div>

          <Panel
            title={`Tagger × ${result.tagger.length} (re-classified each holding)`}
            stats={{
              tokensIn: result.tagger.reduce((s, t) => s + t.tokensIn, 0),
              tokensOut: result.tagger.reduce((s, t) => s + t.tokensOut, 0),
              ms: Math.max(...result.tagger.map((t) => t.ms)),
            }}
          >
            <div className="space-y-2">
              {result.tagger.map((t) => (
                <div key={t.symbol} className="text-xs bg-zinc-50 dark:bg-zinc-900 p-2 rounded font-mono">
                  <span className="font-semibold">{t.symbol}</span>{" "}
                  · ${t.classification.current_price.toFixed(2)}
                  {" · "}
                  {Object.entries(t.classification.allocation_asset_class)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k}: ${v.toFixed(0)}%`)
                    .join(", ")}
                  {" · "}
                  {t.tokensIn}/{t.tokensOut} tokens · {t.ms}ms
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Reporter — markdown analysis" stats={result.report}>
            <pre className="text-sm whitespace-pre-wrap font-sans bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg max-h-[400px] overflow-y-auto">
              {result.report.markdown}
            </pre>
          </Panel>

          <Panel title="Charter — chart specs" stats={result.charts}>
            <div className="space-y-3">
              {result.charts.charts.map((c) => (
                <div key={c.key} className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg">
                  <div className="font-semibold">
                    {c.title}{" "}
                    <span className="text-xs text-zinc-500 font-normal">({c.type})</span>
                  </div>
                  <div className="text-xs text-zinc-500 mb-2">{c.description}</div>
                  <div className="flex flex-wrap gap-2">
                    {c.data.map((d) => (
                      <span
                        key={d.name}
                        className="text-xs px-2 py-1 rounded font-mono"
                        style={{ backgroundColor: d.color + "33", color: d.color }}
                      >
                        {d.name}: ${d.value.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Retirement — analysis + Monte Carlo" stats={result.retirement}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3 text-xs">
              <Stat label="Success rate" value={`${result.retirement.metrics.monteCarlo.success_rate}%`} />
              <Stat label="Expected at retirement" value={`$${result.retirement.metrics.monteCarlo.expected_at_retirement.toLocaleString()}`} />
              <Stat label="Median final" value={`$${result.retirement.metrics.monteCarlo.median_final.toLocaleString()}`} />
              <Stat label="10th percentile" value={`$${result.retirement.metrics.monteCarlo.p10.toLocaleString()}`} />
              <Stat label="90th percentile" value={`$${result.retirement.metrics.monteCarlo.p90.toLocaleString()}`} />
              <Stat label="Avg years lasted" value={`${result.retirement.metrics.monteCarlo.avg_years_lasted} / 30`} />
            </div>
            <pre className="text-sm whitespace-pre-wrap font-sans bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg max-h-[400px] overflow-y-auto">
              {result.retirement.markdown}
            </pre>
          </Panel>
        </div>
      )}
    </section>
  );
}

function Panel({
  title,
  stats,
  children,
}: {
  title: string;
  stats: { tokensIn: number; tokensOut: number; ms: number };
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-zinc-500 font-mono">
          {stats.tokensIn} in / {stats.tokensOut} out · {stats.ms} ms
        </span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 rounded bg-zinc-100 dark:bg-zinc-900">
      <div className="text-zinc-500">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
