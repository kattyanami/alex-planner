"use server";

import { auth } from "@clerk/nextjs/server";
import { classifyInstrument } from "@/lib/agents/tagger";
import { generateReport } from "@/lib/agents/reporter";
import { generateCharts } from "@/lib/agents/charter";
import { analyzeRetirement } from "@/lib/agents/retirement";
import { getUserPortfolio, getUserProfile } from "@/lib/db/queries";

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function loadUserData(userId: string) {
  const [portfolio, profile] = await Promise.all([
    getUserPortfolio(userId),
    getUserProfile(userId),
  ]);
  return { portfolio, profile };
}

function isEmpty(p: { accounts: { positions: unknown[] }[] }) {
  return p.accounts.length === 0 || p.accounts.every((a) => a.positions.length === 0);
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
    const userId = await requireAuth();
    const { portfolio } = await loadUserData(userId);
    if (isEmpty(portfolio)) return { error: "No portfolio yet. Add holdings first." };
    const start = Date.now();
    const positions = portfolio.accounts.flatMap((a) => a.positions);
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
    const userId = await requireAuth();
    const { portfolio, profile } = await loadUserData(userId);
    if (isEmpty(portfolio)) return { error: "No portfolio yet. Add holdings first." };
    const result = await generateReport(portfolio, profile ?? {});
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
    const userId = await requireAuth();
    const { portfolio } = await loadUserData(userId);
    if (isEmpty(portfolio)) return { error: "No portfolio yet. Add holdings first." };
    const result = await generateCharts(portfolio);
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
    const userId = await requireAuth();
    const { portfolio, profile } = await loadUserData(userId);
    if (isEmpty(portfolio)) return { error: "No portfolio yet. Add holdings first." };
    const result = await analyzeRetirement(portfolio, profile ?? {}, {
      currentAge: profile?.current_age ?? undefined,
      annualContribution: profile?.annual_contribution ?? undefined,
    });
    return { ok: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
