import type {
  SpeciesCatalogItem,
  SpeciesRole,
  SpeciesSuitabilityRule,
} from '../types';

/**
 * MODULAR PLANT CATALOG SEED (16 Spesies Kalimantan Timur / Loa Kulu)
 * ===================================================================
 * Sumber data utama aplikasi kini berasal dari tabel `public.species` di Supabase
 * sehingga Admin dapat menambah, menyunting, memverifikasi, atau menghapus spesies
 * langsung dari antarmuka Admin. File ini berfungsi sebagai:
 *   1. Seed cadangan (fallback offline / sebelum migrasi SQL dijalankan).
 *   2. Definisi helper metrik karbon & validasi Data Inti vs Data Turunan.
 *
 * Pembagian status verifikasi awal:
 * - 'valid' (5 spesies): memiliki angka serapan karbon empiris langsung dari
 *   Fajariani et al. (2020) [Loa Kulu], Sarjono et al. (2017) [Kaltara], dan
 *   Racelis et al. (2019) [reboisasi Indonesia].
 * - 'dummy' (11 spesies): parameter biofisik/karbon awal sambil menunggu
 *   verifikasi kurasi final tim biologi & silvikultur (mudah dihapus massal).
 */
export const SPECIES_CATALOG_META = {
  status: 'database SDSS (valid & dummy)' as const,
  version: '0.3-loakulu-sdss',
  note: 'Katalog spesies terhubung ke database Supabase dengan status verifikasi Valid/Dummy. Parameter opsional yang kosong otomatis menggunakan rujukan ilmiah fallback Racelis et al. (2019) & Sarjono et al. (2017).',
};

export const SPECIES_ROLE_LABEL: Record<SpeciesRole, string> = {
  pionir: 'Pionir',
  klimaks: 'Lokal / Konservasi',
  agroforestri: 'MPTS / Agroforestri',
  riparian: 'Riparian / Lembap',
};

export const LOA_KULU_SOIL_OPTIONS = [
  'Padsolik',
  'Latosol',
  'Litosol',
  'Organosol',
  'Aluvial',
] as const;

/**
 * Fallback laju serapan karbon tegakan (ton CO₂/ha/tahun) dari Racelis et al. (2019)
 * ketika spesies Valid/Dummy belum memiliki angka pengukuran karbon spesifik:
 * - Lokal / Konservasi (Dipterocarpaceae): 2,89 Mg C/ha/th × (44/12) ≈ 10,60 t CO₂/ha/th
 * - Rata-rata umum reboisasi Indonesia:    5,06 Mg C/ha/th × (44/12) ≈ 18,55 t CO₂/ha/th
 */
export const ROLE_FALLBACK_CO2_TON_HA_YR: Record<SpeciesRole, number> = {
  pionir: 18.55,
  klimaks: 10.6,
  agroforestri: 18.55,
  riparian: 18.55,
};

/** Fallback kerapatan tanam standar rehabilitasi (bibit/ha) sesuai peran ekologis. */
export const ROLE_FALLBACK_DENSITY_HA: Record<SpeciesRole, number> = {
  pionir: 625,
  riparian: 625,
  klimaks: 400,
  agroforestri: 300,
};

export const DEFAULT_SPECIES_SURVIVAL = 0.7;
export const DEFAULT_SPECIES_SHARE = 0.3;

export type { SpeciesCatalogItem, SpeciesSuitabilityRule };

export interface ResolvedSpeciesMetrics {
  co2TonPerHaYr: number;
  isCarbonFallback: boolean;
  densityPerHa: number;
  isDensityFallback: boolean;
  defaultSurvival: number;
  isSurvivalFallback: boolean;
  defaultShare: number;
  /**
   * Laju serapan puncak per pohon HIDUP (kg CO₂/pohon hidup/tahun):
   *   (co2TonPerHaYr × 1000) / (densityPerHa × defaultSurvival)
   * Rumus ini mencegah penghitungan ganda mortalitas: 1 ha tegakan dengan
   * kerapatan `densityPerHa` dan kelulushidupan `defaultSurvival` menghasilkan
   * tepat `co2TonPerHaYr` ton CO₂/ha/tahun pada fase dewasa.
   */
  co2KgPerSurvivingTreeYr: number;
  /** Ekuivalen per bibit yang ditanam pada survival standar (kg CO₂/bibit/tahun). */
  co2KgPerPlantedSeedlingYr: number;
}

