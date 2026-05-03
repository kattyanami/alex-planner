"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Newspaper, Sparkles } from "lucide-react";
import { runResearcherForUserAction } from "@/lib/actions/research";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from "@/components/ui/primitives";
import type { ResearchDocument } from "@/lib/db/schema";

type Summary = {
  symbol: string;
  docCount: number;
  lastFetchedAt: Date | null;
  sample: ResearchDocument[];
};

function relTime(date: Date | null) {
  if (!date) return "never";
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function ResearcherPanel({
  summary,
  hasHoldings,
}: {
  summary: Summary[];
  hasHoldings: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function onRun() {
    setMsg(null);
    start(async () => {
      const r = await runResearcherForUserAction();
      if ("error" in r) {
        setMsg({ kind: "err", text: r.error });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Fetched ${r.fetched} docs across ${r.symbols} symbols — ${r.inserted} new, ${r.skipped} dup. (${(r.ms / 1000).toFixed(1)}s)`,
      });
      setTimeout(() => setMsg(null), 10_000);
    });
  }

  const totalDocs = summary.reduce((s, x) => s + x.docCount, 0);

  return (
    <Card>
      <CardHeader
        icon={<Newspaper className="size-4" />}
        title="Researcher"
        description="Fetches recent news headlines per holding via Yahoo Finance. Dedup by URL hash."
        action={
          <Button onClick={onRun} disabled={pending || !hasHoldings}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {pending ? "Researching…" : "Run now"}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {msg && (
          <div
            className={`rounded-lg p-3 text-sm ring-1 ring-inset ${
              msg.kind === "ok"
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-200/50 dark:ring-emerald-500/20"
                : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-red-200/50 dark:ring-red-500/20"
            }`}
          >
            {msg.kind === "ok" ? "✓" : "✗"} {msg.text}
          </div>
        )}

        {!hasHoldings ? (
          <EmptyState
            icon={<Newspaper className="size-5" />}
            title="No holdings yet"
            description="Add positions on the Holdings page first — Researcher fetches news per holding."
          />
        ) : summary.length === 0 || totalDocs === 0 ? (
          <EmptyState
            icon={<Newspaper className="size-5" />}
            title="No research fetched yet"
            description={`You have ${summary.length} ${summary.length === 1 ? "holding" : "holdings"}. Click "Run now" to fetch news for each.`}
          />
        ) : (
          <div className="grid gap-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {totalDocs} {totalDocs === 1 ? "document" : "documents"} across{" "}
              {summary.length} {summary.length === 1 ? "symbol" : "symbols"}
            </div>
            {summary.map((s) => (
              <SymbolPanel key={s.symbol} summary={s} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SymbolPanel({ summary }: { summary: Summary }) {
  return (
    <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Badge tone="accent" className="font-mono">
            {summary.symbol}
          </Badge>
          <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            {summary.docCount} {summary.docCount === 1 ? "doc" : "docs"}
          </span>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          last fetched {relTime(summary.lastFetchedAt)}
        </span>
      </div>
      {summary.sample.length === 0 ? (
        <div className="text-xs text-zinc-500 italic">
          No documents yet — run the Researcher to populate.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {summary.sample.map((d) => (
            <li key={d.id} className="flex items-start gap-2 text-sm">
              <ExternalLink className="size-3 mt-1 text-zinc-400 shrink-0" />
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate flex-1"
                title={d.title}
              >
                {d.title}
              </a>
              <span className="text-xs text-zinc-500 shrink-0 hidden sm:block">
                {d.publishedAt ? relTime(d.publishedAt) : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
