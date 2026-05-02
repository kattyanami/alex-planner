/**
 * Polygon.io adapter — official, paid (free tier: 5 calls/min, EOD data).
 *
 * Free tier endpoints used:
 *  - /v2/aggs/ticker/{ticker}/prev — previous close
 *  - /v3/reference/tickers/{ticker} — instrument metadata (name, type, exchange)
 *
 * Paid-tier endpoints (gracefully fall through if 401/403):
 *  - /v3/snapshot/locale/us/markets/stocks/tickers — bulk snapshot
 *
 * Symbol normalization:
 *  - Stocks/ETFs: AAPL, SPY (no change)
 *  - Crypto: BTC → X:BTCUSD (Polygon prefix)
 *  - Multi-class: BRK.B (Polygon uses dot)
 */
import type { Quote } from "../prices";

const COMMON_CRYPTO = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT",
  "MATIC", "AVAX", "LINK", "UNI", "LTC", "ATOM", "TRX",
]);

export function normalizeForPolygon(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.startsWith("X:") || s.startsWith("C:")) return s;
  if (COMMON_CRYPTO.has(s)) return `X:${s}USD`;
  // BRK-B → BRK.B (Polygon uses dot)
  if (s.includes("-") && !s.includes("USD")) return s.replace("-", ".");
  return s;
}

// Polygon rebranded to Massive in 2025. Both api.polygon.io and api.massive.com
// currently resolve to the same backend. Override via POLYGON_API_BASE if/when
// the old domain is sunset.
const BASE = process.env.POLYGON_API_BASE ?? "https://api.polygon.io";

function apiKey(): string | null {
  return process.env.POLYGON_API_KEY ?? null;
}

type PrevAggResponse = {
  status?: string;
  results?: Array<{
    T?: string; // ticker
    c?: number; // close
    h?: number; // high
    l?: number; // low
    o?: number; // open
    v?: number; // volume
    t?: number; // timestamp ms
  }>;
};

type TickerDetailsResponse = {
  results?: {
    ticker?: string;
    name?: string;
    market?: string;
    locale?: string;
    type?: string;
    currency_name?: string;
  };
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "alex-planner/1.0" },
    });
    if (!res.ok) {
      // 401: bad key, 403: paid-only, 429: rate limit
      if (res.status === 429) {
        console.warn(`[polygon] rate limited`);
      } else if (res.status === 401 || res.status === 403) {
        console.warn(`[polygon] auth/permission (${res.status}) on ${url}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[polygon] fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Full quote with name + currency. Costs 2 free-tier API calls.
 * Use for catalog adds where we want the metadata.
 */
export async function fetchPolygonQuote(rawSymbol: string): Promise<Quote | null> {
  const key = apiKey();
  if (!key) return null;

  const symbol = normalizeForPolygon(rawSymbol);
  const original = rawSymbol.trim().toUpperCase();

  const prev = await getJson<PrevAggResponse>(
    `${BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${key}`,
  );
  const close = prev?.results?.[0]?.c;
  if (close == null || close <= 0) return null;

  let longName: string | null = null;
  let currency: string | null = null;
  const details = await getJson<TickerDetailsResponse>(
    `${BASE}/v3/reference/tickers/${encodeURIComponent(symbol)}?apiKey=${key}`,
  );
  if (details?.results?.name) longName = details.results.name;
  if (details?.results?.currency_name) currency = details.results.currency_name;

  return {
    symbol: original,
    price: close,
    currency,
    shortName: null,
    longName,
    provider: "polygon",
    fetchedAt: new Date(),
  };
}

/**
 * Price-only fetch. 1 free-tier API call per symbol. Use for bulk refreshes
 * where we already have the name in the DB.
 */
export async function fetchPolygonPrice(rawSymbol: string): Promise<Quote | null> {
  const key = apiKey();
  if (!key) return null;

  const symbol = normalizeForPolygon(rawSymbol);
  const original = rawSymbol.trim().toUpperCase();

  const prev = await getJson<PrevAggResponse>(
    `${BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${key}`,
  );
  const close = prev?.results?.[0]?.c;
  if (close == null || close <= 0) return null;

  return {
    symbol: original,
    price: close,
    currency: null,
    shortName: null,
    longName: null,
    provider: "polygon",
    fetchedAt: new Date(),
  };
}

type SnapshotResponse = {
  status?: string;
  tickers?: Array<{
    ticker?: string;
    day?: { c?: number };
    prevDay?: { c?: number };
    lastTrade?: { p?: number };
    min?: { c?: number };
  }>;
};

/**
 * Bulk snapshot — paid only (Starter tier+). Returns null if 403/401.
 * Caller should fall back to per-symbol prev-close (free tier) or Yahoo.
 */
export async function fetchPolygonBulkSnapshot(
  rawSymbols: string[],
): Promise<Map<string, Quote> | null> {
  const key = apiKey();
  if (!key || rawSymbols.length === 0) return null;

  const out = new Map<string, Quote>();
  // Polygon's snapshot endpoint accepts up to 250 tickers via tickers=A,B,C
  const stockSymbols = rawSymbols
    .map((s) => ({ raw: s.trim().toUpperCase(), normalized: normalizeForPolygon(s) }))
    .filter((s) => !s.normalized.startsWith("X:") && !s.normalized.startsWith("C:"));

  if (stockSymbols.length === 0) return out;

  const tickers = stockSymbols.map((s) => s.normalized).join(",");
  const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickers)}&apiKey=${key}`;

  const res = await getJson<SnapshotResponse>(url);
  if (!res || !res.tickers) return null; // permission denied → fall through

  for (const t of res.tickers) {
    if (!t.ticker) continue;
    const orig = stockSymbols.find((s) => s.normalized === t.ticker)?.raw;
    if (!orig) continue;
    const price = t.day?.c ?? t.lastTrade?.p ?? t.prevDay?.c ?? null;
    if (price == null || price <= 0) continue;
    out.set(orig, {
      symbol: orig,
      price,
      currency: "USD",
      shortName: null,
      longName: null,
      provider: "polygon",
      fetchedAt: new Date(),
    });
  }
  return out;
}

/**
 * Free-tier-safe bulk fetch. Uses price-only endpoint (1 call/symbol),
 * runs in parallel up to maxCalls. Default 5 fits the 5-calls/min limit.
 * Caller should pass remaining symbols to Yahoo to fill the gap.
 */
export async function fetchPolygonPricesParallel(
  rawSymbols: string[],
  opts: { maxCalls?: number } = {},
): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const max = opts.maxCalls ?? 5;
  const limit = Math.min(rawSymbols.length, max);
  const slice = rawSymbols.slice(0, limit);

  const results = await Promise.all(slice.map((s) => fetchPolygonPrice(s)));
  for (let i = 0; i < slice.length; i++) {
    const q = results[i];
    if (q) out.set(slice[i].trim().toUpperCase(), q);
  }
  return out;
}

export function isPolygonConfigured(): boolean {
  return !!apiKey();
}
