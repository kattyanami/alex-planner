"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  FileText,
  Loader2,
  PieChart as PieIcon,
  Sparkles,
  Tag,
  Target,
} from "lucide-react";
import {
  runCharterAgent,
  runReporterAgent,
  runRetirementAgent,
  runTaggerAgent,
  saveAnalysisAction,
  type CharterActionResult,
  type ReporterActionResult,
  type RetirementActionResult,
  type TaggerActionResult,
} from "@/lib/actions/analyze";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { PortfolioChart } from "@/components/charts/portfolio-charts";
import { fmtUsd } from "@/lib/format";

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

  const everRan =
    tagger.status !== "idle" ||
    reporter.status !== "idle" ||
    charter.status !== "idle" ||
    retirement.status !== "idle";

  async function runAll() {
    const now = Date.now();
    setTagger({ status: "running", startedAt: now });
    setReporter({ status: "running", startedAt: now });
    setCharter({ status: "running", startedAt: now });
    setRetirement({ status: "running", startedAt: now });

    const tag = runTaggerAgent().then((r) => {
      if ("error" in r) {
        setTagger({ status: "error", error: r.error, finishedAt: Date.now() });
        return null;
      }
      setTagger({ status: "done", data: r, finishedAt: Date.now() });
      return r;
    });
    const rep = runReporterAgent().then((r) => {
      if ("error" in r) {
        setReporter({ status: "error", error: r.error, finishedAt: Date.now() });
        return null;
      }
      setReporter({ status: "done", data: r.result, finishedAt: Date.now() });
      return r.result;
    });
    const cha = runCharterAgent().then((r) => {
      if ("error" in r) {
        setCharter({ status: "error", error: r.error, finishedAt: Date.now() });
        return null;
      }
      setCharter({ status: "done", data: r.result, finishedAt: Date.now() });
      return r.result;
    });
    const ret = runRetirementAgent().then((r) => {
      if ("error" in r) {
        setRetirement({ status: "error", error: r.error, finishedAt: Date.now() });
        return null;
      }
      setRetirement({ status: "done", data: r.result, finishedAt: Date.now() });
      return r.result;
    });

    const [tagR, repR, chaR, retR] = await Promise.all([tag, rep, cha, ret]);
    if (tagR && repR && chaR && retR) {
      const tIn =
        tagR.results.reduce((s, t) => s + t.tokensIn, 0) +
        repR.tokensIn + chaR.tokensIn + retR.tokensIn;
      const tOut =
        tagR.results.reduce((s, t) => s + t.tokensOut, 0) +
        repR.tokensOut + chaR.tokensOut + retR.tokensOut;
      void saveAnalysisAction({
        reportMarkdown: repR.markdown,
        retirementMarkdown: retR.markdown,
        successRate: retR.metrics.monteCarlo.success_rate,
        expectedAtRetirement: retR.metrics.monteCarlo.expected_at_retirement,
        totalValue: retR.metrics.portfolioValue,
        charts: chaR.charts,
        durations: {
          tagger: Math.max(...tagR.results.map((t) => t.ms)),
          reporter: repR.ms,
          charter: chaR.ms,
          retirement: retR.ms,
        },
        tokens: { in: tIn, out: tOut },
      });
    }
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
    <div className="space-y-4">
      <Card>
        <CardHeader
          icon={<Sparkles className="size-4" />}
          title="Multi-agent portfolio analysis"
          description="Planner fans out to Tagger × N + Reporter + Charter + Retirement in parallel. Each card updates independently as its agent finishes."
          action={
            <div className="flex items-center gap-2">
              {totalIn + totalOut > 0 && (
                <Badge tone="neutral" className="font-mono">
                  {totalIn}/{totalOut} · ${cost.toFixed(4)}
                </Badge>
              )}
              {everRan && !anyRunning && (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Reset
                </Button>
              )}
              <Button onClick={runAll} disabled={anyRunning || !hasPortfolio}>
                {anyRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {anyRunning ? "Running…" : "Analyze"}
              </Button>
            </div>
          }
        />
        {!hasPortfolio && (
          <CardBody>
            <EmptyState
              icon={<AlertCircle className="size-5" />}
              title="No portfolio to analyze"
              description="Add at least one holding before running the multi-agent analysis."
            />
          </CardBody>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AgentCard
          title="Tagger"
          icon={<Tag className="size-4" />}
          subtitle="Re-classifies each holding"
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
                <div
                  key={t.symbol}
                  className="flex items-center gap-3 text-xs px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60"
                >
                  <Badge tone="accent" className="font-mono shrink-0">{t.symbol}</Badge>
                  <span className="tabular-nums shrink-0">{fmtUsd(t.classification.current_price)}</span>
                  <span className="text-zinc-500 truncate flex-1">
                    {Object.entries(t.classification.allocation_asset_class)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => `${k}: ${v.toFixed(0)}%`)
                      .join(", ")}
                  </span>
                  <span className="text-zinc-400 font-mono shrink-0">{t.ms}ms</span>
                </div>
              ))}
            </div>
          )}
        </AgentCard>

        <AgentCard
          title="Reporter"
          icon={<FileText className="size-4" />}
          subtitle="Markdown portfolio analysis"
          state={reporter}
          stats={
            reporter.data
              ? { tokensIn: reporter.data.tokensIn, tokensOut: reporter.data.tokensOut, ms: reporter.data.ms }
              : undefined
          }
        >
          {reporter.data && (
            <pre className="text-xs whitespace-pre-wrap font-sans bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-lg max-h-[320px] overflow-y-auto leading-relaxed">
              {reporter.data.markdown}
            </pre>
          )}
        </AgentCard>

        <AgentCard
          title="Charter"
          icon={<PieIcon className="size-4" />}
          subtitle="Chart specs + visualizations"
          state={charter}
          stats={
            charter.data
              ? { tokensIn: charter.data.tokensIn, tokensOut: charter.data.tokensOut, ms: charter.data.ms }
              : undefined
          }
        >
          {charter.data && (
            <div className="space-y-3">
              {charter.data.charts.map((c) => (
                <div
                  key={c.key}
                  className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 p-3"
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-sm font-semibold">{c.title}</div>
                    <Badge tone="neutral">{c.type}</Badge>
                  </div>
                  <PortfolioChart spec={c} />
                </div>
              ))}
            </div>
          )}
        </AgentCard>

        <AgentCard
          title="Retirement"
          icon={<Target className="size-4" />}
          subtitle="Monte Carlo (500 sims) + analysis"
          state={retirement}
          stats={
            retirement.data
              ? { tokensIn: retirement.data.tokensIn, tokensOut: retirement.data.tokensOut, ms: retirement.data.ms }
              : undefined
          }
        >
          {retirement.data && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MetricTile
                  label="Success rate"
                  value={`${retirement.data.metrics.monteCarlo.success_rate}%`}
                  tone={
                    retirement.data.metrics.monteCarlo.success_rate >= 80
                      ? "success"
                      : retirement.data.metrics.monteCarlo.success_rate >= 50
                        ? "warning"
                        : "danger"
                  }
                />
                <MetricTile
                  label="Expected at retirement"
                  value={fmtUsd(retirement.data.metrics.monteCarlo.expected_at_retirement, { compact: true })}
                />
                <MetricTile
                  label="Median final"
                  value={fmtUsd(retirement.data.metrics.monteCarlo.median_final, { compact: true })}
                />
                <MetricTile
                  label="Avg years lasted"
                  value={`${retirement.data.metrics.monteCarlo.avg_years_lasted}/30`}
                />
              </div>
              <pre className="text-xs whitespace-pre-wrap font-sans bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-lg max-h-[320px] overflow-y-auto leading-relaxed">
                {retirement.data.markdown}
              </pre>
            </div>
          )}
        </AgentCard>
      </div>
    </div>
  );
}

