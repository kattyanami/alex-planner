/**
 * Number / currency formatters used across the dashboard UI.
 */

export function fmtUsd(n: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = false, decimals } = opts;
  if (compact && Math.abs(n) >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(n);
}

export function fmtPct(n: number, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function fmtNumber(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US").format(n);
}

export function titleCase(s: string) {
  return s
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
