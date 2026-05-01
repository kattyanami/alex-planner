"use server";

import { auth } from "@clerk/nextjs/server";
import { classifyInstrument } from "@/lib/agents/tagger";
import { generateReport, type Portfolio, type UserProfile } from "@/lib/agents/reporter";
import { generateCharts } from "@/lib/agents/charter";
import { analyzeRetirement } from "@/lib/agents/retirement";

const SAMPLE_PORTFOLIO: Portfolio = {
  accounts: [
    {
      name: "401(k)",
      cash_balance: 5_000,
      positions: [
        {
          symbol: "VOO",
          quantity: 120,
          instrument: {
            name: "Vanguard S&P 500 ETF",
            instrument_type: "etf",
            current_price: 540,
            allocation_asset_class: { equity: 100 },
            allocation_regions: { north_america: 100 },
            allocation_sectors: { technology: 28, healthcare: 13, financials: 13, consumer_discretionary: 12, industrials: 9, communication: 9, consumer_staples: 6, energy: 4, utilities: 3, real_estate: 2, materials: 1 },
          },
        },
        {
          symbol: "BND",
          quantity: 200,
          instrument: {
            name: "Vanguard Total Bond Market ETF",
            instrument_type: "bond_fund",
            current_price: 72,
            allocation_asset_class: { fixed_income: 100 },
            allocation_regions: { north_america: 100 },
            allocation_sectors: { treasury: 42, corporate: 24, mortgage: 27, government_related: 7 },
          },
        },
      ],
    },
    {
      name: "Roth IRA",
      cash_balance: 1_500,
      positions: [
        {
          symbol: "QQQ",
          quantity: 40,
          instrument: {
            name: "Invesco QQQ Trust",
            instrument_type: "etf",
            current_price: 480,
            allocation_asset_class: { equity: 100 },
            allocation_regions: { north_america: 100 },
            allocation_sectors: { technology: 50, communication: 17, consumer_discretionary: 15, healthcare: 8, consumer_staples: 5, industrials: 3, other: 2 },
          },
        },
        {
          symbol: "VEA",
          quantity: 150,
          instrument: {
            name: "Vanguard FTSE Developed Markets ETF",
            instrument_type: "etf",
            current_price: 52,
            allocation_asset_class: { equity: 100 },
            allocation_regions: { europe: 60, asia: 35, oceania: 5 },
            allocation_sectors: { financials: 18, industrials: 14, healthcare: 12, consumer_discretionary: 11, technology: 10, consumer_staples: 9, materials: 8, energy: 6, communication: 5, utilities: 4, real_estate: 3 },
          },
        },
        {
          symbol: "GLD",
          quantity: 8,
          instrument: {
            name: "SPDR Gold Shares",
            instrument_type: "etf",
            current_price: 220,
            allocation_asset_class: { commodities: 100 },
            allocation_regions: { global: 100 },
            allocation_sectors: { commodities: 100 },
          },
        },
      ],
    },
  ],
};

const SAMPLE_USER: UserProfile = {
  display_name: "Sample User",
  years_until_retirement: 25,
  target_retirement_income: 90_000,
};

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
}

export type TaggerActionResult =
  | {
      ok: true;
      results: Array<{
        symbol: string;
        classification: Awaited<ReturnType<typeof classifyInstrument>>["classification"];
        tokensIn: number;
        tokensOut: number;
        ms: number;
      }>;
      totalMs: number;
    }
  | { error: string };

export async function runTaggerAgent(): Promise<TaggerActionResult> {
  try {
    await requireAuth();
    const start = Date.now();
    const positions = SAMPLE_PORTFOLIO.accounts.flatMap((a) => a.positions);
    const results = await Promise.all(
      positions.map(async (p) => {
        const r = await classifyInstrument(
          p.symbol,
          p.instrument.name,
          p.instrument.instrument_type ?? "etf",
        );
        return { symbol: p.symbol, ...r };
      }),
    );
    return { ok: true, results, totalMs: Date.now() - start };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export type ReporterActionResult =
  | { ok: true; result: Awaited<ReturnType<typeof generateReport>> }
  | { error: string };

export async function runReporterAgent(): Promise<ReporterActionResult> {
  try {
    await requireAuth();
    const result = await generateReport(SAMPLE_PORTFOLIO, SAMPLE_USER);
    return { ok: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export type CharterActionResult =
  | { ok: true; result: Awaited<ReturnType<typeof generateCharts>> }
  | { error: string };

export async function runCharterAgent(): Promise<CharterActionResult> {
  try {
    await requireAuth();
    const result = await generateCharts(SAMPLE_PORTFOLIO);
    return { ok: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export type RetirementActionResult =
  | { ok: true; result: Awaited<ReturnType<typeof analyzeRetirement>> }
  | { error: string };

export async function runRetirementAgent(): Promise<RetirementActionResult> {
  try {
    await requireAuth();
    const result = await analyzeRetirement(SAMPLE_PORTFOLIO, SAMPLE_USER);
    return { ok: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