export function resolveSpeciesMetrics(item: SpeciesCatalogItem): ResolvedSpeciesMetrics {
  const r = item.suitability;
  const hasCo2 = typeof r.co2_ton_per_ha_yr === 'number' && Number.isFinite(r.co2_ton_per_ha_yr) && r.co2_ton_per_ha_yr > 0;
  const hasDensity = typeof r.density_per_ha === 'number' && Number.isFinite(r.density_per_ha) && r.density_per_ha > 0;
  const hasSurvival =
    typeof r.default_survival === 'number' &&
    Number.isFinite(r.default_survival) &&
    r.default_survival > 0 &&
    r.default_survival <= 1;
  const hasShare = typeof r.default_share === 'number' && Number.isFinite(r.default_share) && r.default_share > 0;

  const co2TonPerHaYr = hasCo2 ? r.co2_ton_per_ha_yr! : ROLE_FALLBACK_CO2_TON_HA_YR[r.role];
  const densityPerHa = hasDensity ? r.density_per_ha! : ROLE_FALLBACK_DENSITY_HA[r.role];
  const defaultSurvival = hasSurvival ? r.default_survival! : DEFAULT_SPECIES_SURVIVAL;
  const defaultShare = hasShare ? r.default_share! : DEFAULT_SPECIES_SHARE;

  const survivingPerHa = Math.max(1, densityPerHa * defaultSurvival);
  const co2KgPerSurvivingTreeYr = (co2TonPerHaYr * 1000) / survivingPerHa;
  const co2KgPerPlantedSeedlingYr = (co2TonPerHaYr * 1000) / Math.max(1, densityPerHa);

  return {
    co2TonPerHaYr,
    isCarbonFallback: !hasCo2,
    densityPerHa,
    isDensityFallback: !hasDensity,
    defaultSurvival,
    isSurvivalFallback: !hasSurvival,
    defaultShare,
    co2KgPerSurvivingTreeYr,
    co2KgPerPlantedSeedlingYr,
  };
}

export function slugifySpeciesId(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `spesies-${Date.now().toString(36)}`;
}

/**
 * Validasi Data Inti spesies (hanya field inti yang wajib).
 * Field turunan/opsional (`co2_ton_per_ha_yr`, `density_per_ha`, `default_survival`,
 * `default_share`, `carbon_source`, `description`, `traits`) boleh kosong / null
 * tanpa membuat spesies kehilangan status 'valid'.
 */
