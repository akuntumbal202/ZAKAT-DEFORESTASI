import type { LoaKuluPolygonProps, SiteAttributes } from '../types';
import { LOAKULU_ATTR_BY_CODE, LOAKULU_POLYGON_ATTRIBUTES } from '../data/loakuluPolygonAttributes';
import { assetUrl } from '../lib/assets';

export interface LoaKuluGeoFeature {
  type: 'Feature';
  properties: LoaKuluPolygonProps;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface LoaKuluFeatureCollection {
  type: 'FeatureCollection';
  features: LoaKuluGeoFeature[];
}

export interface LoaKuluBoundaryFeature {
  type: 'Feature';
  properties: {
    level: 'kecamatan' | 'desa';
    name: string;
    kabupaten?: string;
    provinsi?: string;
    kecamatan?: string;
    gid?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface LoaKuluBoundaryCollection {
  type: 'FeatureCollection';
  features: LoaKuluBoundaryFeature[];
}

function classifySlope(deg: number): string {
  if (deg < 3) return 'Datar – Landai';
  if (deg < 8) return 'Bergelombang';
  if (deg < 15) return 'Agak Curam';
  if (deg < 25) return 'Curam';
  return 'Sangat Curam';
}

function inferSoilTraits(tanahDom: string): { ph: string; drainage: string } {
  const lower = tanahDom.toLowerCase();
  if (lower.includes('organosol')) {
    return { ph: '4,0–5,2 (Asam organik, estimasi)', drainage: 'Terhambat–lembap musiman' };
  }
  if (lower.includes('aluvial')) {
    return { ph: '5,0–6,2 (Agak asam, estimasi)', drainage: 'Sedang hingga tergenang berkala' };
  }
  if (lower.includes('litosol')) {
    return { ph: '4,5–5,6 (Asam mineral, estimasi)', drainage: 'Cepat, solum dangkal pada lereng' };
  }
  return { ph: '4,5–5,5 (Asam mineral tropis, estimasi)', drainage: 'Baik hingga sedang' };
}

/** Converts actual enriched Loa Kulu GIS attributes into UI-ready `SiteAttributes`. */
export function polygonPropsToSiteAttributes(props: LoaKuluPolygonProps): SiteAttributes {
  const soilTraits = inferSoilTraits(props.tanah_dom);
  const slopePctApprox = Math.round(Math.tan((props.slope_med * Math.PI) / 180) * 100);
  const p90PctApprox = Math.round(Math.tan((props.slope_p90 * Math.PI) / 180) * 100);

  const notes: string[] = [
    `Identitas poligon GEE: ${props.id} (${props.count.toLocaleString('id-ID')} piksel analisis)`,
    `Cakupan tanah dominan: ${props.tanah_dom_pct.toFixed(1)}% (${props.tanah_n_kelas} kelas melintas)`,
  ];
  if (props.topo_heterogen) {
    notes.push(`Topografi heterogen (simpangan lereng ${props.slope_std.toFixed(1)}° ≥ 8,0°)`);
  }

  return {
    project_id: props.lk_code,
    lk_code: props.lk_code,
    geometry_reference: props.id,
    area_ha: props.luas_ha,
    region_label: 'Kec. Loa Kulu, Kutai Kartanegara',
    kelas_id: props.kelas_id,
    climate: {
      type: 'Tropis basah (ERA5-Land 2000–2024)',
      rainfall_mm_year: Math.round(props.rain_mean).toLocaleString('id-ID'),
      temperature_c: '26–28',
    },
    soil: {
      type: props.tanah_dom,
      ph: soilTraits.ph,
      drainage: soilTraits.drainage,
      dominance_pct: props.tanah_dom_pct,
      class_count: props.tanah_n_kelas,
    },
    slope: {
      class: classifySlope(props.slope_med),
      range_pct: `${props.slope_med.toFixed(1)}° med (~${slopePctApprox}%) · P90 ${props.slope_p90.toFixed(1)}° (~${p90PctApprox}%)`,
      median_deg: props.slope_med,
      p90_deg: props.slope_p90,
      topo_heterogen: props.topo_heterogen,
    },
    elevation_m: `${props.elev_med.toFixed(1)} m (rentang ${props.elev_rng.toFixed(1)} m)`,
    land_cover_before: 'Tutupan Pohon (Dynamic World 2020)',
    land_cover_now:
      props.kelas_id === 1
        ? 'Lahan Terbuka / Indikasi Pascatambang (2025)'
        : 'Kebun / Semak / Vegetasi Rendah (2025)',
    disturbance:
      props.kelas_id === 1
        ? 'Pembukaan lahan terbuka / aktivitas tambang'
        : 'Alih fungsi hutan menjadi semak belukar / kebun terbuka',
    other_notes: notes,
    provenance: 'dataset',
  };
}

export function getAllPolygonAttributes(): LoaKuluPolygonProps[] {
  return LOAKULU_POLYGON_ATTRIBUTES;
}

export function getPolygonAttribute(lkCode: string): LoaKuluPolygonProps | null {
  return LOAKULU_ATTR_BY_CODE[lkCode] ?? null;
}

let cachedCollection: LoaKuluFeatureCollection | null = null;
let inflightPromise: Promise<LoaKuluFeatureCollection> | null = null;
let cachedBoundary: LoaKuluBoundaryCollection | null = null;
let boundaryPromise: Promise<LoaKuluBoundaryCollection> | null = null;

/** Lazy-loads the 163-polygon Loa Kulu GeoJSON once and caches it in memory. */
export async function loadLoaKuluGeoJSON(): Promise<LoaKuluFeatureCollection> {
  if (cachedCollection) return cachedCollection;
  if (inflightPromise) return inflightPromise;

  inflightPromise = fetch(assetUrl('/data/loakulu_deforestasi.geojson'))
    .then(async (res) => {
      if (!res.ok) throw new Error(`Gagal memuat GeoJSON Loa Kulu (${res.status})`);
      const data = (await res.json()) as LoaKuluFeatureCollection;
      cachedCollection = data;
      return data;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

/** Lazy-loads the standalone GADM Kecamatan & Desa Loa Kulu boundary GeoJSON. */
export async function loadLoaKuluBoundaryGeoJSON(): Promise<LoaKuluBoundaryCollection> {
  if (cachedBoundary) return cachedBoundary;
  if (boundaryPromise) return boundaryPromise;

  boundaryPromise = fetch(assetUrl('/data/loakulu_boundary.geojson'))
    .then(async (res) => {
      if (!res.ok) throw new Error(`Gagal memuat batas wilayah Loa Kulu (${res.status})`);
      const data = (await res.json()) as LoaKuluBoundaryCollection;
      cachedBoundary = data;
      return data;
    })
    .finally(() => {
      boundaryPromise = null;
    });

  return boundaryPromise;
}
