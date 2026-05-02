import type { HoldingSlice } from "@/lib/finance/aggregate";
import { fmtUsd } from "@/lib/format";

export function HoldingsStrip({
  holdings,
  total,
}: {
  holdings: HoldingSlice[];
  total: number;
}) {
  if (holdings.length === 0) return null;

  return (
    <div className="space-y-2">
      {holdings.map((h) => {
        const pct = total ? (h.value / total) * 100 : 0;
        return (
          <div key={h.symbol} className="flex items-center gap-3">
            <span
              className="font-mono text-xs px-1.5 py-0.5 rounded ring-1 ring-inset font-semibold tabular-nums shrink-0"
              style={{
                backgroundColor: h.color + "1a",
                color: h.color,
                borderColor: h.color + "33",
              }}
            >
              {h.symbol}
            </span>
            <div className="flex-1 min-w-0">
              <div className="relative h-2 rounded-full bg-zinc-100 dark:bg-zinc-800/80 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: h.color,
                  }}
                />
              </div>
            </div>
            <div className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 w-10 text-right shrink-0">
              {pct.toFixed(0)}%
            </div>
            <div className="text-sm tabular-nums font-semibold w-20 text-right shrink-0">
              {fmtUsd(h.value, { compact: h.value >= 10_000 })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
