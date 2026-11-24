/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IMPACT MODEL ASSUMPTIONS — PLACEHOLDER VALUES
 * ─────────────────────────────────────────────────────────────────────────────
 *  These numbers are NOT validated scientific parameters. They exist only so the
 *  calculator UI can be demonstrated. Replace them with values from a chosen
 *  methodology (e.g. species-specific allometric equations, IPCC defaults, or
 *  site measurements) before showing any figure as a real estimate.
 *
 *  The UI reads everything through `impactModel.ts`, so swapping this file (or
 *  the whole model) does not require touching any component.
 */
export const IMPACT_ASSUMPTIONS = {
  /** Illustrative CO₂ uptake of one surviving tree once it reaches the plateau (kg/yr). */
  co2KgPerTreePerYearAtPlateau: 20,
  /** Years for a young tree to ramp linearly up to the plateau rate (illustrative). */
  rampYears: 8,
  /** Used when a program has no survival figure (illustrative). */
  defaultSurvivalRate: 0.7,
  /**
   * Mass of O₂ released per mass of CO₂ fixed in net photosynthesis
   * (CO₂ + H₂O → CH₂O + O₂ ⇒ 32 g O₂ per 44 g CO₂). Stoichiometric ratio — the
   * real net O₂ balance of a tree also depends on its respiration.
   */
  o2PerCo2MassRatio: 32 / 44,
  /** All-in cost per seedling when no program is selected (illustrative, IDR). */
  fallbackCostPerSeedling: 30_000,
  version: 'dummy-0.1',
} as const;

export const METHOD_NOTES = [
  'Dana → bibit: nominal dibagi biaya program per bibit (pengadaan, penanaman, pemeliharaan, monitoring, dan operasional).',
  'Bibit → pohon hidup: dikalikan asumsi tingkat keberhasilan hidup program.',
  'Pohon hidup → CO₂: serapan per pohon naik bertahap selama masa pertumbuhan, lalu stabil pada nilai asumsi.',
  'CO₂ → O₂: memakai rasio massa stoikiometri fotosintesis (32/44). Ini penyederhanaan.',
];

export const UNCERTAINTY_NOTE =
  'Dampak nyata sangat bergantung pada spesies tanaman, kondisi lingkungan, tingkat keberhasilan hidup, pertumbuhan biomassa, dan metodologi perhitungan yang digunakan. Semua angka di sini ilustratif, bukan hasil pengukuran.';
