import {
  SPECIES_CATALOG,
  SPECIES_ROLE_LABEL,
  resolveSpeciesMetrics,
  type SpeciesCatalogItem,
} from '../../data/speciesCatalog';
import type {
  CostItem,
  LoaKuluPolygonProps,
  ProjectCategory,
  ProjectStatus,
  SpeciesRecommendation,
} from '../../types';

/**
 * Spatial Decision Support System (SDSS) — Species Suitability Ranking & Cost Helpers
 * ====================================================================================
 * Evaluates every species in the active database (`public.species` via AppStore)
 * against the 5 biophysical attributes of each Loa Kulu polygon:
 *   1. Elevasi (FABDEM, mdpl)            — bobot 20%
 *   2. Kelerengan (FABDEM, derajat)      — bobot 20%
 *   3. Curah hujan tahunan (ERA5, mm/th) — bobot 20%
 *   4. Jenis tanah dominan (Equal-Area)  — bobot 20%
 *   5. Tutupan lahan (Dynamic World 1/2) — bobot 20%
 * Plus ecological tie-break heuristics (pioneer on open land, riparian on Organosol,
 * erosion-control palm on steep slope).
 */

export interface BiophysicalCheck {
  key: 'elevation' | 'slope' | 'rainfall' | 'soil' | 'landCover';
  label: string;
  ok: boolean;
  detail: string;
}

export type SuitabilityTier = 'Sangat Cocok' | 'Cocok' | 'Cukup Cocok' | 'Kurang Cocok';

export interface RankedSpeciesEvaluation {
  item: SpeciesCatalogItem;
  /** Normalized suitability score 0–100 */
  score: number;
  tier: SuitabilityTier;
  checks: BiophysicalCheck[];
  matchedCount: number;
  ecologicalNote: string | null;
}

