import { classifyInstrument, type Classification } from "./tagger";
import { generateReport, type Portfolio, type UserProfile } from "./reporter";
import { generateCharts } from "./charter";
import { analyzeRetirement } from "./retirement";

export type TaggerResult = {
  symbol: string;
  classification: Classification;
  tokensIn: number;
  tokensOut: number;
  ms: number;
};

/**
 * Planner orchestrator.
 *
 * Fans out to all sub-agents in parallel:
 *   - Tagger: one call per holding (re-classifies each instrument)
 *   - Reporter: one markdown analysis
 *   - Charter: one set of chart specs
 *   - Retirement: one analysis (Monte Carlo + commentary)
 *
 * For our sample portfolio with 4 holdings, that's 4 + 1 + 1 + 1 = 7 LLM calls in parallel.
 * Total wall-clock time = max(individual durations), not sum.
 */
export async function runPortfolioAnalysis(portfolio: Portfolio, user: UserProfile) {
  const start = Date.now();

  // Build per-holding tagger tasks
  const taggerTasks: Promise<TaggerResult>[] = portfolio.accounts.flatMap((account) =>
    account.positions.map(async (position) => {
      const r = await classifyInstrument(
        position.symbol,
        position.instrument.name,
        position.instrument.instrument_type ?? "etf",
      );
      return { symbol: position.symbol, ...r };
    }),
  );

  const [taggerResults, report, charts, retirement] = await Promise.all([
    Promise.all(taggerTasks),
    generateReport(portfolio, user),
    generateCharts(portfolio),
    analyzeRetirement(portfolio, user),
  ]);

  const totalTokensIn =
    taggerResults.reduce((s, t) => s + t.tokensIn, 0) +
    report.tokensIn +
    charts.tokensIn +
    retirement.tokensIn;
  const totalTokensOut =
    taggerResults.reduce((s, t) => s + t.tokensOut, 0) +
    report.tokensOut +
    charts.tokensOut +
    retirement.tokensOut;

  return {
    tagger: taggerResults,
    report,
    charts,
    retirement,
    totalMs: Date.now() - start,
    totalTokensIn,
    totalTokensOut,
    parallelCalls: taggerResults.length + 3,
  };
}
