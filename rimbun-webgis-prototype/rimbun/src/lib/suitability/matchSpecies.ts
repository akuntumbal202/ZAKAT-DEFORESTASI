import { SPECIES_CATALOG, type SpeciesCatalogItem } from '../../data/speciesCatalog';
import type {
  CostItem,
  LoaKuluPolygonProps,
  ProjectCategory,
  ProjectStatus,
  SpeciesRecommendation,
} from '../../types';

/**
 * Rule-based placeholder plant matcher & admin auto-fill helpers.
 * Reads directly from `SPECIES_CATALOG` so updating `speciesCatalog.ts`
 * automatically updates admin suggestions without touching UI code.
 */

function matchesSoil(tanahDom: string, allowedSoils: string[]): boolean {
  const lower = tanahDom.toLowerCase();
  return allowedSoils.some((s) => lower.includes(s.toLowerCase()));
}

function scoreSpeciesForPolygon(item: SpeciesCatalogItem, props: LoaKuluPolygonProps): number {
  const r = item.suitability;
  let score = 0;

  if (props.elev_med >= r.elev_m[0] && props.elev_med <= r.elev_m[1]) score += 25;
  if (props.slope_med <= r.slope_max_deg) score += 25;
  else score -= (props.slope_med - r.slope_max_deg) * 2;

  if (props.rain_mean >= r.rain_mm[0] && props.rain_mean <= r.rain_mm[1]) score += 20;
  if (matchesSoil(props.tanah_dom, r.soils)) score += 20;
  if (r.kelas_ids.includes(props.kelas_id)) score += 15;

  // Ecological heuristics for Loa Kulu conditions
  if (props.kelas_id === 1 && r.role === 'pionir') score += 14;
  if (props.slope_med >= 11 && item.id === 'aren') score += 15;
  if (props.tanah_dom.toLowerCase().includes('organosol') && r.role === 'riparian') score += 16;
  if (props.kelas_id === 2 && props.slope_med < 11 && r.role === 'agroforestri') score += 8;

  return score;
}

function buildReason(item: SpeciesCatalogItem, props: LoaKuluPolygonProps): string {
  const parts: string[] = [];
  if (item.suitability.role === 'pionir') {
    parts.push('berperan sebagai pionir penutup tajuk cepat');
  } else if (item.suitability.role === 'klimaks') {
    parts.push('pengayaan tegakan asli jangka panjang');
  } else if (item.suitability.role === 'riparian') {
    parts.push('adaptif pada tanah lembap/organosol');
  } else {
    parts.push('mendukung agroforestri dan penguatan akar');
  }

  parts.push(
    `sesuai kriteria awal untuk elevasi ${props.elev_med.toFixed(0)} m, lereng ${props.slope_med.toFixed(1)}°, dan tanah ${props.tanah_dom.split(',')[0]}`,
  );
  return `Saran awal sistem: ${parts.join(' · ')}.`;
}

export function matchSpeciesForPolygon(
  props: LoaKuluPolygonProps,
  totalSeedlings = suggestSeedlingTarget(props),
): SpeciesRecommendation[] {
  const ranked = [...SPECIES_CATALOG]
    .map((item) => ({ item, score: scoreSpeciesForPolygon(item, props) }))
    .sort((a, b) => b.score - a.score);

  // Pick complementary top 3: at least 1 pionir/riparian + up to 2 others
  const picked: SpeciesCatalogItem[] = [];
  const firstPioneer = ranked.find(
    (x) => x.item.suitability.role === 'pionir' || x.item.suitability.role === 'riparian',
  );
  if (firstPioneer) picked.push(firstPioneer.item);

  for (const cand of ranked) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === cand.item.id)) {
      picked.push(cand.item);
    }
  }

  const shareSum = picked.reduce((s, p) => s + p.suitability.default_share, 0) || 1;
  const counts = picked.map((p) =>
    Math.max(100, Math.round((totalSeedlings * (p.suitability.default_share / shareSum)) / 50) * 50),
  );
  const diff = totalSeedlings - counts.reduce((s, c) => s + c, 0);
  if (counts.length > 0) counts[0] = Math.max(100, counts[0] + diff);

  return picked.map((item, idx) => ({
    species_id: item.id,
    seedlings: counts[idx],
    suitability_reason: buildReason(item, props),
    survival_estimate: item.suitability.default_survival,
  }));
}

export function suggestCategoryForPolygon(props: LoaKuluPolygonProps): ProjectCategory {
  if (props.kelas_id === 1) return 'pascatambang';
  if (props.tanah_dom.toLowerCase().includes('organosol') || props.tanah_dom.toLowerCase().includes('aluvial')) {
    return 'riparian';
  }
  if (props.slope_med >= 11 || props.topo_heterogen) return 'hutan-lahan-kering';
  return 'agroforestri';
}

export function suggestSeedlingTarget(props: LoaKuluPolygonProps): number {
  // Phase-1 actionable block target: 400 seedlings/ha up to 60 ha, tapered for massive >60 ha blocks
  const effective = Math.min(props.luas_ha, 60) * 400 + Math.max(0, props.luas_ha - 60) * 160;
  return Math.max(1500, Math.round(effective / 100) * 100);
}

