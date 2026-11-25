/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IMPACT MODEL ASSUMPTIONS & METHODOLOGY NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 *  Parameter di bawah ini adalah asumsi ilustrasi untuk prototipe kalkulator.
 *  Struktur modul dipisahkan dari UI agar mudah diganti dengan persamaan
 *  alometrik per spesies atau pengukuran lapangan pada tahap implementasi.
 */
export const IMPACT_ASSUMPTIONS = {
  /** Laju serapan CO₂ tahunan pohon dewasa saat mendekati puncak pertumbuhan (kg/pohon/tahun). */
  co2KgPerTreePerYearAtPlateau: 20,
  /** Titik tengah (inflection point) kurva logistik sigmoidal (tahun ke-5,5). */
  sigmoidMidpointYear: 5.5,
  /** Laju kecuraman transisi kurva sigmoidal (k = 0,65). */
  sigmoidSteepness: 0.65,
  /** Asumsi tingkat keberhasilan hidup bawaan bila program belum memiliki nilai spesifik. */
  defaultSurvivalRate: 0.7,
  /**
   * Rasio massa O₂ dilepas terhadap CO₂ diserap pada fotosintesis bersih
   * (CO₂ + H₂O → CH₂O + O₂ ⇒ 32 g O₂ per 44 g CO₂). Penyederhanaan stoikiometris.
   */
  o2PerCo2MassRatio: 32 / 44,
  /** Biaya estimasi per bibit (all-in) saat tidak memilih program tertentu (IDR). */
  fallbackCostPerSeedling: 30_000,
  version: 'sigmoidal-0.2',
} as const;

export const GIS_METHOD_STEPS = [
  'Deteksi deforestasi (2020–2025): membandingkan tutupan lahan Dynamic World V1 (resolusi 10 m) dari kelas tutupan pohon tahun 2020 yang berubah menjadi non-pohon pada tahun 2025 di Kecamatan Loa Kulu, lalu disaring untuk hamparan ≥ 5 ha sehingga diperoleh 163 poligon (total 5.783,7 ha).',
  'Klasifikasi tutupan lahan pasca-deforestasi: poligon dibagi menjadi Kelas 1 (lahan terbuka / indikasi pascatambang, 21 poligon) dan Kelas 2 (semak belukar / kebun terbuka, 142 poligon).',
  'Ekstraksi topografi (FABDEM 30 m): statistik zonal menghitung elevasi median & rentang elevasi (m), serta kelerengan median, standar deviasi, dan persentil ke-90 (derajat) dengan penanda topografi heterogen (σ ≥ 8,0°).',
  'Ekstraksi curah hujan (ERA5-Land ~0,1°): rata-rata curah hujan tahunan (mm/tahun) diambil dari data resolusi asli tanpa penghalusan, dengan fallback titik representatif (representative point) untuk poligon kecil agar tidak ada nilai kosong.',
  'Analisis jenis tanah dominan: layer poligon deforestasi dan peta jenis tanah diproyeksikan ke sistem Equal-Area (EPSG:6933) lalu di-overlay dengan metode irisan terluas (largest overlap) untuk memperoleh kelas tanah dominan, persentase cakupan, dan jumlah kelas tanah.',
  'Batas wilayah & citra pembanding: batas Kecamatan Loa Kulu beserta 12 desa berasal dari GADM v4.1 (ADM_3 & ADM_4), dipadukan dengan komposit Sentinel-2 L2A 2025 (Cloud Score+ ≥ 0,60) yang dipotong tepat mengikuti batas kecamatan.',
];

export const METHOD_NOTES = [
  'Dana → bibit: nominal donasi dibagi biaya total per bibit pada program terpilih (mencakup pembibitan, persiapan lahan, penanaman, pemeliharaan, monitoring, dan operasional).',
  'Bibit → pohon hidup: jumlah bibit dikalikan asumsi tingkat keberhasilan hidup (survival rate) program.',
  'Pohon hidup → CO₂ (kurva sigmoidal): serapan tahunan mengikuti fungsi logistik f(t) = 1 / (1 + e^(−0,65 × (t − 5,5))) dikalikan laju puncak 20 kg CO₂/pohon/tahun — melambat pada fase adaptasi (tahun 1–3), meningkat cepat pada tahun 4–9, lalu mendekati laju stabil dewasa pada tahun 10–15.',
  'CO₂ → O₂: dihitung dari rasio massa stoikiometris fotosintesis bersih (32/44) sebagai penyederhanaan ilustratif.',
];

export const UNCERTAINTY_NOTE =
  'Seluruh angka dampak karbon dan oksigen bersifat estimasi ilustratif berdasarkan model matematis, bukan hasil pengukuran biomassa lapangan. Realisasi di lapangan sangat dipengaruhi oleh spesies tanaman, kesuburan tanah, curah hujan, gangguan kebakaran/hama, serta konsistensi pemeliharaan.';
