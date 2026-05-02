"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { AssetSlice } from "@/lib/finance/aggregate";
import { fmtUsd } from "@/lib/format";

export function AllocationDonut({
  slices,
  total,
  size = 200,
}: {
  slices: AssetSlice[];
  total: number;
  size?: number;
}) {
  if (slices.length === 0) {
    return (
      <div
        className="rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 grid place-items-center text-xs text-zinc-500"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const inner = size * 0.32;
  const outer = size * 0.48;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
            Total
          </div>
          <div className="text-xl font-bold tabular-nums tracking-tight">
            {fmtUsd(total, { compact: total >= 100_000 })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AllocationLegend({
  slices,
  total,
}: {
  slices: AssetSlice[];
  total: number;
}) {
  return (
    <div className="space-y-2">
      {slices.map((s) => {
        const pct = total ? (s.value / total) * 100 : 0;
        return (
          <div key={s.key} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-3 rounded-sm shrink-0 ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400 font-medium">
              {pct.toFixed(0)}%
            </span>
            <span className="tabular-nums font-semibold w-20 text-right">
              {fmtUsd(s.value, { compact: s.value >= 10_000 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
