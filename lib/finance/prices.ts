/**
 * Yahoo Finance price fetcher.
 *
 * Free + unofficial — rate-limited to ~2k requests/hour by Yahoo. We bulk-fetch
 * + cache aggressively to stay well under that. Crypto needs a "-USD" suffix
 * (e.g. BTC → BTC-USD); BRK.B is BRK-B on Yahoo. We normalize before lookup.
 */
import yahooFinance from "yahoo-finance2";

// Crypto tickers that should auto-append -USD if not already present.
const COMMON_CRYPTO = new Set([
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "DOT",
  "MATIC",
  "AVAX",
  "LINK",
  "UNI",
  "LTC",
  "ATOM",
  "TRX",
]);

export function normalizeSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  // Berkshire-style: BRK.B → BRK-B on Yahoo
  if (s.includes(".") && !s.includes("-USD")) {
    // dotted multi-class shares like BRK.B / BF.B → use dash on Yahoo
    return s.replace(".", "-");
  }
  // Bare crypto: BTC → BTC-USD
  if (COMMON_CRYPTO.has(s)) return `${s}-USD`;
  return s;
}

export type YahooQuote = {
  symbol: string;
  price: number;
  currency: string | null;
  shortName: string | null;
  longName: string | null;
  marketState: string | null;
  fetchedAt: Date;
};

/**
 * Fetch a single quote. Returns null if the symbol is unknown / rate-limited.
 */
export async function fetchQuote(rawSymbol: string): Promise<YahooQuote | null> {
  const symbol = normalizeSymbol(rawSymbol);
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
      marketState: (q.marketState as string | undefined) ?? null,
      fetchedAt: new Date(),
    };
  } catch (err) {
    // 404, network error, rate-limit — all bucketed as "no result"
    console.warn(
      `[yahoo] failed to fetch ${symbol}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch many quotes in one batched call. Yahoo's quote endpoint accepts
 * comma-separated symbols up to ~50.
 */
export async function fetchQuotes(rawSymbols: string[]): Promise<Map<string, YahooQuote>> {
  if (rawSymbols.length === 0) return new Map();
  const normalized = rawSymbols.map((s) => ({ raw: s.trim().toUpperCase(), normalized: normalizeSymbol(s) }));
  const out = new Map<string, YahooQuote>();
  try {
    // Chunk to be polite — 25 at a time.
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
          marketState: (q.marketState as string | undefined) ?? null,
          fetchedAt: new Date(),
        });
      }
    }
  } catch (err) {
    console.warn(
      "[yahoo] batch fetch failed:",
      err instanceof Error ? err.message : err,
    );
  }
  return out;
}

/**
 * Stale check — used to decide whether to skip a refresh.
 */
export function isPriceStale(updatedAt: Date | null | undefined, maxAgeMinutes = 15) {
  if (!updatedAt) return true;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs > maxAgeMinutes * 60_000;
}
