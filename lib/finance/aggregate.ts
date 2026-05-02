/**
 * Pure-TS portfolio aggregation. Used by the Overview page (server-side, no LLM)
 * and by the Charter agent. Single source of truth for portfolio math.
 */
import type { Portfolio } from "@/lib/agents/reporter";

export function aggregatePortfolio(portfolio: Portfolio) {
  let totalValue = 0;
  const positionValues: Record<string, number> = {};
  const accountTotals: Record<string, { value: number; positions: number }> = {};
  const assetClasses: Record<string, number> = {};
  const regions: Record<string, number> = {};
  const sectors: Record<string, number> = {};

  for (const account of portfolio.accounts) {
    const cash = Number(account.cash_balance) || 0;
    accountTotals[account.name] = { value: cash, positions: account.positions.length };
    totalValue += cash;
    if (cash > 0) assetClasses.cash = (assetClasses.cash ?? 0) + cash;

    for (const pos of account.positions) {
      const price = Number(pos.instrument.current_price) || 0;
      const qty = Number(pos.quantity) || 0;
      const value = price * qty;
      positionValues[pos.symbol] = (positionValues[pos.symbol] ?? 0) + value;
      accountTotals[account.name].value += value;
      totalValue += value;

      for (const [k, v] of Object.entries(pos.instrument.allocation_asset_class ?? {})) {
        assetClasses[k] = (assetClasses[k] ?? 0) + value * (Number(v) / 100);
      }
      for (const [k, v] of Object.entries(pos.instrument.allocation_regions ?? {})) {
        regions[k] = (regions[k] ?? 0) + value * (Number(v) / 100);
      }
      for (const [k, v] of Object.entries(pos.instrument.allocation_sectors ?? {})) {
        sectors[k] = (sectors[k] ?? 0) + value * (Number(v) / 100);
      }
    }
  }

  return { totalValue, positionValues, accountTotals, assetClasses, regions, sectors };
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "#10b981",
  fixed_income: "#0ea5e9",
  bonds: "#0ea5e9",
  real_estate: "#a855f7",
  commodities: "#f59e0b",
  cash: "#6b7280",
  alternatives: "#ec4899",
  crypto: "#f97316",
};

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Equity",
  fixed_income: "Fixed Income",
  bonds: "Fixed Income",
  real_estate: "Real Estate",
  commodities: "Commodities",
  cash: "Cash",
  alternatives: "Alternatives",
  crypto: "Crypto",
};

export type AssetSlice = { key: string; name: string; value: number; color: string };

export function buildAssetClassChartData(portfolio: Portfolio): AssetSlice[] {
  const { assetClasses } = aggregatePortfolio(portfolio);
  return Object.entries(assetClasses)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      key,
      name: ASSET_CLASS_LABELS[key] ?? key,
      value: Math.round(value),
      color: ASSET_CLASS_COLORS[key] ?? "#71717a",
    }));
}

export type HoldingSlice = { symbol: string; name: string; value: number; color: string };

export function buildTopHoldingsChartData(
  portfolio: Portfolio,
  limit = 6,
): HoldingSlice[] {
  const palette = ["#10b981", "#0ea5e9", "#a855f7", "#f59e0b", "#ec4899", "#f97316", "#22c55e", "#3b82f6"];
  const byPosition: Record<string, { name: string; value: number }> = {};
  for (const account of portfolio.accounts) {
    for (const pos of account.positions) {
      const price = Number(pos.instrument.current_price) || 0;
      const qty = Number(pos.quantity) || 0;
      const value = price * qty;
      const existing = byPosition[pos.symbol] ?? { name: pos.instrument.name, value: 0 };
      byPosition[pos.symbol] = { name: existing.name, value: existing.value + value };
    }
  }
  return Object.entries(byPosition)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, limit)
    .map(([symbol, { name, value }], i) => ({
      symbol,
      name,
      value: Math.round(value),
      color: palette[i % palette.length],
    }));
}
