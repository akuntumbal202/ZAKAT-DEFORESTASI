import type { ProjectView, SpeciesCatalogItem } from '../types';
import { SPECIES_CATALOG_BY_ID } from '../data/speciesCatalog';
import { donationToImpact } from '../lib/impact/impactModel';
import { impactContextFor, isAcceptingDonations } from './projectService';
import { REALISATION } from '../data/mock/transparency';
import { getAllPolygonAttributes } from './spatialService';

/** Platform-level aggregates for published Loa Kulu programs + overall spatial context. */
export function platformStats(
  projects: ProjectView[],
  speciesById: Record<string, SpeciesCatalogItem> = SPECIES_CATALOG_BY_ID,
) {
  const allPolygons = getAllPolygonAttributes();
  const totalDeforestedArea = allPolygons.reduce((s, p) => s + p.luas_ha, 0);
  const totalArea = projects.reduce((s, p) => s + (p.site?.area_ha ?? 0), 0);
  const totalCollected = projects.reduce((s, p) => s + p.funding_collected, 0);
  const totalTarget = projects.reduce((s, p) => s + p.funding_target, 0);
  const totalSeedlings = projects.reduce((s, p) => s + p.total_seedlings, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donor_count, 0);
  const active = projects.filter(isAcceptingDonations).length;
  const projectedCo2Kg10y = projects.reduce(
    (s, p) => s + donationToImpact(p.funding_target, 10, impactContextFor(p, speciesById)).co2Kg,
    0,
  );
  return {
    totalArea,
    totalDeforestedArea,
    totalPolygonCount: allPolygons.length,
    totalCollected,
    totalTarget,
    totalSeedlings,
    totalDonors,
    active,
    count: projects.length,
    projectedCo2Kg10y,
  };
}

export function transparencyStats(projects: ProjectView[]) {
  const rows = projects.map((p) => {
    const r = REALISATION.find((x) => x.project_id === p.id);
    const allocated = Math.min(r?.allocated ?? 0, p.funding_collected);
    const spent = Math.min(r?.spent ?? 0, allocated);
    return {
      project: p,
      allocated,
      spent,
      remaining: p.funding_collected - spent,
      seedlings_planted: r?.seedlings_planted ?? 0,
      stage: r?.stage ?? 'Penggalangan',
      last_report: r?.last_report ?? null,
    };
  });
  const sum = (k: 'allocated' | 'spent' | 'remaining') => rows.reduce((s, r) => s + r[k], 0);
  const target = projects.reduce((s, p) => s + p.funding_target, 0);
  const collected = projects.reduce((s, p) => s + p.funding_collected, 0);

  const normalizeCostBucket = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('bibit') || l.includes('pembibit')) return 'Pengadaan & Pembibitan';
    if (l.includes('media') || l.includes('persiap') || l.includes('kompos') || l.includes('ajir') || l.includes('jalur'))
      return 'Persiapan Lahan & Media Tanam';
    if (l.includes('penanam') || l.includes('tenaga kerja')) return 'Penanaman & Tenaga Kerja Lokal';
    if (l.includes('pemelihar') || l.includes('penyulam')) return 'Pemeliharaan & Penyulaman';
    if (l.includes('monitor') || l.includes('ziswaf') || l.includes('operasional') || l.includes('pelapor'))
      return 'Monitoring & Operasional ZISWAF';
    return 'Komponen Restorasi Lainnya';
  };

  const byCategory = new Map<string, number>();
  rows.forEach((r) => {
    const total = r.project.cost_breakdown.reduce((s, c) => s + c.amount, 0) || 1;
    r.project.cost_breakdown.forEach((c) => {
      const bucket = normalizeCostBucket(c.label);
      byCategory.set(bucket, (byCategory.get(bucket) ?? 0) + (r.spent * c.amount) / total);
    });
  });

  return {
    rows,
    target,
    collected,
    allocated: sum('allocated'),
    spent: sum('spent'),
    remaining: sum('remaining'),
    seedlingsPlanted: rows.reduce((s, r) => s + r.seedlings_planted, 0),
    byCategory: [...byCategory.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}
