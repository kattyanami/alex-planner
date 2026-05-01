import { generateObject } from "ai";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";

const sumApprox100 = (v: Record<string, number>) =>
  Math.abs(Object.values(v).reduce((a, b) => a + b, 0) - 100) < 3;

export const AssetClassSchema = z
  .object({
    equity: z.number().min(0).max(100),
    fixed_income: z.number().min(0).max(100),
    real_estate: z.number().min(0).max(100),
    commodities: z.number().min(0).max(100),
    cash: z.number().min(0).max(100),
    alternatives: z.number().min(0).max(100),
  })
  .refine(sumApprox100, { message: "Asset class allocations must sum to ~100" });

export const RegionSchema = z
  .object({
    north_america: z.number().min(0).max(100),
    europe: z.number().min(0).max(100),
    asia: z.number().min(0).max(100),
    latin_america: z.number().min(0).max(100),
    africa: z.number().min(0).max(100),
    middle_east: z.number().min(0).max(100),
    oceania: z.number().min(0).max(100),
    global: z.number().min(0).max(100),
    international: z.number().min(0).max(100),
  })
  .refine(sumApprox100, { message: "Regional allocations must sum to ~100" });

export const SectorSchema = z
  .object({
    technology: z.number().min(0).max(100),
    healthcare: z.number().min(0).max(100),
    financials: z.number().min(0).max(100),
    consumer_discretionary: z.number().min(0).max(100),
    consumer_staples: z.number().min(0).max(100),
    industrials: z.number().min(0).max(100),
    materials: z.number().min(0).max(100),
    energy: z.number().min(0).max(100),
    utilities: z.number().min(0).max(100),
    real_estate: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    treasury: z.number().min(0).max(100),
    corporate: z.number().min(0).max(100),
    mortgage: z.number().min(0).max(100),
    government_related: z.number().min(0).max(100),
    commodities: z.number().min(0).max(100),
    diversified: z.number().min(0).max(100),
    other: z.number().min(0).max(100),
  })
  .refine(sumApprox100, { message: "Sector allocations must sum to ~100" });

export const ClassificationSchema = z.object({
  symbol: z.string().describe("Ticker symbol"),
  name: z.string().describe("Instrument name"),
  instrument_type: z
    .enum(["etf", "stock", "mutual_fund", "bond_fund", "other"])
    .describe("Type of instrument"),
  current_price: z
    .number()
    .positive()
    .describe("Current price per share in USD (approximate, late 2024 / early 2025)"),
  allocation_asset_class: AssetClassSchema,
  allocation_regions: RegionSchema,
  allocation_sectors: SectorSchema,
});

export type Classification = z.infer<typeof ClassificationSchema>;

const TAGGER_INSTRUCTIONS = `You are an expert financial instrument classifier responsible for categorizing ETFs, stocks, and other securities.

Your task is to accurately classify financial instruments by providing:
1. Current market price per share in USD
2. Exact allocation percentages for:
   - Asset classes (equity, fixed_income, real_estate, commodities, cash, alternatives)
   - Regions (north_america, europe, asia, etc.)
   - Sectors (technology, healthcare, financials, etc.)

Important rules:
- Each allocation category MUST sum to exactly 100.0
- Use your knowledge of the instrument to provide accurate allocations
- For ETFs, consider the underlying holdings
- For individual stocks, allocate 100% to the appropriate categories
- Be precise with decimal values to ensure totals equal 100.0

Examples:
- SPY (S&P 500 ETF): 100% equity, 100% north_america, distributed across sectors based on S&P 500 composition
- BND (Bond ETF): 100% fixed_income, 100% north_america, split between treasury and corporate
- AAPL (Apple stock): 100% equity, 100% north_america, 100% technology
- VTI (Total Market): 100% equity, 100% north_america, diverse sector allocation
- VXUS (International): 100% equity, distributed across regions, diverse sectors`;

export async function classifyInstrument(
  symbol: string,
  name: string,
  instrument_type: string = "etf",
): Promise<{ classification: Classification; tokensIn: number; tokensOut: number; ms: number }> {
  const start = Date.now();

  const { object, usage } = await generateObject({
    model: MODELS.tagger,
    schema: ClassificationSchema,
    system: TAGGER_INSTRUCTIONS,
    prompt: `Classify the following financial instrument:

Symbol: ${symbol}
Name: ${name}
Type: ${instrument_type}

Provide:
1. Current price per share in USD (approximate market price as of late 2024 / early 2025)
2. Accurate allocation percentages for asset classes, regions, and sectors.

Remember:
- Each category must sum to exactly 100.0%
- For stocks, typically 100% in one asset class, one region, one sector
- For ETFs, distribute based on underlying holdings
- For bonds/bond funds, use fixed_income asset class and treasury/corporate/mortgage/government_related sectors`,
  });

  return {
    classification: object,
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
    ms: Date.now() - start,
  };
}