function AgentCard({
  title,
  subtitle,
  icon,
  state,
  stats,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  state: AgentState<unknown>;
  stats?: { tokensIn: number; tokensOut: number; ms: number };
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`mt-0.5 size-9 grid place-items-center rounded-lg shrink-0 transition ${
              state.status === "done"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : state.status === "running"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : state.status === "error"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold tracking-tight">{title}</h3>
              <StatusBadge status={state.status} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {stats && (
          <div className="text-right text-[10px] text-zinc-500 font-mono tabular-nums shrink-0">
            <div>
              {stats.tokensIn}/{stats.tokensOut}
            </div>
            <div>{stats.ms}ms</div>
          </div>
        )}
      </div>
      <CardBody>
        {state.status === "idle" && (
          <div className="text-center py-6">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Waiting for Planner trigger…</div>
          </div>
        )}
        {state.status === "running" && (
          <div className="text-center py-6 space-y-3">
            <Loader2 className="size-6 mx-auto animate-spin text-amber-500" />
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Running on gpt-5-mini ·{" "}
              {state.startedAt && <ElapsedCounter startedAt={state.startedAt} />}
            </div>
            <SkeletonRows />
          </div>
        )}
        {state.status === "error" && (
          <div className="rounded-lg p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm font-mono break-words">
            {state.error}
          </div>
        )}
        {state.status === "done" && children}
      </CardBody>
    </Card>
  );
}

function StatusBadge({ status }: { status: AgentStatus }) {
  if (status === "idle") return <Badge tone="neutral">idle</Badge>;
  if (status === "running")
    return (
      <Badge tone="warning">
        <Activity className="size-2.5 animate-pulse" />
        running
      </Badge>
    );
  if (status === "done")
    return (
      <Badge tone="success">
        <Check className="size-2.5" />
        done
      </Badge>
    );
  return (
    <Badge tone="danger">
      <AlertCircle className="size-2.5" />
      error
    </Badge>
  );
}

function ElapsedCounter({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums">{((now - startedAt) / 1000).toFixed(1)}s</span>;
}

function SkeletonRows() {
  return (
    <div className="space-y-2 pt-2">
      <div className="h-3 rounded bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse w-full" />
      <div className="h-3 rounded bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse w-5/6" />
      <div className="h-3 rounded bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse w-2/3" />
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "from-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
      : tone === "warning"
        ? "from-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
        : tone === "danger"
          ? "from-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
          : "from-zinc-500/5 border-zinc-200 dark:border-zinc-800";
  return (
    <div className={`rounded-lg border bg-gradient-to-br to-transparent p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