function matchesSoil(tanahDom: string, allowedSoils: string[]): boolean {
  const lower = tanahDom.toLowerCase();
  return allowedSoils.some((s) => s.trim().length > 0 && lower.includes(s.toLowerCase()));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function evaluateSpeciesForPolygon(
  item: SpeciesCatalogItem,
  props: LoaKuluPolygonProps,
): RankedSpeciesEvaluation {
  const r = item.suitability;
  const elevOk = props.elev_med >= r.elev_m[0] && props.elev_med <= r.elev_m[1];
  const slopeOk = props.slope_med <= r.slope_max_deg;
  const rainOk = props.rain_mean >= r.rain_mm[0] && props.rain_mean <= r.rain_mm[1];
  const soilOk = matchesSoil(props.tanah_dom, r.soils);
  const coverOk = r.kelas_ids.includes(props.kelas_id);

  // Base 5-factor biophysical score (0–90) + ecological site-fit bonus (0–10)
  let raw = 0;

  // 1. Elevation (max 18)
  if (elevOk) {
    raw += 18;
  } else {
    const dist = props.elev_med < r.elev_m[0] ? r.elev_m[0] - props.elev_med : props.elev_med - r.elev_m[1];
    raw += Math.max(0, 10 - dist * 0.05);
  }

  // 2. Slope (max 18)
  if (slopeOk) {
    raw += 18;
  } else {
    const over = props.slope_med - r.slope_max_deg;
    raw += Math.max(-8, 8 - over * 2);
  }

  // 3. Rainfall (max 18)
  if (rainOk) {
    raw += 18;
  } else {
    const dist = props.rain_mean < r.rain_mm[0] ? r.rain_mm[0] - props.rain_mean : props.rain_mean - r.rain_mm[1];
    raw += Math.max(0, 10 - dist * 0.015);
  }

  // 4. Soil (max 18)
  if (soilOk) raw += 18;

  // 5. Land cover class (max 18)
  if (coverOk) raw += 18;

  // Ecological bonus for Loa Kulu conditions (max 10)
  let bonus = 0;
  let ecologicalNote: string | null = null;
  const soilLower = props.tanah_dom.toLowerCase();

  if (props.kelas_id === 1 && r.role === 'pionir') {
    bonus += 10;
    ecologicalNote = 'Prioritas pionir penutup tajuk cepat pada lahan terbuka/pascatambang';
  } else if ((soilLower.includes('organosol') || soilLower.includes('aluvial')) && r.role === 'riparian') {
    bonus += 10;
    ecologicalNote = 'Adaptif pada tanah lembap/organosol dataran rendah';
  } else if (props.slope_med >= 11 && item.id === 'aren') {
    bonus += 10;
    ecologicalNote = 'Perakaran serabut rapat efektif menahan erosi lereng curam';
  } else if (props.kelas_id === 2 && props.slope_med < 11 && r.role === 'agroforestri') {
    bonus += 8;
    ecologicalNote = 'Ideal untuk pengayaan agroforestri/MPTS bersama warga';
  } else if (props.kelas_id === 2 && r.role === 'klimaks') {
    bonus += 7;
    ecologicalNote = 'Sesuai untuk pengayaan spesies lokal/konservasi berkanopi tinggi';
  } else if (r.role === 'pionir' && props.kelas_id === 2) {
    bonus += 4;
  }

  const score = Math.round(clamp(raw + bonus, 0, 100));
  const tier: SuitabilityTier =
    score >= 85 ? 'Sangat Cocok' : score >= 70 ? 'Cocok' : score >= 50 ? 'Cukup Cocok' : 'Kurang Cocok';

  const checks: BiophysicalCheck[] = [
    {
      key: 'elevation',
      label: 'Elevasi',
      ok: elevOk,
      detail: `${r.elev_m[0]}–${r.elev_m[1]} m (lahan ${props.elev_med.toFixed(0)} m)`,
    },
    {
      key: 'slope',
      label: 'Lereng',
      ok: slopeOk,
      detail: `≤ ${r.slope_max_deg}° (lahan ${props.slope_med.toFixed(1)}°)`,
    },
    {
      key: 'rainfall',
      label: 'Hujan',
      ok: rainOk,
      detail: `${r.rain_mm[0]}–${r.rain_mm[1]} mm (lahan ${Math.round(props.rain_mean)} mm)`,
    },
    {
      key: 'soil',
      label: 'Tanah',
      ok: soilOk,
      detail: `${r.soils.join(', ')}`,
    },
    {
      key: 'landCover',
      label: 'Tutupan',
      ok: coverOk,
      detail: `Kelas ${r.kelas_ids.join(' & ')} (lahan Kelas ${props.kelas_id})`,
    },
  ];

  return {
    item,
    score,
    tier,
    checks,
    matchedCount: checks.filter((c) => c.ok).length,
    ecologicalNote,
  };
}

export function rankSpeciesForPolygon(
  props: LoaKuluPolygonProps,
  catalog: SpeciesCatalogItem[] = SPECIES_CATALOG,
  options?: { validOnly?: boolean; prioritizeValid?: boolean },
): RankedSpeciesEvaluation[] {
  const validOnly = options?.validOnly ?? false;
  const prioritizeValid = options?.prioritizeValid ?? false;
  const pool = validOnly ? catalog.filter((s) => s.verification_status === 'valid') : catalog;

  return pool
    .map((item) => evaluateSpeciesForPolygon(item, props))
    .sort((a, b) => {
      if (prioritizeValid && a.item.verification_status !== b.item.verification_status) {
        // Prioritize valid species if they are at least reasonably suitable (≥ 65)
        const aVal = a.item.verification_status === 'valid' && a.score >= 65;
        const bVal = b.item.verification_status === 'valid' && b.score >= 65;
        if (aVal !== bVal) return aVal ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.verification_status !== b.item.verification_status) {
        return a.item.verification_status === 'valid' ? -1 : 1;
      }
      return a.item.local_name.localeCompare(b.item.local_name);
    });
}

export function buildSuitabilityReason(ev: RankedSpeciesEvaluation, props: LoaKuluPolygonProps): string {
  const roleLabel = SPECIES_ROLE_LABEL[ev.item.suitability.role];
  const parts: string[] = [];
  if (ev.ecologicalNote) {
    parts.push(ev.ecologicalNote);
  } else {
    parts.push(`berperan sebagai ${roleLabel.toLowerCase()}`);
  }
  parts.push(
    `skor SDSS ${ev.score}% (${ev.matchedCount}/5 parameter cocok: elevasi ${props.elev_med.toFixed(0)} m, lereng ${props.slope_med.toFixed(1)}°, tanah ${props.tanah_dom.split(',')[0]})`,
  );
  return `${parts.join(' · ')}.`;
}

/**
 * Target bibit fase-1 berbasis kerapatan tanam rata-rata tertimbang spesies rekomendasi.
 * Untuk blok sangat luas (> 60 ha), target fase awal ditaper agar realistis didanai ZISWAF.
 */
export function suggestSeedlingTarget(
  props: LoaKuluPolygonProps,
  chosenSpecies: SpeciesCatalogItem[] = [],
): number {
  let avgDensity = 400;
  if (chosenSpecies.length > 0) {
    const shareSum = chosenSpecies.reduce((s, sp) => s + resolveSpeciesMetrics(sp).defaultShare, 0) || 1;
    avgDensity = chosenSpecies.reduce((s, sp) => {
      const m = resolveSpeciesMetrics(sp);
      return s + m.densityPerHa * (m.defaultShare / shareSum);
    }, 0);
  }
  const effective =
    Math.min(props.luas_ha, 60) * avgDensity + Math.max(0, props.luas_ha - 60) * (avgDensity * 0.4);
  return Math.max(1500, Math.round(effective / 100) * 100);
}

export function matchSpeciesForPolygon(
  props: LoaKuluPolygonProps,
  catalog: SpeciesCatalogItem[] = SPECIES_CATALOG,
  options?: { validOnly?: boolean; totalSeedlings?: number },
): SpeciesRecommendation[] {
  const ranked = rankSpeciesForPolygon(props, catalog, {
    validOnly: options?.validOnly ?? false,
    prioritizeValid: true,
  });
  if (ranked.length === 0) return [];

  // Pick complementary top 3: prioritize 1 pioneer/riparian canopy starter + up to 2 highest-ranked complementary species
  const picked: RankedSpeciesEvaluation[] = [];
  const starter = ranked.find(
    (x) =>
      (x.item.suitability.role === 'pionir' || x.item.suitability.role === 'riparian') && x.score >= 60,
  );
  if (starter) picked.push(starter);

  // Try to include ecological diversity (e.g. a second different role if suitable)
  const diverse = ranked.find(
    (x) =>
      !picked.some((p) => p.item.id === x.item.id) &&
      x.item.suitability.role !== picked[0]?.item.suitability.role &&
      x.score >= 70,
  );
  if (diverse) picked.push(diverse);

  for (const cand of ranked) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.item.id === cand.item.id)) {
      picked.push(cand);
    }
  }

  const totalSeedlings =
    options?.totalSeedlings ??
    suggestSeedlingTarget(
      props,
      picked.map((p) => p.item),
    );

  const metrics = picked.map((p) => resolveSpeciesMetrics(p.item));
  const shareSum = metrics.reduce((s, m) => s + m.defaultShare, 0) || 1;
  const counts = metrics.map((m) =>
    Math.max(100, Math.round((totalSeedlings * (m.defaultShare / shareSum)) / 50) * 50),
  );
  const diff = totalSeedlings - counts.reduce((s, c) => s + c, 0);
  if (counts.length > 0) counts[0] = Math.max(100, counts[0] + diff);

  return picked.map((ev, idx) => ({
    species_id: ev.item.id,
    seedlings: counts[idx],
    suitability_reason: buildSuitabilityReason(ev, props),
    survival_estimate: metrics[idx].defaultSurvival,
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

export function suggestProgramDefaults(
  props: LoaKuluPolygonProps,
  catalog: SpeciesCatalogItem[] = SPECIES_CATALOG,
  options?: { validOnly?: boolean },
) {
  const category = suggestCategoryForPolygon(props);
  const recommended_species = matchSpeciesForPolygon(props, catalog, {
    validOnly: options?.validOnly,
  });
  const seedlings = recommended_species.reduce((s, r) => s + r.seedlings, 0) || suggestSeedlingTarget(props);
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
