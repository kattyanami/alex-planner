/**
 * Researcher agent.
 *
 * Mirrors the right side of the AWS architecture diagram:
 *   Scheduler → Researcher → Ingest → Vector Store
 *
 * v1 implementation: HTTP-based via yahoo-finance2's search() module —
 * returns up to 6 recent news headlines per symbol with publisher,
 * publish time, and link.
 *
 * Upgrade path (Phase 5b): swap the inner fetcher for a Vercel Sandbox +
 * Playwright session that scrapes JS-heavy pages (SEC EDGAR full-text
 * filings, earnings call transcripts, brokerage analyst notes). Same
 * function signature, drop-in replacement — the rest of the pipeline
 * (dedup hash, DB upsert, Reporter consumption) stays identical.
 */

import crypto from "node:crypto";
import YahooFinance from "yahoo-finance2";
import { normalizeForYahoo } from "@/lib/finance/providers/yahoo";
import { traceAgent } from "@/lib/telemetry";

const yahooFinance = new YahooFinance();

export type ResearchSource = "yahoo_news" | "sec_edgar" | "manual";

export type ResearchDoc = {
  symbol: string;
  source: ResearchSource;
  url: string;
  title: string;
  content: string | null;
  hash: string;
  publishedAt: Date | null;
  metadata: Record<string, unknown> | null;
};

function hashFor(parts: (string | undefined)[]): string {
  return crypto
    .createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Fetch recent news for a symbol from Yahoo Finance. Returns up to N docs,
 * deduplicated by URL hash on the caller side via the unique
 * (symbol, hash) constraint on research_documents.
 */
export async function researchSymbol(
  rawSymbol: string,
  opts: { newsCount?: number } = {},
): Promise<ResearchDoc[]> {
  return traceAgent(
    "researcher",
    () => researchSymbolInner(rawSymbol, opts),
    { provider: "yahoo_news", symbol: rawSymbol.trim().toUpperCase() },
  );
}

async function researchSymbolInner(
  rawSymbol: string,
  opts: { newsCount?: number } = {},
): Promise<ResearchDoc[]> {
  const symbol = rawSymbol.trim().toUpperCase();
  // Yahoo's search uses the same ticker form as quote() does — we pass
  // through the normalizer to handle BTC → BTC-USD, BRK.B → BRK-B.
  const querySymbol = normalizeForYahoo(rawSymbol);
  const newsCount = opts.newsCount ?? 6;

  try {
    const result = (await yahooFinance.search(querySymbol, {
      newsCount,
      quotesCount: 0,
      enableFuzzyQuery: false,
    })) as unknown as {
      news?: Array<{
        uuid?: string;
        title?: string;
        publisher?: string;
        link?: string;
        providerPublishTime?: number | Date;
        type?: string;
        relatedTickers?: string[];
      }>;
    };

    const news = result?.news ?? [];
    return news
      .filter((n) => n.title && n.link)
      .map((n) => {
        const publishedAt =
          n.providerPublishTime instanceof Date
            ? n.providerPublishTime
            : typeof n.providerPublishTime === "number"
              ? new Date(n.providerPublishTime * 1000)
              : null;
        return {
          symbol,
          source: "yahoo_news" as const,
          url: n.link!,
          title: n.title!,
          content: n.publisher ?? null,
          hash: hashFor([n.uuid, n.link, n.title]),
          publishedAt,
          metadata: {
            publisher: n.publisher ?? null,
            type: n.type ?? null,
            relatedTickers: n.relatedTickers ?? null,
          },
        };
      });
  } catch (err) {
    console.warn(
      `[researcher] ${symbol} failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Fan out research across many symbols in parallel. Returns a flat list,
 * caller can group by symbol via doc.symbol.
 */
export async function researchSymbols(
  symbols: string[],
): Promise<ResearchDoc[]> {
  if (symbols.length === 0) return [];
  const lists = await Promise.all(symbols.map((s) => researchSymbol(s)));
  return lists.flat();
}
