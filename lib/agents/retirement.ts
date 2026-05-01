import { generateText } from "ai";
import { MODELS } from "@/lib/ai/models";
import { LIFE_DEFAULTS, MARKET_ASSUMPTIONS, SIMULATION } from "@/lib/finance/assumptions";
import type { Portfolio, UserProfile } from "./reporter";

type Allocation = {
  equity: number;
  bonds: number;
  real_estate: number;
  commodities: number;
  cash: number;
};

function calcPortfolioValue(p: Portfolio): number {
  let total = 0;
  for (const account of p.accounts) {
    total += Number(account.cash_balance) || 0;
    for (const pos of account.positions) {
      const price = Number(pos.instrument.current_price) || 0;
      total += (Number(pos.quantity) || 0) * price;
    }
  }
  return total;
}

function calcAllocation(p: Portfolio): Allocation {
  let equity = 0,
    bonds = 0,
    realEstate = 0,
    commodities = 0,
    cash = 0,
    total = 0;

  for (const account of p.accounts) {
    const c = Number(account.cash_balance) || 0;
    cash += c;
    total += c;
    for (const pos of account.positions) {
      const price = Number(pos.instrument.current_price) || 0;
      const value = (Number(pos.quantity) || 0) * price;
      total += value;
      const ac = pos.instrument.allocation_asset_class ?? {};
      equity += (value * (Number(ac.equity) || 0)) / 100;
      bonds += (value * (Number(ac.fixed_income) || 0)) / 100;
      realEstate += (value * (Number(ac.real_estate) || 0)) / 100;
      commodities += (value * (Number(ac.commodities) || 0)) / 100;
    }
  }

  if (total === 0) return { equity: 0, bonds: 0, real_estate: 0, commodities: 0, cash: 0 };
  return {
    equity: equity / total,
    bonds: bonds / total,
    real_estate: realEstate / total,
    commodities: commodities / total,
    cash: cash / total,
  };
}

