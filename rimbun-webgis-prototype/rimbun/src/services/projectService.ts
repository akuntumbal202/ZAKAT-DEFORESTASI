import type { Donation, ProjectStatus, ProjectView, RestorationProject } from '../types';
import { PROJECTS } from '../data/mock/projects';
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

export function impactContextFor(p: ProjectView | null | undefined): ImpactContext {
  if (!p) return { costPerSeedling: IMPACT_ASSUMPTIONS.fallbackCostPerSeedling, survivalRate: IMPACT_ASSUMPTIONS.defaultSurvivalRate };
  const withRate = p.recommended_species.filter((r) => r.survival_estimate != null);
  const weighted = withRate.reduce((s, r) => s + (r.survival_estimate ?? 0) * r.seedlings, 0);
  const n = withRate.reduce((s, r) => s + r.seedlings, 0);
  return {
    costPerSeedling: p.cost_per_seedling,
    survivalRate: n > 0 ? weighted / n : IMPACT_ASSUMPTIONS.defaultSurvivalRate,
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
