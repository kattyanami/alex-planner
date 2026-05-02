import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Job } from "@/lib/db/schema";
import { Badge, Button } from "@/components/ui/primitives";
import { fmtUsd } from "@/lib/format";

function relativeTime(date: Date | null) {
  if (!date) return "—";
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

export function LastAnalysisCard({ job }: { job: Job | null }) {
  if (!job) {
    return (
      <div className="text-center py-6">
        <div className="size-10 mx-auto grid place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
          <Sparkles className="size-5" />
        </div>
        <div className="font-semibold tracking-tight">No analysis run yet</div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
          Run the multi-agent analysis to generate your first report.
        </p>
        <Link href="/dashboard/analysis">
          <Button>
            <Sparkles className="size-4" />
            Run analysis
          </Button>
        </Link>
      </div>
    );
  }

  const summary = (job.summaryPayload ?? {}) as {
    durations?: { tagger: number; reporter: number; charter: number; retirement: number };
    tokens?: { in: number; out: number };
    successRate?: number;
  };
  const retirement = (job.retirementPayload ?? {}) as {
    successRate?: number;
    expectedAtRetirement?: number;
  };
  const successRate = retirement.successRate ?? summary.successRate;
  const tone =
    successRate == null
      ? "neutral"
      : successRate >= 80
        ? "success"
        : successRate >= 50
          ? "warning"
          : "danger";

  const wallClock = summary.durations
    ? Math.max(
        summary.durations.tagger,
        summary.durations.reporter,
        summary.durations.charter,
        summary.durations.retirement,
      )
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 grid place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold tracking-tight">Latest run</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {relativeTime(job.completedAt)}
            </div>
          </div>
        </div>
        {successRate != null && <Badge tone={tone}>{successRate}% success</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Expected"
          value={
            retirement.expectedAtRetirement
              ? fmtUsd(retirement.expectedAtRetirement, { compact: true })
              : "—"
          }
        />
        <Stat
          label="Tokens"
          value={
            summary.tokens
              ? `${(summary.tokens.in + summary.tokens.out).toLocaleString()}`
              : "—"
          }
        />
        <Stat label="Wall-clock" value={wallClock ? `${(wallClock / 1000).toFixed(1)}s` : "—"} />
      </div>

      <Link href="/dashboard/analysis" className="block">
        <Button variant="secondary" size="sm" className="w-full justify-center">
          View / re-run <ArrowRight className="size-3.5" />
        </Button>
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums truncate">{value}</div>
    </div>
  );
}
