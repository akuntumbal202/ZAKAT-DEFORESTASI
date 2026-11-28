import { IMPACT_ASSUMPTIONS as A } from './assumptions';

/**
 * Pure ecological impact estimation model (no React/UI dependencies).
 * Uses a logistic sigmoid growth curve for annual CO₂ uptake per surviving tree,
 * driven by species-specific literature sequestration rates (ton CO₂/ha/yr)
 * converted cleanly via planting density & baseline survival.
 */

export interface ImpactContext {
  /** All-in program cost per seedling (IDR). */
  costPerSeedling: number;
  /** 0–1 survival assumption (weighted from program species mix). */
  survivalRate: number;
  /**
   * Mature annual CO₂ uptake per surviving tree (kg CO₂/surviving tree/year).
   * Optional: defaults to Racelis et al. (2019) general fallback.
   */
  co2KgPerTreePerYearAtPlateau?: number;
  /** Weighted stand-level CO₂ uptake reference (ton CO₂/ha/year) for display. */
  co2TonPerHaYr?: number;
  /** Weighted planting density (seedlings/ha) for display. */
  densityPerHa?: number;
  /** Human-readable description of the carbon parameter basis (program species vs fallback). */
  basisLabel?: string;
}

export interface YearPoint {
  year: number;
  co2Kg: number;
  cumulativeCo2Kg: number;
}

export interface ImpactResult {
  seedlings: number;
  survivingTrees: number;
  /** Biomass carbon stored C = CO₂ × (12/44). */
  carbonKg: number;
  /** Cumulative CO₂ sequestered over periodYears. */
  co2Kg: number;
  /** Stoichiometric net O₂ released O₂ = CO₂ × (32/44) = C × 2.67. */
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

/**
 * Logistic sigmoid growth factor in year t (1-indexed):
 *   f(t) = 1 / (1 + exp(-k * (t - t0)))
 * Captures slow establishment (years 1–3), rapid canopy growth (years 4–9),
 * and gradual plateau toward mature annual uptake (years 10–15+).
 */
export function growthFactor(year: number): number {
  return 1 / (1 + Math.exp(-A.sigmoidSteepness * (year - A.sigmoidMidpointYear)));
}

function resolvePlateauKg(ctx: ImpactContext): number {
  return ctx.co2KgPerTreePerYearAtPlateau && ctx.co2KgPerTreePerYearAtPlateau > 0
    ? ctx.co2KgPerTreePerYearAtPlateau
    : A.co2KgPerTreePerYearAtPlateau;
}

function perTreeSeries(periodYears: number, plateauKgPerTree: number): number[] {
  return Array.from({ length: periodYears }, (_, i) => plateauKgPerTree * growthFactor(i + 1));
}

function buildSeries(trees: number, periodYears: number, plateauKgPerTree: number): YearPoint[] {
  let cum = 0;
  return perTreeSeries(periodYears, plateauKgPerTree).map((perTree, i) => {
    const co2Kg = perTree * trees;
    cum += co2Kg;
    return { year: i + 1, co2Kg, cumulativeCo2Kg: cum };
  });
}

/** Mode A — donation amount → illustrative ecological impact. */
export function donationToImpact(amount: number, periodYears: number, ctx: ImpactContext): ImpactResult {
  const safeAmount = Math.max(0, amount || 0);
  const seedlings = ctx.costPerSeedling > 0 ? safeAmount / ctx.costPerSeedling : 0;
  const survivingTrees = seedlings * ctx.survivalRate;
  const plateau = resolvePlateauKg(ctx);
  const series = buildSeries(survivingTrees, periodYears, plateau);
  const co2Kg = series.length ? series[series.length - 1].cumulativeCo2Kg : 0;
  return {
    seedlings,
    survivingTrees,
    carbonKg: co2Kg * A.carbonPerCo2MassRatio,
    co2Kg,
    o2Kg: co2Kg * A.o2PerCo2MassRatio,
    series,
    periodYears,
  };
}

/** Mode B — target CO₂ (kg) over a period → illustrative funding need. */
export function impactToDonation(targetCo2Kg: number, periodYears: number, ctx: ImpactContext): FundingNeed {
  const plateau = resolvePlateauKg(ctx);
  const perTreeTotal = perTreeSeries(periodYears, plateau).reduce((s, v) => s + v, 0);
  const survivingTreesNeeded = perTreeTotal > 0 ? Math.max(0, targetCo2Kg) / perTreeTotal : 0;
  const seedlingsNeeded = ctx.survivalRate > 0 ? survivingTreesNeeded / ctx.survivalRate : 0;
  return {
    periodYears,
    survivingTreesNeeded,
    seedlingsNeeded,
    fundsNeeded: seedlingsNeeded * ctx.costPerSeedling,
    series: buildSeries(survivingTreesNeeded, periodYears, plateau),
  };
}

export function defaultContext(): ImpactContext {
  return {
    costPerSeedling: A.fallbackCostPerSeedling,
    survivalRate: A.defaultSurvivalRate,
    co2KgPerTreePerYearAtPlateau: A.co2KgPerTreePerYearAtPlateau,
    co2TonPerHaYr: A.fallbackCo2TonPerHaPerYear,
    densityPerHa: A.fallbackDensityPerHa,
    basisLabel: 'Rujukan umum Racelis et al. (2019)',
  };
}

export const carbonFromCo2 = (co2Kg: number) => co2Kg * A.carbonPerCo2MassRatio;
export const o2FromCo2 = (co2Kg: number) => co2Kg * A.o2PerCo2MassRatio;
