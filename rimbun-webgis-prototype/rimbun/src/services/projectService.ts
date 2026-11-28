import type { Donation, ProjectStatus, ProjectView, RestorationProject, SpeciesCatalogItem } from '../types';
import { PROJECTS } from '../data/mock/projects';
import { SPECIES_CATALOG_BY_ID, resolveSpeciesMetrics } from '../data/speciesCatalog';
import { getSiteAttributes } from './siteService';
import { IMPACT_ASSUMPTIONS } from '../lib/impact/assumptions';
import type { ImpactContext } from '../lib/impact/impactModel';

/**
 * Program access layer. Combines seed programs + Admin custom/edited programs
 * stored in localStorage + simulated donations.
 */
export function getSeedProjects(): RestorationProject[] {
  return PROJECTS;
}

export function mergeProjects(customProjects: Record<string, RestorationProject>): RestorationProject[] {
  const map = new Map<string, RestorationProject>();
  PROJECTS.forEach((p) => map.set(p.id, p));
  Object.values(customProjects).forEach((p) => map.set(p.id, p));
  return Array.from(map.values());
}

export function toProjectView(p: RestorationProject, donations: Donation[]): ProjectView {
  const own = donations.filter((d) => d.project_id === p.id);
  const extra = own.reduce((s, d) => s + d.amount, 0);
  const funding_collected = Math.min(p.funding_target, p.funding_collected_base + extra);
  const total_seedlings = p.recommended_species.reduce((s, r) => s + r.seedlings, 0);
  const restoration_cost = p.cost_breakdown.reduce((s, c) => s + c.amount, 0);
  const funding_percentage = p.funding_target > 0 ? (funding_collected / p.funding_target) * 100 : 0;
  let status: ProjectStatus = p.status;
  if ((status === 'open' || status === 'urgent') && funding_percentage >= 100) status = 'funded';
  return {
    ...p,
    updates:
      p.updates && p.updates.length > 0
        ? p.updates
        : [
            {
              date: p.started_at,
              title: 'Kurasi spasial & pembukaan program',
              body: 'Poligon deforestasi Loa Kulu telah diverifikasi parameter fisiknya dan ditetapkan sebagai target rehabilitasi.',
            },
          ],
    status,
    funding_collected,
    funding_percentage,
    funding_remaining: Math.max(0, p.funding_target - funding_collected),
    donor_count: p.donor_count_base + new Set(own.map((d) => d.user_id)).size,
    restoration_cost,
    total_seedlings,
    cost_per_seedling: total_seedlings > 0 ? restoration_cost / total_seedlings : IMPACT_ASSUMPTIONS.fallbackCostPerSeedling,
    site: getSiteAttributes(p.polygon_code || p.id),
  };
}

export function buildAllProjectViews(
  donations: Donation[],
  customProjects: Record<string, RestorationProject> = {},
  remoteAuthoritative = false,
): ProjectView[] {
  const list = remoteAuthoritative ? Object.values(customProjects) : mergeProjects(customProjects);
  return list.map((p) => toProjectView(p, donations));
}

export function isAcceptingDonations(p: Pick<ProjectView, 'status' | 'publication_status'>) {
  return p.publication_status === 'published' && (p.status === 'open' || p.status === 'urgent');
}

export function impactContextFor(
  p: ProjectView | null | undefined,
  speciesById: Record<string, SpeciesCatalogItem> = SPECIES_CATALOG_BY_ID,
): ImpactContext {
  if (!p) {
    return {
      costPerSeedling: IMPACT_ASSUMPTIONS.fallbackCostPerSeedling,
      survivalRate: IMPACT_ASSUMPTIONS.defaultSurvivalRate,
      co2KgPerTreePerYearAtPlateau: IMPACT_ASSUMPTIONS.co2KgPerTreePerYearAtPlateau,
      co2TonPerHaYr: IMPACT_ASSUMPTIONS.fallbackCo2TonPerHaPerYear,
      densityPerHa: IMPACT_ASSUMPTIONS.fallbackDensityPerHa,
      basisLabel: 'Rujukan umum Racelis et al. (2019)',
    };
  }

  let totalSeedlings = 0;
  let totalSurviving = 0;
  let weightedPlateauKg = 0;
  let weightedCo2Ha = 0;
  let weightedDensity = 0;
  const names: string[] = [];

  for (const r of p.recommended_species) {
    const qty = Math.max(0, Number(r.seedlings) || 0);
    if (qty <= 0) continue;
    const sp = speciesById[r.species_id];
    const m = sp ? resolveSpeciesMetrics(sp) : null;
    const surv = r.survival_estimate ?? m?.defaultSurvival ?? IMPACT_ASSUMPTIONS.defaultSurvivalRate;
    const plateauKg = m?.co2KgPerSurvivingTreeYr ?? IMPACT_ASSUMPTIONS.co2KgPerTreePerYearAtPlateau;
    const co2Ha = m?.co2TonPerHaYr ?? IMPACT_ASSUMPTIONS.fallbackCo2TonPerHaPerYear;
    const density = m?.densityPerHa ?? IMPACT_ASSUMPTIONS.fallbackDensityPerHa;

    totalSeedlings += qty;
    totalSurviving += qty * surv;
    weightedPlateauKg += qty * surv * plateauKg;
    weightedCo2Ha += qty * co2Ha;
    weightedDensity += qty * density;
    if (sp) names.push(sp.local_name);
  }

  const survivalRate = totalSeedlings > 0 ? totalSurviving / totalSeedlings : IMPACT_ASSUMPTIONS.defaultSurvivalRate;
  const co2KgPerTreePerYearAtPlateau =
    totalSurviving > 0 ? weightedPlateauKg / totalSurviving : IMPACT_ASSUMPTIONS.co2KgPerTreePerYearAtPlateau;
  const co2TonPerHaYr =
    totalSeedlings > 0 ? weightedCo2Ha / totalSeedlings : IMPACT_ASSUMPTIONS.fallbackCo2TonPerHaPerYear;
  const densityPerHa =
    totalSeedlings > 0 ? weightedDensity / totalSeedlings : IMPACT_ASSUMPTIONS.fallbackDensityPerHa;

  return {
    costPerSeedling: p.cost_per_seedling,
    survivalRate,
    co2KgPerTreePerYearAtPlateau,
    co2TonPerHaYr,
    densityPerHa,
    basisLabel: names.length > 0 ? `Komposisi ${names.length} spesies (${names.join(', ')})` : 'Rujukan umum Racelis et al. (2019)',
  };
}

export const STATUS_META: Record<ProjectStatus, { label: string; tone: 'urgent' | 'open' | 'funded' | 'progress' | 'muted' }> = {
  urgent: { label: 'Mendesak', tone: 'urgent' },
  open: { label: 'Menggalang dana', tone: 'open' },
  funded: { label: 'Dana terpenuhi', tone: 'funded' },
  planting: { label: 'Tahap penanaman', tone: 'progress' },
  monitoring: { label: 'Monitoring', tone: 'muted' },
};

export const CATEGORY_LABEL: Record<RestorationProject['category'], string> = {
  pascatambang: 'Lahan terbuka / pascatambang',
  'hutan-lahan-kering': 'Rehabilitasi lereng & hutan kering',
  agroforestri: 'Agroforestri masyarakat',
  riparian: 'Lahan lembap / organosol / riparian',
};

/** Simulated network delay so loading states can be seen in the prototype. */
export const simulateLatency = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));
