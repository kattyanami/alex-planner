import { generateText } from "ai";
import { MODELS } from "@/lib/ai/models";

export type Position = {
  symbol: string;
  quantity: number;
  instrument: {
    name: string;
    instrument_type?: string | null;
    current_price?: number | null;
    allocation_asset_class?: Record<string, number> | null;
    allocation_regions?: Record<string, number> | null;
    allocation_sectors?: Record<string, number> | null;
  };
};

export type Account = {
  name: string;
  cash_balance: number;
  positions: Position[];
};

export type Portfolio = {
  accounts: Account[];
};

export type UserProfile = {
  display_name?: string | null;
  years_until_retirement?: number | null;
  target_retirement_income?: number | null;
};

const REPORTER_INSTRUCTIONS = `You are a Report Writer Agent specializing in portfolio analysis and financial narrative generation.

Your primary task is to analyze the provided portfolio and generate a comprehensive markdown report.

The report should include:
- Executive Summary (3-4 key points)
- Portfolio Composition Analysis
- Diversification Assessment
- Risk Profile Evaluation
- Retirement Readiness
- Specific Recommendations (5-7 actionable items)
- Conclusion

Report Guidelines:
- Write in clear, professional language accessible to retail investors
- Use markdown formatting with headers, bullets, and emphasis
- Include specific percentages and numbers where relevant
- Focus on actionable insights, not just observations
- Prioritize recommendations by impact
- Keep sections concise but comprehensive`;

export function calculatePortfolioMetrics(portfolio: Portfolio) {
  let totalValue = 0;
  let cashBalance = 0;
  let numPositions = 0;
  const uniqueSymbols = new Set<string>();

  for (const account of portfolio.accounts) {
    cashBalance += Number(account.cash_balance) || 0;
    numPositions += account.positions.length;

    for (const position of account.positions) {
      uniqueSymbols.add(position.symbol);
      const price = Number(position.instrument.current_price) || 0;
      const quantity = Number(position.quantity) || 0;
      totalValue += quantity * price;
    }
  }

  totalValue += cashBalance;

  return {
    totalValue,
    cashBalance,
    numAccounts: portfolio.accounts.length,
    numPositions,
    uniqueSymbols: uniqueSymbols.size,
  };
}

function formatPortfolioForAnalysis(portfolio: Portfolio, user: UserProfile) {
  const metrics = calculatePortfolioMetrics(portfolio);
  const lines: string[] = [
    "Portfolio Overview:",
    `- ${metrics.numAccounts} accounts`,
    `- ${metrics.numPositions} total positions`,
    `- ${metrics.uniqueSymbols} unique holdings`,
    `- $${metrics.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} in cash`,
  ];
  if (metrics.totalValue > 0) {
    lines.push(
      `- $${metrics.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} total value`,
    );
  }
  lines.push("", "Account Details:");

  for (const account of portfolio.accounts) {
    lines.push(
      `\n${account.name} ($${Number(account.cash_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })} cash):`,
    );
    for (const p of account.positions) {
      const allocs: string[] = [];
      const ac = p.instrument.allocation_asset_class;
      if (ac && Object.keys(ac).length > 0) {
        const top = Object.entries(ac)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)[0];
        if (top) allocs.push(`Asset: ${top[0]} ${top[1]}%`);
      }
      const regions = p.instrument.allocation_regions;
      if (regions && Object.keys(regions).length > 0) {
        const topRegions = Object.entries(regions)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([k, v]) => `${k} ${v}%`)
          .join(", ");
        if (topRegions) allocs.push(`Regions: ${topRegions}`);
      }
      const allocStr = allocs.length > 0 ? ` (${allocs.join(", ")})` : "";
      lines.push(`  - ${p.symbol}: ${Number(p.quantity).toLocaleString()} shares — ${p.instrument.name}${allocStr}`);
    }
  }

  lines.push(
    "",
    "User Profile:",
    `- Name: ${user.display_name ?? "Not specified"}`,
    `- Years to retirement: ${user.years_until_retirement ?? "Not specified"}`,
    `- Target retirement income: $${
      user.target_retirement_income
        ? Number(user.target_retirement_income).toLocaleString("en-US")
        : "Not specified"
    }/year`,
  );

  return lines.join("\n");
}

export async function generateReport(portfolio: Portfolio, user: UserProfile) {
  const summary = formatPortfolioForAnalysis(portfolio, user);
  const start = Date.now();

  const { text, usage } = await generateText({
    model: MODELS.reporter,
    system: REPORTER_INSTRUCTIONS,
    prompt: `Analyze this investment portfolio and write a comprehensive report.

${summary}

Generate a detailed, professional analysis report in markdown format. Include all the standard sections (Executive Summary, Portfolio Composition, Diversification, Risk, Retirement Readiness, Recommendations, Conclusion).

Make it informative yet accessible to a retail investor.`,
  });

  return {
    markdown: text,
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
    ms: Date.now() - start,
  };
}
