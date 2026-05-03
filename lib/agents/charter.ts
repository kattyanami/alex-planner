import { generateObject } from "ai";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { aggregatePortfolio } from "@/lib/finance/aggregate";
import { traceAgent } from "@/lib/telemetry";
import type { Portfolio } from "./reporter";

export { aggregatePortfolio };

export const ChartSchema = z.object({
  key: z.string().describe("Stable identifier, e.g. asset_class_distribution"),
  title: z.string().describe("Human-readable title"),
  type: z.enum(["pie", "bar", "donut", "horizontalBar"]),
  description: z.string().describe("Short description of what the chart shows"),
  data: z.array(
    z.object({
      name: z.string(),
      value: z.number().describe("Dollar amount, not percentage"),
      color: z.string().describe("Hex color like #3B82F6"),
    }),
  ),
});

export const ChartsResponseSchema = z.object({
  charts: z.array(ChartSchema),
});

export type ChartsResponse = z.infer<typeof ChartsResponseSchema>;

function aggregatesAsMarkdown(p: Portfolio) {
  const a = aggregatePortfolio(p);
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const top = (obj: Record<string, number>, n = 10) =>
    Object.entries(obj)
      .sort(([, x], [, y]) => y - x)
      .slice(0, n)
      .map(([k, v]) => `  ${k}: ${fmt(v)}`)
      .join("\n");

  return [
    `Total Value: ${fmt(a.totalValue)}`,
    `Number of Accounts: ${Object.keys(a.accountTotals).length}`,
    `Number of Positions: ${Object.keys(a.positionValues).length}`,
    "",
    "Account Breakdown:",
    Object.entries(a.accountTotals)
      .map(([n, v]) => `  ${n}: ${fmt(v.value)} (${v.positions} positions)`)
      .join("\n"),
    "",
    "Top Holdings by Value:",
    top(a.positionValues),
    "",
    "Asset Classes:",
    top(a.assetClasses),
    "",
    "Geographic Regions:",
    top(a.regions),
    "",
    "Sectors:",
    top(a.sectors),
  ].join("\n");
}

const CHARTER_INSTRUCTIONS = `You are a Chart Maker Agent that creates visualization specs for investment portfolios.

You will receive a pre-computed portfolio breakdown. Your job is to design 4-6 charts that tell a compelling story.

Rules:
- All values in chart data must be DOLLAR AMOUNTS (not percentages)
- Use distinct hex colors (e.g. #3B82F6, #10B981, #F59E0B, #EC4899, #8B5CF6, #EF4444)
- Each chart must have a stable snake_case key
- Chart types available: pie, bar, donut, horizontalBar
- Pick chart types that fit the data (pie/donut for distributions, bar for comparisons, horizontalBar for top-N)

Chart ideas (pick 4-6):
- asset_class_distribution (pie / donut)
- geographic_exposure (bar)
- sector_breakdown (donut / pie)
- account_distribution (pie)
- top_holdings (horizontalBar)`;

export async function generateCharts(portfolio: Portfolio) {
  return traceAgent("charter", () => generateChartsInner(portfolio), {
    model: "gpt-5-mini",
  });
}

async function generateChartsInner(portfolio: Portfolio) {
  const summary = aggregatesAsMarkdown(portfolio);
  const start = Date.now();

  const { object, usage } = await generateObject({
    model: MODELS.charter,
    schema: ChartsResponseSchema,
    system: CHARTER_INSTRUCTIONS,
    prompt: `Pre-computed portfolio breakdown:

${summary}

Generate 4-6 charts based on this data.`,
  });

  return {
    charts: object.charts,
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
    ms: Date.now() - start,
  };
}
