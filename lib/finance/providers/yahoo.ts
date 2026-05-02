/**
 * Yahoo Finance adapter — unofficial, free, rate-limited.
 * Used as the fallback when Polygon is unavailable or for bulk refreshes
 * on the free Polygon tier (which is too rate-limited for 24+ instruments).
 */
import yahooFinance from "yahoo-finance2";
import type { Quote } from "../prices";

// Crypto tickers that should auto-append -USD if not already present.
const COMMON_CRYPTO = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT",
  "MATIC", "AVAX", "LINK", "UNI", "LTC", "ATOM", "TRX",
]);

export function normalizeForYahoo(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.includes(".") && !s.includes("-USD")) return s.replace(".", "-");
  if (COMMON_CRYPTO.has(s)) return `${s}-USD`;
  return s;
}

export async function fetchYahooQuote(rawSymbol: string): Promise<Quote | null> {
  const symbol = normalizeForYahoo(rawSymbol);
  try {
    const raw = (await yahooFinance.quote(symbol)) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const q = raw as Record<string, unknown>;
    const price =
      (q.regularMarketPrice as number | undefined) ??
      (q.postMarketPrice as number | undefined) ??
      (q.preMarketPrice as number | undefined) ??
      null;
    if (price == null || price <= 0) return null;
    return {
      symbol: (q.symbol as string | undefined) ?? symbol,
      price,
      currency: (q.currency as string | undefined) ?? null,
      shortName: (q.shortName as string | undefined) ?? null,
      longName: (q.longName as string | undefined) ?? null,
      provider: "yahoo",
      fetchedAt: new Date(),
    };
  } catch (err) {
    console.warn(`[yahoo] ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchYahooQuotes(
  rawSymbols: string[],
): Promise<Map<string, Quote>> {
  if (rawSymbols.length === 0) return new Map();
  const normalized = rawSymbols.map((s) => ({
    raw: s.trim().toUpperCase(),
    normalized: normalizeForYahoo(s),
  }));
  const out = new Map<string, Quote>();
  try {
    const CHUNK = 25;
    for (let i = 0; i < normalized.length; i += CHUNK) {
      const chunk = normalized.slice(i, i + CHUNK);
      const symbols = chunk.map((c) => c.normalized);
      const res = (await yahooFinance.quote(symbols)) as unknown;
      const arr = Array.isArray(res) ? res : [res];
      for (let j = 0; j < arr.length; j++) {
        const raw = arr[j];
        const original = chunk[j]?.raw ?? "";
        if (!raw || typeof raw !== "object") continue;
        const q = raw as Record<string, unknown>;
        const price =
          (q.regularMarketPrice as number | undefined) ??
          (q.postMarketPrice as number | undefined) ??
          (q.preMarketPrice as number | undefined) ??
          null;
        if (price == null || price <= 0) continue;
        out.set(original, {
          symbol: (q.symbol as string | undefined) ?? chunk[j].normalized,
          price,
          currency: (q.currency as string | undefined) ?? null,
          shortName: (q.shortName as string | undefined) ?? null,
          longName: (q.longName as string | undefined) ?? null,
          provider: "yahoo",
          fetchedAt: new Date(),
        });
      }
    }
  } catch (err) {
    console.warn("[yahoo] batch:", err instanceof Error ? err.message : err);
  }
  return out;
}