export function buildCostBreakdown(total: number, seedlings: number, category: ProjectCategory): CostItem[] {
  const isHardSite = category === 'pascatambang';
  const lines: [string, number, string?][] = isHardSite
    ? [
        ['Pengadaan bibit pionir & lokal', 0.24, `${seedlings.toLocaleString('id-ID')} bibit`],
        ['Perbaikan media tanam, kompos & kapur', 0.2],
        ['Penanaman (tenaga kerja lokal)', 0.16],
        ['Pemeliharaan & penyulaman 3 tahun', 0.23],
        ['Monitoring pertumbuhan & pelaporan', 0.09],
        ['Operasional & penyaluran mitra ZISWAF', 0.08],
      ]
    : [
        ['Pengadaan & pembibitan unggul', 0.28, `${seedlings.toLocaleString('id-ID')} bibit`],
        ['Persiapan jalur tanam & ajir', 0.12],
        ['Penanaman bersama warga lokal', 0.18],
        ['Pemeliharaan & penyulaman 3 tahun', 0.24],
        ['Monitoring & pelaporan publik', 0.1],
        ['Operasional & penyaluran mitra ZISWAF', 0.08],
      ];

  const items: CostItem[] = lines.map(([label, share, note]) => ({
    label,
    amount: Math.round((total * share) / 1000) * 1000,
    note,
  }));
  const diff = total - items.reduce((s, i) => s + i.amount, 0);
  items[items.length - 1].amount += diff;
  return items;
}

export function suggestProgramDefaults(props: LoaKuluPolygonProps) {
  const category = suggestCategoryForPolygon(props);
  const seedlings = suggestSeedlingTarget(props);
  const unitCost =
    category === 'pascatambang'
      ? 44_000
      : props.slope_med >= 11
        ? 36_000
        : category === 'riparian'
          ? 34_000
          : 31_000;

  const funding_target = Math.round((seedlings * unitCost) / 100_000) * 100_000;
  const cost_breakdown = buildCostBreakdown(funding_target, seedlings, category);
  const recommended_species = matchSpeciesForPolygon(props, seedlings);

  const status: ProjectStatus =
    props.kelas_id === 1 || props.slope_med >= 12 || props.topo_heterogen ? 'urgent' : 'open';

  const imageByCat: Record<ProjectCategory, string> = {
    pascatambang: '/images/site-watershed.jpg',
    'hutan-lahan-kering': '/images/site-corridor.jpg',
    agroforestri: '/images/site-agroforestry.jpg',
    riparian: '/images/site-peatland.jpg',
  };

  const labelByCat: Record<ProjectCategory, string> = {
    pascatambang: 'Pemulihan Lahan Terbuka',
    'hutan-lahan-kering': 'Rehabilitasi Lereng',
    agroforestri: 'Sabuk Hijau Agroforestri',
    riparian: 'Restorasi Lahan Lembap',
  };

  const name = `${labelByCat[category]} Loa Kulu · ${props.lk_code}`;
  const short_name = `Loa Kulu ${props.lk_code}`;
  const summary =
    props.kelas_id === 1
      ? `Area terbuka seluas ${props.luas_ha.toFixed(1)} ha pada elevasi ${props.elev_med.toFixed(0)} m yang memerlukan pemulihan tanah dan penutup tajuk pionir.`
      : `Zona semak/vegetasi rendah seluas ${props.luas_ha.toFixed(1)} ha dengan kelerengan median ${props.slope_med.toFixed(1)}° di Kecamatan Loa Kulu.`;

  const description = `Poligon ${props.lk_code} (referensi GEE ${props.id}) teridentifikasi mengalami kehilangan tutupan pohon pada periode 2020–2025. Lokasi ini memiliki luas ${props.luas_ha.toFixed(2)} ha, elevasi median ${props.elev_med.toFixed(1)} m, kelerengan median ${props.slope_med.toFixed(1)}° (P90 ${props.slope_p90.toFixed(1)}°), curah hujan tahunan ~${props.rain_mean.toFixed(0)} mm/tahun, serta jenis tanah dominan ${props.tanah_dom}.`;

  const condition_summary =
    props.kelas_id === 1
      ? `Lahan terbuka/indikasi pascatambang (${props.luas_ha.toFixed(1)} ha) dengan paparan sinar matahari langsung dan risiko erosi permukaan.`
      : `Transisi hutan ke semak/kebun (${props.luas_ha.toFixed(1)} ha) pada tanah ${props.tanah_dom} dengan kelerengan ${props.slope_med.toFixed(1)}°.`;

  const rehab_needs =
    category === 'pascatambang'
      ? `Perbaikan media tanam organik, penanaman ${seedlings.toLocaleString('id-ID')} bibit pionir tahan paparan, dan pemeliharaan intensif 3 tahun.`
      : `Penanaman ${seedlings.toLocaleString('id-ID')} bibit campuran pionir, pengayaan asli, dan tanaman bernilai ekonomi bersama warga Loa Kulu.`;

  const tags: string[] = [
    'Loa Kulu',
    props.kelas_id === 1 ? 'Lahan Terbuka' : 'Semak/Kebun',
    props.slope_med >= 11 ? 'Lereng Curam' : 'Topografi Landai–Sedang',
  ];
  if (props.topo_heterogen) tags.push('Topografi Heterogen');

  return {
    name,
    short_name,
    category,
    status,
    summary,
    description,
    condition_summary,
    rehab_needs,
    recommended_species,
    cost_breakdown,
    funding_target,
    image_url: imageByCat[category],
    tags,
  };
}
