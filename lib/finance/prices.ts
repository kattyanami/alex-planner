/**
 * Price provider dispatcher.
 *
 * Tries Polygon.io first (when POLYGON_API_KEY is set) — official,
 * higher-quality data. Falls back to Yahoo Finance (unofficial, free)
 * for misses, crypto symbols Polygon doesn't have, or when the key is
 * absent.
 *
 * For bulk refresh, tries Polygon's bulk snapshot (paid-tier endpoint),
 * falls through to Yahoo if 401/403.
 */
import {
  fetchPolygonBulkSnapshot,
  fetchPolygonQuote,
  isPolygonConfigured,
} from "./providers/polygon";
import { fetchYahooQuote, fetchYahooQuotes } from "./providers/yahoo";

export type PriceProvider = "polygon" | "yahoo";

export type Quote = {
  symbol: string;
  price: number;
  currency: string | null;
  shortName: string | null;
  longName: string | null;
  provider: PriceProvider;
  fetchedAt: Date;
};

/**
 * Fetch a single quote. Try Polygon first; fall back to Yahoo on miss.
 */
export async function fetchQuote(rawSymbol: string): Promise<Quote | null> {
  if (isPolygonConfigured()) {
    const polygon = await fetchPolygonQuote(rawSymbol);
    if (polygon) return polygon;
  }
  return fetchYahooQuote(rawSymbol);
}

/**
 * Fetch many quotes. Strategy:
 *  1. Try Polygon's bulk snapshot endpoint (paid; instant, all-at-once)
 *  2. If 401/403/null (free tier), fall through to Yahoo (free, fast batch)
 *  3. For symbols missed by Polygon (crypto, obscure), top up via Yahoo
 */
export async function fetchQuotes(rawSymbols: string[]): Promise<Map<string, Quote>> {
  if (rawSymbols.length === 0) return new Map();

  let primary = new Map<string, Quote>();
  if (isPolygonConfigured()) {
    const snap = await fetchPolygonBulkSnapshot(rawSymbols);
    if (snap) primary = snap;
  }

  // Symbols still missing → ask Yahoo
  const missing = rawSymbols.filter(
    (s) => !primary.has(s.trim().toUpperCase()),
  );
  if (missing.length > 0) {
    const yahoo = await fetchYahooQuotes(missing);
    for (const [k, v] of yahoo) {
      primary.set(k, v);
    }
  }

  return primary;
}

export function isPriceStale(updatedAt: Date | null | undefined, maxAgeMinutes = 15) {
  if (!updatedAt) return true;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs > maxAgeMinutes * 60_000;
}

export function activeProvider(): PriceProvider | "yahoo-only" {
  return isPolygonConfigured() ? "polygon" : "yahoo-only";
}