function gauss(mean: number, std: number): number {
  const u1 = Math.random() || Number.MIN_VALUE;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function drawAnnualReturn(alloc: Allocation): number {
  const m = MARKET_ASSUMPTIONS;
  return (
    alloc.equity * gauss(m.equity.mean, m.equity.std) +
    alloc.bonds * gauss(m.bonds.mean, m.bonds.std) +
    alloc.real_estate * gauss(m.realEstate.mean, m.realEstate.std) +
    alloc.commodities * gauss(m.commodities.mean, m.commodities.std) +
    alloc.cash * m.cash.mean
  );
}

function expectedAnnualReturn(alloc: Allocation): number {
  const m = MARKET_ASSUMPTIONS;
  return (
    alloc.equity * m.equity.mean +
    alloc.bonds * m.bonds.mean +
    alloc.real_estate * m.realEstate.mean +
    alloc.commodities * m.commodities.mean +
    alloc.cash * m.cash.mean
  );
}

function monteCarlo(
  currentValue: number,
  yearsUntilRetirement: number,
  targetAnnualIncome: number,
  alloc: Allocation,
  annualContribution: number,
  numSims = SIMULATION.numSims,
) {
  let successful = 0;
  const finals: number[] = [];
  const yearsLasted: number[] = [];

  for (let s = 0; s < numSims; s++) {
    let pv = currentValue;
    for (let y = 0; y < yearsUntilRetirement; y++) {
      pv = pv * (1 + drawAnnualReturn(alloc)) + annualContribution;
    }

    let withdrawal = targetAnnualIncome;
    let yLasted = 0;
    for (let y = 0; y < SIMULATION.retirementHorizonYears; y++) {
      if (pv <= 0) break;
      withdrawal *= 1 + SIMULATION.withdrawalInflation;
      pv = pv * (1 + drawAnnualReturn(alloc)) - withdrawal;
      if (pv > 0) yLasted++;
    }
    finals.push(Math.max(0, pv));
    yearsLasted.push(yLasted);
    if (yLasted >= SIMULATION.retirementHorizonYears) successful++;
  }

  finals.sort((a, b) => a - b);
  const expReturn = expectedAnnualReturn(alloc);
  let expected = currentValue;
  for (let y = 0; y < yearsUntilRetirement; y++) expected = expected * (1 + expReturn) + annualContribution;

  return {
    success_rate: Math.round((successful / numSims) * 1000) / 10,
    median_final: Math.round(finals[Math.floor(numSims / 2)]),
    p10: Math.round(finals[Math.floor(numSims / 10)]),
    p90: Math.round(finals[Math.floor((9 * numSims) / 10)]),
    avg_years_lasted: Math.round((yearsLasted.reduce((a, b) => a + b, 0) / yearsLasted.length) * 10) / 10,
    expected_at_retirement: Math.round(expected),
  };
}

function projections(
  currentValue: number,
  yearsUntilRetirement: number,
  alloc: Allocation,
  currentAge: number,
  annualContribution: number,
) {
  const expReturn = expectedAnnualReturn(alloc);

  const out: Array<{ year: number; age: number; portfolio_value: number; annual_income: number; phase: "accumulation" | "retirement" }> = [];
  let pv = currentValue;
  const milestones: number[] = [];
  for (let y = 0; y <= yearsUntilRetirement + SIMULATION.retirementHorizonYears; y += 5) milestones.push(y);

  let lastY = 0;
  for (const y of milestones) {
    const age = currentAge + y;
    const stepYears = y - lastY;
    if (y <= yearsUntilRetirement) {
      for (let i = 0; i < stepYears; i++) pv = pv * (1 + expReturn) + annualContribution;
      out.push({ year: y, age, portfolio_value: Math.round(pv), annual_income: 0, phase: "accumulation" });
    } else {
      const annual = Math.round(pv * SIMULATION.safeWithdrawalRate);
      for (let i = 0; i < stepYears; i++) pv = pv * (1 + expReturn) - annual;
      if (pv > 0) out.push({ year: y, age, portfolio_value: Math.round(pv), annual_income: annual, phase: "retirement" });
    }
    lastY = y;
  }
  return out;
}

const RETIREMENT_INSTRUCTIONS = `You are a Retirement Specialist. You receive pre-computed portfolio metrics, Monte Carlo results, and milestone projections. Your job is to write a clear markdown analysis with:

1. Retirement readiness assessment (clear yes / partially / no with reasoning)
2. Specific recommendations to improve success rate (3-5 items, prioritized)
3. Risk mitigation strategies (sequence-of-returns, inflation, longevity)
4. Action items with timeline

Use specific numbers from the data. Be honest about gaps. Avoid generic platitudes.`;

export type RetirementInputs = {
  currentAge?: number;
  annualContribution?: number;
};

export async function analyzeRetirement(
  portfolio: Portfolio,
  user: UserProfile,
  inputs: RetirementInputs = {},
) {
  const start = Date.now();
  const portfolioValue = calcPortfolioValue(portfolio);
  const allocation = calcAllocation(portfolio);
  const yearsUntilRetirement =
    user.years_until_retirement ?? LIFE_DEFAULTS.yearsUntilRetirement;
  const targetIncome =
    user.target_retirement_income ?? LIFE_DEFAULTS.targetRetirementIncome;
  const currentAge = inputs.currentAge ?? LIFE_DEFAULTS.currentAge;
  const annualContribution =
    inputs.annualContribution ?? LIFE_DEFAULTS.annualContribution;

  const mc = monteCarlo(
    portfolioValue,
    yearsUntilRetirement,
    targetIncome,
    allocation,
    annualContribution,
  );
  const proj = projections(
    portfolioValue,
    yearsUntilRetirement,
    allocation,
    currentAge,
    annualContribution,
  );

  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  const allocStr = Object.entries(allocation)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
    .join(", ");

  const projLines = proj
    .slice(0, 8)
    .map((p) =>
      p.phase === "accumulation"
        ? `- Age ${p.age}: ${fmt(p.portfolio_value)} (building wealth)`
        : `- Age ${p.age}: ${fmt(p.portfolio_value)} (annual income: ${fmt(p.annual_income)})`,
    )
    .join("\n");

  const safeWithdrawal = portfolioValue * SIMULATION.safeWithdrawalRate;
  const gap = targetIncome - safeWithdrawal;

  const { text, usage } = await generateText({
    model: MODELS.retirement,
    system: RETIREMENT_INSTRUCTIONS,
    prompt: `# Retirement Analysis Inputs

## Current Situation
- Portfolio Value: ${fmt(portfolioValue)}
- Asset Allocation: ${allocStr}
- Years to Retirement: ${yearsUntilRetirement}
- Target Annual Income: ${fmt(targetIncome)}
- Current Age: ${currentAge}
- Annual Contribution: ${fmt(annualContribution)}

## Monte Carlo (${SIMULATION.numSims} scenarios, ${SIMULATION.retirementHorizonYears}-year retirement)
- Success Rate: ${mc.success_rate}%
- Expected Portfolio Value at Retirement: ${fmt(mc.expected_at_retirement)}
- 10th Percentile: ${fmt(mc.p10)} (worst case)
- Median Final Value: ${fmt(mc.median_final)}
- 90th Percentile: ${fmt(mc.p90)} (best case)
- Average Years Portfolio Lasts: ${mc.avg_years_lasted} / ${SIMULATION.retirementHorizonYears}

## Milestones
${projLines}

## Safe Withdrawal Rate Gap
- ${(SIMULATION.safeWithdrawalRate * 100).toFixed(0)}% rule on current portfolio: ${fmt(safeWithdrawal)} initial annual income
- Target Income: ${fmt(targetIncome)}
- Gap: ${fmt(gap)} ${gap > 0 ? "(target exceeds current safe withdrawal)" : "(target is achievable)"}

Write the markdown retirement-readiness analysis now.`,
  });

  return {
    markdown: text,
    metrics: {
      portfolioValue,
      allocation,
      monteCarlo: mc,
      projections: proj,
    },
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
    ms: Date.now() - start,
  };
}
