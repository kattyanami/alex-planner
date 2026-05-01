/**
 * Centralized financial assumptions used by Monte Carlo + projections.
 * Tweak here, no need to hunt through agent code.
 */

export const MARKET_ASSUMPTIONS = {
  equity: { mean: 0.07, std: 0.18 },
  bonds: { mean: 0.04, std: 0.05 },
  realEstate: { mean: 0.06, std: 0.12 },
  cash: { mean: 0.02, std: 0 },
  commodities: { mean: 0.03, std: 0.15 },
} as const;

export const LIFE_DEFAULTS = {
  currentAge: 40,
  yearsUntilRetirement: 25,
  targetRetirementIncome: 80_000,
  annualContribution: 10_000,
} as const;

export const SIMULATION = {
  numSims: 500,
  retirementHorizonYears: 30,
  withdrawalInflation: 0.03,
  safeWithdrawalRate: 0.04,
} as const;
