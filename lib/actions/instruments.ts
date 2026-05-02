"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { classifyInstrument } from "@/lib/agents/tagger";
import {
  addInstrument,
  getInstrumentBySymbol,
  listAllInstruments,
  logActivity,
  updateInstrumentPrice,
  type PriceSource,
} from "@/lib/db/queries";
import { fetchQuote, fetchQuotes } from "@/lib/finance/prices";

export type AddInstrumentResult =
  | {
      ok: true;
      created: boolean;
      instrument: {
        symbol: string;
        name: string;
        instrumentType: string;
        currentPrice: number | null;
      };
      tokensIn?: number;
      tokensOut?: number;
      ms?: number;
    }
  | { error: string };

const SYMBOL_RE = /^[A-Z0-9.\-]{1,12}$/;

export async function addInstrumentAction(
  rawSymbol: string,
  hint?: { type?: "etf" | "stock" | "mutual_fund" | "bond_fund" | "other"; name?: string },
): Promise<AddInstrumentResult> {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) return { error: "Symbol is required" };
    if (!SYMBOL_RE.test(symbol)) {
      return {
        error:
          "Invalid symbol — use 1-12 uppercase letters, digits, dots, or dashes (e.g. AAPL, BRK.B, RDS-A)",
      };
    }

    // Idempotent: if it already exists, just return it.
    const existing = await getInstrumentBySymbol(symbol);
    if (existing) {
      return {
        ok: true,
        created: false,
        instrument: {
          symbol: existing.symbol,
          name: existing.name,
          instrumentType: existing.instrumentType ?? "etf",
          currentPrice: existing.currentPrice ? Number(existing.currentPrice) : null,
        },
      };
    }

    // Fan out Tagger (allocations + LLM price) and price provider (real
    // price) in parallel. Provider chain: Polygon → Yahoo → Tagger fallback.
    const [tagger, quote] = await Promise.all([
      classifyInstrument(
        symbol,
        hint?.name?.trim() || symbol,
        hint?.type ?? "etf",
      ),
      fetchQuote(symbol),
    ]);

    const { classification, tokensIn, tokensOut, ms } = tagger;
    const realPrice = quote?.price ?? null;
    const finalPrice = realPrice ?? classification.current_price;
    const priceSource: PriceSource = quote?.provider ?? "tagger";

    const inserted = await addInstrument({
      symbol: classification.symbol.toUpperCase(),
      name: quote?.longName || quote?.shortName || classification.name,
      instrumentType: classification.instrument_type,
      currentPrice: finalPrice,
      priceSource,
      priceUpdatedAt: new Date(),
      allocationAssetClass: classification.allocation_asset_class,
      allocationRegions: classification.allocation_regions,
      allocationSectors: classification.allocation_sectors,
    });

    await logActivity(
      userId,
      "position_added",
      `Tagged new instrument: ${inserted.symbol} — ${inserted.name}`,
      {
        kind: "instrument_classified",
        symbol: inserted.symbol,
        type: inserted.instrumentType,
        priceSource,
        tokens: { in: tokensIn, out: tokensOut },
        ms,
      },
    );

    revalidatePath("/dashboard");

    return {
      ok: true,
      created: true,
      instrument: {
        symbol: inserted.symbol,
        name: inserted.name,
        instrumentType: inserted.instrumentType ?? "etf",
        currentPrice: inserted.currentPrice ? Number(inserted.currentPrice) : null,
      },
      tokensIn,
      tokensOut,
      ms,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Tagger failed: ${err.message}`
          : "Unknown error during classification",
    };
  }
}

export type RefreshPricesResult =
  | {
      ok: true;
      updated: number;
      missed: number;
      total: number;
      ms: number;
      misses?: string[];
      byProvider?: Record<string, number>;
    }
  | { error: string };

/**
 * Re-fetch every catalog instrument's price from Yahoo Finance and update
 * the row. Skips instruments where Yahoo has no quote (keeps the existing
 * Tagger price). Cheap: one batched call to yahoo-finance2 per ~25 symbols.
 */
export async function refreshPricesAction(): Promise<RefreshPricesResult> {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const start = Date.now();
    const all = await listAllInstruments();
    if (all.length === 0) {
      return { ok: true, updated: 0, missed: 0, total: 0, ms: 0 };
    }

    const symbols = all.map((i) => i.symbol);
    const quotes = await fetchQuotes(symbols);

    let updated = 0;
    const misses: string[] = [];
    const byProvider: Record<string, number> = {};
    await Promise.all(
      all.map(async (inst) => {
        const q = quotes.get(inst.symbol);
        if (!q) {
          misses.push(inst.symbol);
          return;
        }
        await updateInstrumentPrice(inst.symbol, q.price, q.provider);
        byProvider[q.provider] = (byProvider[q.provider] ?? 0) + 1;
        updated++;
      }),
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/holdings");

    const providerBreakdown =
      Object.entries(byProvider)
        .map(([p, n]) => `${n} ${p === "polygon" ? "Polygon" : p === "yahoo" ? "Yahoo" : p}`)
        .join(", ") || "0";

    await logActivity(
      userId,
      "profile_saved", // closest existing kind; could add a new one later
      `Refreshed ${updated} prices (${providerBreakdown})${misses.length ? `, ${misses.length} unavailable` : ""}`,
      { kind: "prices_refreshed", updated, missed: misses.length, misses, byProvider },
    );

    return {
      ok: true,
      updated,
      missed: misses.length,
      total: all.length,
      ms: Date.now() - start,
      misses: misses.length > 0 ? misses : undefined,
      byProvider,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Refresh failed",
    };
  }
}
