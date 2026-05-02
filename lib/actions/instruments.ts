"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { classifyInstrument } from "@/lib/agents/tagger";
import {
  addInstrument,
  getInstrumentBySymbol,
  logActivity,
} from "@/lib/db/queries";

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

    // Fan out to Tagger — it returns name, type, price, all allocations.
    const { classification, tokensIn, tokensOut, ms } = await classifyInstrument(
      symbol,
      hint?.name?.trim() || symbol,
      hint?.type ?? "etf",
    );

    const inserted = await addInstrument({
      symbol: classification.symbol.toUpperCase(),
      name: classification.name,
      instrumentType: classification.instrument_type,
      currentPrice: classification.current_price,
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
