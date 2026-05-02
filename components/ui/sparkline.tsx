"use client";

import { useMemo } from "react";

/**
 * Tiny inline SVG sparkline. Synthetic data for now (will be backed by real
 * historical points once we add the analysis-history table).
 */
export function Sparkline({
  values,
  width = 80,
  height = 28,
  color = "#10b981",
  strokeWidth = 1.5,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { d, areaD } = useMemo(() => {
    if (values.length < 2) return { d: "", areaD: "" };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return [x, y] as const;
    });
    const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area =
      `${path} L${(points[points.length - 1][0]).toFixed(2)},${height} L0,${height} Z`;
    return { d: path, areaD: area };
  }, [values, width, height]);

  if (!d) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkfill)" />
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Generate a synthetic 7-point series tilted up or down by `trend` (-1 to 1)
 * with `noise` magnitude. Stable per `seed` so KPI tiles don't flicker on
 * re-render.
 */
export function syntheticSeries(seed: number, trend = 0.2, points = 7, noise = 0.15): number[] {
  // simple LCG for stable per-seed pseudo-randomness
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < points; i++) {
    v = Math.max(0, Math.min(1, v + trend / points + (rand() - 0.5) * noise));
    out.push(v);
  }
  return out;
}