export function validateSpeciesCore(item: Partial<SpeciesCatalogItem>): string | null {
  if (!item.local_name || item.local_name.trim().length < 2) {
    return 'Nama lokal (Data Inti) minimal 2 karakter.';
  }
  if (!item.scientific_name || item.scientific_name.trim().length < 3) {
    return 'Nama ilmiah (Data Inti) minimal 3 karakter.';
  }
  const s = item.suitability;
  if (!s) return 'Parameter biofisik (Data Inti) wajib diisi.';
  if (!Array.isArray(s.elev_m) || !Number.isFinite(s.elev_m[0]) || !Number.isFinite(s.elev_m[1])) {
    return 'Rentang elevasi (min & max mdpl) wajib berupa angka valid.';
  }
  if (s.elev_m[0] < 0 || s.elev_m[1] <= s.elev_m[0]) {
    return 'Elevasi maksimum harus lebih besar dari elevasi minimum (≥ 0 mdpl).';
  }
  if (!Number.isFinite(s.slope_max_deg) || s.slope_max_deg <= 0 || s.slope_max_deg > 90) {
    return 'Kelerengan maksimum harus di antara 1° hingga 90°.';
  }
  if (!Array.isArray(s.rain_mm) || !Number.isFinite(s.rain_mm[0]) || !Number.isFinite(s.rain_mm[1])) {
    return 'Rentang curah hujan tahunan (mm/th) wajib berupa angka valid.';
  }
  if (s.rain_mm[0] < 0 || s.rain_mm[1] <= s.rain_mm[0]) {
    return 'Curah hujan maksimum harus lebih besar dari curah hujan minimum.';
  }
  if (!Array.isArray(s.soils) || s.soils.filter((x) => x.trim().length > 0).length === 0) {
    return 'Pilih minimal 1 jenis tanah yang sesuai (Data Inti).';
  }
  if (!Array.isArray(s.kelas_ids) || s.kelas_ids.length === 0) {
    return 'Pilih minimal 1 kelas tutupan lahan target (Kelas 1 dan/atau Kelas 2).';
  }
  return null;
}

