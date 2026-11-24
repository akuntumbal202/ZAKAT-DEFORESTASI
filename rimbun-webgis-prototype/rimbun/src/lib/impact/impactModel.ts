import { IMPACT_ASSUMPTIONS as A } from './assumptions';

/**
 * Dummy impact model. Pure functions only — no React, no UI.
 * Replace the internals with a validated model; keep the signatures.
 */

export interface ImpactContext {
  /** All-in program cost per seedling (IDR). */
  costPerSeedling: number;
  /** 0–1 survival assumption. */
  survivalRate: number;
}

export interface YearPoint {
  year: number;
  co2Kg: number;
  cumulativeCo2Kg: number;
}

export interface ImpactResult {
  seedlings: number;
  survivingTrees: number;
  co2Kg: number;
  o2Kg: number;
  series: YearPoint[];
  periodYears: number;
}

export interface FundingNeed {
  periodYears: number;
  survivingTreesNeeded: number;
  seedlingsNeeded: number;
  fundsNeeded: number;
  series: YearPoint[];
}

/** Growth factor in a given year (1-indexed): linear ramp up to plateau. */
export function growthFactor(year: number): number {
  return Math.min(1, year / A.rampYears);
}

function perTreeSeries(periodYears: number): number[] {
  return Array.from({ length: periodYears }, (_, i) => A.co2KgPerTreePerYearAtPlateau * growthFactor(i + 1));
}

function buildSeries(trees: number, periodYears: number): YearPoint[] {
  let cum = 0;
  return perTreeSeries(periodYears).map((perTree, i) => {
    const co2Kg = perTree * trees;
    cum += co2Kg;
    return { year: i + 1, co2Kg, cumulativeCo2Kg: cum };
  });
}

/** Mode A — donation amount → illustrative impact. */
export function donationToImpact(amount: number, periodYears: number, ctx: ImpactContext): ImpactResult {
  const safeAmount = Math.max(0, amount || 0);
  const seedlings = ctx.costPerSeedling > 0 ? safeAmount / ctx.costPerSeedling : 0;
  const survivingTrees = seedlings * ctx.survivalRate;
  const series = buildSeries(survivingTrees, periodYears);
  const co2Kg = series.length ? series[series.length - 1].cumulativeCo2Kg : 0;
  return {
    seedlings,
    survivingTrees,
    co2Kg,
    o2Kg: co2Kg * A.o2PerCo2MassRatio,
    series,
    periodYears,
  };
}

/** Mode B — target CO₂ (kg) over a period → illustrative funding need. */
export function impactToDonation(targetCo2Kg: number, periodYears: number, ctx: ImpactContext): FundingNeed {
  const perTreeTotal = perTreeSeries(periodYears).reduce((s, v) => s + v, 0);
  const survivingTreesNeeded = perTreeTotal > 0 ? Math.max(0, targetCo2Kg) / perTreeTotal : 0;
  const seedlingsNeeded = ctx.survivalRate > 0 ? survivingTreesNeeded / ctx.survivalRate : 0;
  return {
    periodYears,
    survivingTreesNeeded,
    seedlingsNeeded,
    fundsNeeded: seedlingsNeeded * ctx.costPerSeedling,
    series: buildSeries(survivingTreesNeeded, periodYears),
  };
}

export function defaultContext(): ImpactContext {
  return { costPerSeedling: A.fallbackCostPerSeedling, survivalRate: A.defaultSurvivalRate };
}

export const o2FromCo2 = (co2Kg: number) => co2Kg * A.o2PerCo2MassRatio;
