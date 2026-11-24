import type { Species } from '../types';

/**
 * MODULAR PLANT CATALOG (Siap Diperbarui oleh Tim Tanaman)
 * =========================================================
 * File ini sengaja dipisahkan agar rekan tim yang menyusun data spesies &
 * syarat tumbuh dapat langsung mengisi atau memodifikasi entri di bawah ini
 * tanpa menyentuh komponen UI maupun logika peta.
 *
 * Nilai rentang (`elev_m`, `slope_max_deg`, `rain_mm`, `soils`, `kelas_ids`)
 * pada versi ini berlabel PLACEHOLDER ilustratif.
 */
export const SPECIES_CATALOG_META = {
  status: 'placeholder' as const,
  version: '0.1-loakulu-placeholder',
  note: 'Kriteria kesesuaian lahan di bawah ini adalah placeholder ilustratif untuk menguji auto-suggest. Ganti dengan daftar spesies & parameter silvikultur final dari tim tanaman.',
};

export interface SpeciesSuitabilityRule {
  /** Rentang elevasi ideal [min_mdpl, max_mdpl] */
  elev_m: [number, number];
  /** Kelerengan maksimum yang direkomendasikan (derajat) */
  slope_max_deg: number;
  /** Rentang curah hujan tahunan [min_mm, max_mm] */
  rain_mm: [number, number];
  /** Substring kelas tanah (`tanah_dom`) yang cocok */
  soils: string[];
  /** Kelas tutupan Dynamic World target: 1 = Lahan terbuka/pascatambang, 2 = Semak/kebun */
  kelas_ids: (1 | 2)[];
  role: 'pionir' | 'klimaks' | 'agroforestri' | 'riparian';
  /** Perkiraan kelulushidupan placeholder (0-1) */
  default_survival: number;
  /** Bobot porsi bibit default relatif */
  default_share: number;
}

export interface SpeciesCatalogItem extends Species {
  suitability: SpeciesSuitabilityRule;
}