export const SPECIES_CATALOG: SpeciesCatalogItem[] = [
  // ── 5 SPESIES VALID (Rujukan empiris karbon langsung) ──────────────────────
  {
    id: 'johar',
    local_name: 'Johar',
    scientific_name: 'Senna siamea',
    growth_form: 'pohon',
    verification_status: 'valid',
    description:
      'Pohon pionir legum tangguh yang terbukti berhasil pada lahan reklamasi pascatambang batubara di Kecamatan Loa Kulu dengan laju serapan karbon stabil.',
    traits: ['Pionir', 'Tahan pascatambang', 'Validasi Loa Kulu'],
    suitability: {
      elev_m: [0, 800],
      slope_max_deg: 25,
      rain_mm: [1000, 3500],
      soils: ['Padsolik', 'Latosol', 'Aluvial', 'Litosol'],
      kelas_ids: [1, 2],
      role: 'pionir',
      co2_ton_per_ha_yr: 19.0,
      density_per_ha: 625,
      default_survival: 0.78,
      default_share: 0.38,
      carbon_source:
        'Fajariani et al. (2020) — reklamasi pascatambang PT MHU Loa Kulu, Kukar (18,94–20,38 t CO₂/ha/th umur 6–9 th)',
    },
  },
  {
    id: 'trembesi',
    local_name: 'Trembesi',
    scientific_name: 'Albizia saman',
    growth_form: 'pohon',
    verification_status: 'valid',
    description:
      'Pohon bertajuk lebar pengikat nitrogen untuk menciptakan iklim mikro teduh di lahan terbuka dan bekas tambang Loa Kulu (sin. Samanea saman).',
    traits: ['Tajuk lebar', 'Pengikat nitrogen', 'Validasi Loa Kulu'],
    suitability: {
      elev_m: [0, 500],
      slope_max_deg: 20,
      rain_mm: [1500, 3800],
      soils: ['Padsolik', 'Aluvial', 'Latosol'],
      kelas_ids: [1, 2],
      role: 'pionir',
      co2_ton_per_ha_yr: 23.44,
      density_per_ha: 400,
      default_survival: 0.74,
      default_share: 0.3,
      carbon_source:
        'Fajariani et al. (2020) — reklamasi pascatambang PT MHU Loa Kulu, Kukar (23,44 t CO₂/ha/th tegakan campuran umur 9 th)',
    },
  },
  {
    id: 'jabon',
    local_name: 'Jabon Putih',
    scientific_name: 'Anthocephalus cadamba',
    growth_form: 'pohon',
    verification_status: 'valid',
    description:
      'Pohon lokal Kalimantan cepat tumbuh untuk dataran rendah lembap dan zona organosol/aluvial; sensitif kekeringan sehingga tidak disarankan untuk lahan kritis kering (sin. Neolamarckia cadamba).',
    traits: ['Lokal Kalimantan', 'Toleran lahan lembap', 'Cepat tumbuh'],
    suitability: {
      elev_m: [0, 500],
      slope_max_deg: 15,
      rain_mm: [2000, 4500],
      soils: ['Aluvial', 'Organosol', 'Padsolik'],
      kelas_ids: [2],
      role: 'riparian',
      co2_ton_per_ha_yr: 18.02,
      density_per_ha: 625,
      default_survival: 0.7,
      default_share: 0.36,
      carbon_source:
        'Sarjono et al. (2017) — Kalimantan Utara, Plot 1 kontrol 4×4 m (16,07–18,02 t CO₂/ha/th; survival 70,4% umur 10 th)',
    },
  },
  {
    id: 'akasia',
    local_name: 'Akasia',
    scientific_name: 'Acacia mangium',
    growth_form: 'pohon',
    verification_status: 'valid',
    description:
      'Pionir pengikat nitrogen sangat cepat tumbuh pada tanah masam terbuka pascatambang; direkomendasikan sebagai penaung fase awal yang dikendalikan dan diperkaya spesies lokal.',
    traits: ['Pionir sangat cepat', 'Pengikat nitrogen', 'Tahan tanah masam'],
    suitability: {
      elev_m: [0, 600],
      slope_max_deg: 28,
      rain_mm: [1500, 4000],
      soils: ['Padsolik', 'Latosol', 'Litosol'],
      kelas_ids: [1, 2],
      role: 'pionir',
      co2_ton_per_ha_yr: 45.83,
      density_per_ha: 1111,
      default_survival: 0.8,
      default_share: 0.34,
      carbon_source:
        'Racelis et al. (2019) — batas atas pionir cepat tumbuh Indonesia (12,50 Mg C/ha/th ≈ 45,83 t CO₂/ha/th); Fajariani et al. (2020) PT MHU Loa Kulu',
    },
  },
  {
    id: 'meranti-merah',
    local_name: 'Meranti Merah',
    scientific_name: 'Shorea leprosula',
    growth_form: 'pohon',
    verification_status: 'valid',
    description:
      'Tegakan utama Dipterocarpaceae asli Kalimantan yang ditanam sebagai pengayaan kanopi tinggi setelah penaung pionir tersedia.',
    traits: ['Dipterocarpaceae asli', 'Butuh naungan awal', 'Kanopi utama'],
    suitability: {
      elev_m: [0, 700],
      slope_max_deg: 30,
      rain_mm: [2200, 4500],
      soils: ['Padsolik', 'Latosol'],
      kelas_ids: [2],
      role: 'klimaks',
      co2_ton_per_ha_yr: 10.6,
      density_per_ha: 400,
      default_survival: 0.65,
      default_share: 0.32,
      carbon_source:
        'Racelis et al. (2019) — kelompok Dipterocarpaceae Indonesia (2,89 Mg C/ha/th ≈ 10,60 t CO₂/ha/th); Pratiwi et al. (2021)',
    },
  },

  // ── 11 SPESIES DUMMY (Referensi awal menunggu verifikasi tim tanaman) ──────
  {
    id: 'sengon',
    local_name: 'Sengon',
    scientific_name: 'Falcataria moluccana',
    growth_form: 'pohon',
    verification_status: 'dummy',
    description:
      'Polong-polongan cepat tumbuh pengikat nitrogen yang umum dipakai sebagai tanaman pionir pembentuk naungan awal (sin. Falcataria falcata).',
    traits: ['Pionir', 'Pengikat nitrogen', 'Cepat tumbuh'],
    suitability: {
      elev_m: [0, 800],
      slope_max_deg: 25,
      rain_mm: [1800, 4200],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [1, 2],
      role: 'pionir',
      co2_ton_per_ha_yr: null,
      density_per_ha: 625,
      default_survival: 0.78,
      default_share: 0.4,
      carbon_source:
        'Fallback rata-rata Racelis et al. (2019); kandidat pionir Proposal 2.1.4 & PT MHU Loa Kulu (Fajariani et al., 2020)',
    },
  },
  {
    id: 'sungkai',
    local_name: 'Sungkai',
    scientific_name: 'Peronema canescens',
    growth_form: 'pohon',
    verification_status: 'dummy',
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
      co2_ton_per_ha_yr: null,
      density_per_ha: 625,
      default_survival: 0.82,
      default_share: 0.36,
      carbon_source:
        'Fallback rata-rata Racelis et al. (2019); kandidat pionir Proposal 2.1.4 & PT MHU Loa Kulu (Fajariani et al., 2020)',
    },
  },
  {
    id: 'ulin',
    local_name: 'Ulin / Kayu Besi',
    scientific_name: 'Eusideroxylon zwageri',
    growth_form: 'pohon',
    verification_status: 'dummy',
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
      co2_ton_per_ha_yr: null,
      density_per_ha: 400,
      default_survival: 0.58,
      default_share: 0.22,
      carbon_source:
        'Fallback kelompok lokal/konservasi Racelis et al. (2019); kandidat konservasi Pratiwi et al. (2021)',
    },
  },
  {
    id: 'gaharu',
    local_name: 'Gaharu',
    scientific_name: 'Aquilaria malaccensis',
    growth_form: 'pohon',
    verification_status: 'dummy',
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
      co2_ton_per_ha_yr: null,
      density_per_ha: 400,
      default_survival: 0.68,
      default_share: 0.25,
      carbon_source:
        'Fallback kelompok lokal/konservasi Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
    },
  },
  {
    id: 'durian',
    local_name: 'Durian / Lai Lokal',
    scientific_name: 'Durio zibethinus',
    growth_form: 'pohon buah',
    verification_status: 'dummy',
    description:
      'Tanaman agroforestri bernilai ekonomi jangka panjang agar masyarakat sekitar ikut merawat tegakan restorasi.',
    traits: ['MPTS / Agroforestri', 'Ekonomi masyarakat', 'Tajuk sedang'],
    suitability: {
      elev_m: [10, 700],
      slope_max_deg: 20,
      rain_mm: [2000, 3800],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [2],
      role: 'agroforestri',
      co2_ton_per_ha_yr: null,
      density_per_ha: 250,
      default_survival: 0.76,
      default_share: 0.3,
      carbon_source: 'Fallback rata-rata Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
    },
  },
  {
    id: 'petai',
    local_name: 'Petai',
    scientific_name: 'Parkia speciosa',
    growth_form: 'pohon buah',
    verification_status: 'dummy',
    description:
      'Polong-polongan agroforestri yang membantu fiksasi nitrogen tanah dan memberi hasil panen berkelanjutan.',
    traits: ['MPTS / Agroforestri', 'Pengikat nitrogen', 'Ekonomi warga'],
    suitability: {
      elev_m: [10, 900],
      slope_max_deg: 22,
      rain_mm: [2000, 4000],
      soils: ['Padsolik', 'Latosol'],
      kelas_ids: [2],
      role: 'agroforestri',
      co2_ton_per_ha_yr: null,
      density_per_ha: 250,
      default_survival: 0.78,
      default_share: 0.3,
      carbon_source: 'Fallback rata-rata Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
    },
  },
  {
    id: 'aren',
    local_name: 'Aren Konservasi',
    scientific_name: 'Arenga pinnata',
    growth_form: 'palma',
    verification_status: 'dummy',
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
      co2_ton_per_ha_yr: null,
      density_per_ha: 400,
      default_survival: 0.8,
      default_share: 0.32,
      carbon_source: 'Fallback rata-rata Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
    },
  },
  {
    id: 'mahang',
    local_name: 'Mahang',
    scientific_name: 'Macaranga gigantea',
    growth_form: 'pohon',
    verification_status: 'dummy',
    description:
      'Pionir asli hutan sekunder Kalimantan berdaun lebar yang cepat menutup bukaan lahan dan melindungi permukaan tanah dari erosi hujan.',
    traits: ['Pionir lokal', 'Regenerasi alami', 'Penutup tanah cepat'],
    suitability: {
      elev_m: [0, 700],
      slope_max_deg: 28,
      rain_mm: [2000, 4500],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [1, 2],
      role: 'pionir',
      co2_ton_per_ha_yr: null,
      density_per_ha: 625,
      default_survival: 0.82,
      default_share: 0.32,
      carbon_source:
        'Pionir regenerasi alami PT MHU Loa Kulu (Fajariani et al., 2020) & Purnomo et al. (2022); fallback karbon Racelis (2019)',
    },
  },
  {
    id: 'laban',
    local_name: 'Laban / Halaban',
    scientific_name: 'Vitex pinnata',
    growth_form: 'pohon',
    verification_status: 'dummy',
    description:
      'Spesies pionir asli tahan api ringan dan tanah terdegradasi yang sering tumbuh dominan pada tahap pemulihan awal Kalimantan Timur.',
    traits: ['Pionir lokal', 'Tahan tanah miskin', 'Adaptif pascatambang'],
    suitability: {
      elev_m: [0, 800],
      slope_max_deg: 30,
      rain_mm: [1800, 4200],
      soils: ['Padsolik', 'Latosol', 'Litosol'],
      kelas_ids: [1, 2],
      role: 'pionir',
      co2_ton_per_ha_yr: null,
      density_per_ha: 625,
      default_survival: 0.8,
      default_share: 0.32,
      carbon_source:
        'Tercatat dalam revegetasi PT MHU Loa Kulu (Fajariani et al., 2020); fallback karbon Racelis et al. (2019)',
    },
  },
  {
    id: 'cempedak',
    local_name: 'Cempedak / Nangka',
    scientific_name: 'Artocarpus integer',
    growth_form: 'pohon buah',
    verification_status: 'dummy',
    description:
      'Spesies buah serbaguna (MPTS) asli kawasan Malesia yang mendukung ketahanan pangan dan ekonomi warga sekitar blok rehabilitasi.',
    traits: ['MPTS / Agroforestri', 'Buah lokal', 'Ekonomi warga'],
    suitability: {
      elev_m: [0, 700],
      slope_max_deg: 20,
      rain_mm: [2000, 4000],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [2],
      role: 'agroforestri',
      co2_ton_per_ha_yr: null,
      density_per_ha: 250,
      default_survival: 0.76,
      default_share: 0.28,
      carbon_source:
        'Kandidat MPTS Kalimantan Timur (Pratiwi et al., 2021 / Proposal 2.1.4); fallback karbon Racelis et al. (2019)',
    },
  },
  {
    id: 'mangga-kalimantan',
    local_name: 'Kasturi / Mangga Lokal',
    scientific_name: 'Mangifera casturi',
    growth_form: 'pohon buah',
    verification_status: 'dummy',
    description:
      'Spesies mangga lokal/endemik Kalimantan bernilai konservasi dan ekonomi buah untuk pengayaan agroforestri.',
    traits: ['MPTS / Agroforestri', 'Endemik Kalimantan', 'Konservasi buah'],
    suitability: {
      elev_m: [0, 500],
      slope_max_deg: 18,
      rain_mm: [2000, 3800],
      soils: ['Padsolik', 'Latosol', 'Aluvial'],
      kelas_ids: [2],
      role: 'agroforestri',
      co2_ton_per_ha_yr: null,
      density_per_ha: 250,
      default_survival: 0.75,
      default_share: 0.28,
      carbon_source:
        'Kandidat MPTS Kalimantan (Pratiwi et al., 2021 / Proposal 2.1.4); fallback karbon Racelis et al. (2019)',
    },
  },
];

export const SPECIES_CATALOG_BY_ID: Record<string, SpeciesCatalogItem> = Object.fromEntries(
  SPECIES_CATALOG.map((s) => [s.id, s]),
);