export const SPECIES_CATALOG: SpeciesCatalogItem[] = [
  {
    id: 'sengon',
    local_name: 'Sengon (Placeholder)',
    scientific_name: 'Falcataria falcata',
    growth_form: 'pohon',
    description:
      'Polong-polongan cepat tumbuh pengikat nitrogen yang umum dipakai sebagai tanaman pionir pembentuk naungan awal.',
    traits: ['Pionir', 'Pengikat nitrogen', 'Cepat tumbuh'],
    suitability: {
      elev_m: [0, 800],
      slope_max_deg: 25,
      rain_mm: [1800, 4200],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [1, 2],
      role: 'pionir',
      default_survival: 0.78,
      default_share: 0.4,
    },
  },
  {
    id: 'jabon',
    local_name: 'Jabon Merah / Putih (Placeholder)',
    scientific_name: 'Neolamarckia cadamba',
    growth_form: 'pohon',
    description:
      'Pohon pionir bertajuk ringan yang adaptif di dataran rendah lembap, sempadan aliran air, dan bekas gangguan tanah.',
    traits: ['Pionir', 'Toleran lahan lembap', 'Tajuk cepat'],
    suitability: {
      elev_m: [0, 500],
      slope_max_deg: 18,
      rain_mm: [2000, 4500],
      soils: ['Aluvial', 'Organosol', 'Padsolik'],
      kelas_ids: [1, 2],
      role: 'riparian',
      default_survival: 0.8,
      default_share: 0.38,
    },
  },
  {
    id: 'sungkai',
    local_name: 'Sungkai (Placeholder)',
    scientific_name: 'Peronema canescens',
    growth_form: 'pohon',
    description:
      'Spesies asli Kalimantan yang tangguh pada lahan terbuka, semak belukar, maupun tanah masam bekas pembukaan.',
    traits: ['Spesies Kalimantan', 'Tahan paparan terbuka', 'Pionir'],
    suitability: {
      elev_m: [0, 600],
      slope_max_deg: 28,
      rain_mm: [2000, 4200],
      soils: ['Padsolik', 'Latosol', 'Litosol', 'Organosol'],
      kelas_ids: [1, 2],
      role: 'pionir',
      default_survival: 0.82,
      default_share: 0.36,
    },
  },
  {
    id: 'trembesi',
    local_name: 'Trembesi (Placeholder)',
    scientific_name: 'Samanea saman',
    growth_form: 'pohon',
    description:
      'Pohon bertajuk lebar pengikat nitrogen untuk menciptakan iklim mikro teduh di lahan terbuka dan bekas tambang.',
    traits: ['Tajuk lebar', 'Pengikat nitrogen', 'Peneduh'],
    suitability: {
      elev_m: [0, 500],
      slope_max_deg: 20,
      rain_mm: [1800, 3800],
      soils: ['Padsolik', 'Aluvial', 'Latosol'],
      kelas_ids: [1, 2],
      role: 'pionir',
      default_survival: 0.74,
      default_share: 0.3,
    },
  },
  {
    id: 'meranti-merah',
    local_name: 'Meranti Merah (Placeholder)',
    scientific_name: 'Shorea leprosula',
    growth_form: 'pohon',
    description:
      'Tegakan utama Dipterocarpaceae Kalimantan yang ditanam sebagai pengayaan kanopi tinggi setelah penaung awal tersedia.',
    traits: ['Spesies asli', 'Butuh naungan awal', 'Kanopi utama'],
    suitability: {
      elev_m: [0, 700],
      slope_max_deg: 30,
      rain_mm: [2200, 4500],
      soils: ['Padsolik', 'Latosol'],
      kelas_ids: [2],
      role: 'klimaks',
      default_survival: 0.65,
      default_share: 0.32,
    },
  },
  {
    id: 'ulin',
    local_name: 'Ulin / Kayu Besi (Placeholder)',
    scientific_name: 'Eusideroxylon zwageri',
    growth_form: 'pohon',
    description:
      'Pohon konservasi endemik Kalimantan berumur panjang dan berkayu sangat kuat, cocok untuk pengayaan inti blok.',
    traits: ['Endemik Kalimantan', 'Konservasi tinggi', 'Tumbuh lambat'],
    suitability: {
      elev_m: [0, 500],
      slope_max_deg: 25,
      rain_mm: [2200, 4500],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [2],
      role: 'klimaks',
      default_survival: 0.58,
      default_share: 0.22,
    },
  },
  {
    id: 'gaharu',
    local_name: 'Gaharu (Placeholder)',
    scientific_name: 'Aquilaria malaccensis',
    growth_form: 'pohon',
    description:
      'Pohon hutan penghasil resin bernilai tinggi yang sesuai dipadukan dalam pengayaan bertahap dengan naungan sedang.',
    traits: ['Bernilai ekonomi', 'Pengayaan tajuk', 'Diatur CITES'],
    suitability: {
      elev_m: [15, 750],
      slope_max_deg: 26,
      rain_mm: [2000, 4200],
      soils: ['Padsolik', 'Latosol'],
      kelas_ids: [1, 2],
      role: 'klimaks',
      default_survival: 0.68,
      default_share: 0.25,
    },
  },
  {
    id: 'durian',
    local_name: 'Durian / Lai Lokal (Placeholder)',
    scientific_name: 'Durio zibethinus',
    growth_form: 'pohon buah',
    description:
      'Tanaman agroforestri bernilai ekonomi jangka panjang agar masyarakat sekitar ikut merawat tegakan restorasi.',
    traits: ['Agroforestri', 'Ekonomi masyarakat', 'Tajuk sedang'],
    suitability: {
      elev_m: [10, 700],
      slope_max_deg: 20,
      rain_mm: [2000, 3800],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [2],
      role: 'agroforestri',
      default_survival: 0.76,
      default_share: 0.3,
    },
  },
  {
    id: 'petai',
    local_name: 'Petai (Placeholder)',
    scientific_name: 'Parkia speciosa',
    growth_form: 'pohon buah',
    description:
      'Polong-polongan agroforestri yang membantu fiksasi nitrogen tanah dan memberi hasil panen berkelanjutan.',
    traits: ['Agroforestri', 'Pengikat nitrogen', 'Ekonomi warga'],
    suitability: {
      elev_m: [10, 900],
      slope_max_deg: 22,
      rain_mm: [2000, 4000],
      soils: ['Padsolik', 'Latosol'],
      kelas_ids: [2],
      role: 'agroforestri',
      default_survival: 0.78,
      default_share: 0.3,
    },
  },
  {
    id: 'aren',
    local_name: 'Aren Konservasi (Placeholder)',
    scientific_name: 'Arenga pinnata',
    growth_form: 'palma',
    description:
      'Palma berakar serabut rapat dan dalam yang efektif menahan erosi pada lereng curam sekaligus memberi nilai nira.',
    traits: ['Penahan erosi', 'Lahan berlereng', 'Ekonomi lestari'],
    suitability: {
      elev_m: [20, 1100],
      slope_max_deg: 35,
      rain_mm: [2000, 4500],
      soils: ['Padsolik', 'Latosol', 'Litosol'],
      kelas_ids: [1, 2],
      role: 'agroforestri',
      default_survival: 0.8,
      default_share: 0.32,
    },
  },
];

export const SPECIES_CATALOG_BY_ID: Record<string, SpeciesCatalogItem> = Object.fromEntries(
  SPECIES_CATALOG.map((s) => [s.id, s]),
);
