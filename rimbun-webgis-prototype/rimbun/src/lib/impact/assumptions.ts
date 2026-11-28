/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IMPACT MODEL ASSUMPTIONS, SCIENTIFIC PARAMETERS & LITERATURE REFERENCES
 * ─────────────────────────────────────────────────────────────────────────────
 *  Seluruh parameter default diturunkan langsung dari literatur reboisasi
 *  Indonesia & Kalimantan (Racelis et al., 2019; Fajariani et al., 2020;
 *  Sarjono et al., 2017) serta stoikiometri fotosintesis (Nowak et al., 2007;
 *  Khodakarami et al., 2022). Bila program memiliki komposisi spesies di
 *  database `public.species`, laju serapan otomatis dihitung sebagai rata-rata
 *  tertimbang komposisi spesies tersebut.
 */
const FALLBACK_CO2_TON_PER_HA_YR = 18.55; // 5,06 Mg C/ha/th × (44/12), Racelis et al. (2019)
const FALLBACK_DENSITY_PER_HA = 625; // jarak tanam 4×4 m (Sarjono et al., 2017)
const DEFAULT_SURVIVAL_RATE = 0.7; // ~70,4% survival umur 10 th (Sarjono et al., 2017)

export const IMPACT_ASSUMPTIONS = {
  /** Rujukan rata-rata laju serapan reboisasi Indonesia (5,06 Mg C/ha/th ≈ 18,55 t CO₂/ha/th, Racelis et al., 2019). */
  fallbackCo2TonPerHaPerYear: FALLBACK_CO2_TON_PER_HA_YR,
  /** Rujukan batas bawah kelompok Dipterocarpaceae (2,89 Mg C/ha/th ≈ 10,60 t CO₂/ha/th, Racelis et al., 2019). */
  dipterocarpCo2TonPerHaPerYear: 10.6,
  /** Kerapatan tanam rujukan awal saat mode umum (bibit/ha, jarak tanam 4×4 m). */
  fallbackDensityPerHa: FALLBACK_DENSITY_PER_HA,
  /**
   * Laju serapan puncak per pohon HIDUP pada mode umum (kg CO₂/pohon hidup/tahun):
   *   18.550 kg/ha/th ÷ (625 bibit/ha × 0,70 survival) ≈ 42,40 kg CO₂/pohon hidup/tahun.
   * Dengan kurva sigmoidal 10 tahun (∑f(t) = 5,0), 1 ha tegakan mengakumulasi ±92,75 t CO₂/ha
   * (tetap konservatif dibanding data lapangan 9–10 th: 160,7–183,4 t CO₂/ha).
   */
  co2KgPerTreePerYearAtPlateau:
    (FALLBACK_CO2_TON_PER_HA_YR * 1000) / (FALLBACK_DENSITY_PER_HA * DEFAULT_SURVIVAL_RATE),
  /** Titik tengah (inflection point) kurva logistik sigmoidal (tahun ke-5,5). */
  sigmoidMidpointYear: 5.5,
  /** Laju kecuraman transisi kurva sigmoidal (k = 0,65). */
  sigmoidSteepness: 0.65,
  /** Asumsi tingkat keberhasilan hidup bawaan bila program belum memiliki nilai spesifik. */
  defaultSurvivalRate: DEFAULT_SURVIVAL_RATE,
  /** Rasio massa Karbon biomassa (C) terhadap CO₂ terserap (12 / 44 ≈ 0,2727). */
  carbonPerCo2MassRatio: 12 / 44,
  /**
   * Rasio massa O₂ dilepas terhadap CO₂ diserap pada fotosintesis bersih
   * (32 g O₂ per 44 g CO₂ ≈ 0,7273; setara O₂ = C × 32/12 ≈ C × 2,67).
   */
  o2PerCo2MassRatio: 32 / 44,
  /** Biaya estimasi per bibit (all-in) saat tidak memilih program tertentu (IDR). */
  fallbackCostPerSeedling: 34_000,
  version: 'sigmoidal-sdss-0.3',
} as const;

export const GIS_METHOD_STEPS = [
  'Deteksi deforestasi (2020–2025): membandingkan tutupan lahan Dynamic World V1 (resolusi 10 m) dari kelas tutupan pohon tahun 2020 yang berubah menjadi non-pohon pada tahun 2025 di Kecamatan Loa Kulu, lalu disaring untuk hamparan ≥ 5 ha sehingga diperoleh 163 poligon (total 5.783,7 ha).',
  'Klasifikasi tutupan lahan pasca-deforestasi: poligon dibagi menjadi Kelas 1 (lahan terbuka / indikasi pascatambang, 21 poligon) dan Kelas 2 (semak belukar / kebun terbuka, 142 poligon).',
  'Ekstraksi topografi (FABDEM 30 m): statistik zonal menghitung elevasi median & rentang elevasi (m), serta kelerengan median, standar deviasi, dan persentil ke-90 (derajat) dengan penanda topografi heterogen (σ ≥ 8,0°).',
  'Ekstraksi curah hujan (ERA5-Land ~0,1°): rata-rata curah hujan tahunan (mm/tahun) diambil dari data resolusi asli tanpa penghalusan, dengan fallback titik representatif (representative point) untuk poligon kecil agar tidak ada nilai kosong.',
  'Analisis jenis tanah dominan: layer poligon deforestasi dan peta jenis tanah diproyeksikan ke sistem Equal-Area (EPSG:6933) lalu di-overlay dengan metode irisan terluas (largest overlap) untuk memperoleh kelas tanah dominan, persentase cakupan, dan jumlah kelas tanah.',
  'Sistem Rekomendasi Tanaman (SDSS): setiap spesies pada database dibandingkan terhadap 5 parameter biofisik poligon (elevasi, kelerengan, curah hujan, jenis tanah, dan tutupan lahan) untuk menyusun peringkat kesesuaian (0–100%) serta menentukan kerapatan tanam dan estimasi biaya 6 komponen.',
];

export const METHOD_NOTES = [
  'Dana → bibit: nominal donasi dibagi biaya total per bibit pada program terpilih (mencakup pembibitan, persiapan lahan/ameliorasi, penanaman, pemeliharaan 3 tahun, monitoring, dan operasional ZISWAF).',
  'Bibit → pohon hidup: jumlah bibit dikalikan asumsi tingkat kelangsungan hidup (survival rate) rata-rata tertimbang spesies program (rujukan bawaan 70% sesuai studi tegakan Kalimantan Sarjono et al., 2017).',
  'Pohon hidup → laju serapan berbasis spesies (kurva sigmoidal): laju serapan rujukan tiap spesies dalam ton CO₂/ha/tahun (Fajariani et al., 2020 di Loa Kulu; Sarjono et al., 2017 di Kaltara; Racelis et al., 2019 untuk Indonesia) dikonversi ke per pohon hidup berdasarkan kerapatan tanam & survival standar, lalu dikalikan fungsi logistik f(t) = 1 / (1 + e^(−0,65 × (t − 5,5))) untuk merepresentasikan fase adaptasi (tahun 1–3), pertumbuhan tajuk (tahun 4–9), dan fase dewasa (tahun 10–15).',
  'CO₂ → simpanan Karbon (C) & produksi Oksigen (O₂): mengikuti stoikiometri fotosintesis (Nowak et al., 2007; Khodakarami et al., 2022) dengan C = CO₂ × (12/44) dan O₂ = CO₂ × (32/44) ≈ CO₂ × 0,727 (setara O₂ = C × 2,67).',
];

export interface LiteratureRef {
  citation: string;
  scope: string;
}

export const LITERATURE_REFERENCES: LiteratureRef[] = [
  {
    citation: 'Racelis, D. A., et al. (2019)',
    scope:
      'Sintesis laju serapan karbon reboisasi Indonesia: rata-rata 5,06 Mg C/ha/th (≈ 18,55 t CO₂/ha/th), rentang 2,89 Mg C/ha/th (Dipterocarpaceae ≈ 10,60 t CO₂/ha/th) hingga 12,50 Mg C/ha/th (Acacia spp. ≈ 45,83 t CO₂/ha/th).',
  },
  {
    citation: 'Fajariani, S., Hendra, M., & Susanto, D. (2020) — JTBB 5(2): 115–123',
    scope:
      'Pengukuran langsung serapan karbon pascatambang batubara di PT Multi Harapan Utama, Kecamatan Loa Kulu, Kutai Kartanegara: Senna siamea (Johar) 18,94–20,38 t CO₂/ha/th (umur 6–9 th) dan Albizia saman (Trembesi) 23,44 t CO₂/ha/th (tegakan campuran umur 9 th).',
  },
  {
    citation: 'Sarjono, A., Lahjie, A. M., Simarangkir, B. D. A. S., Kristiningrum, R., & Ruslim, Y. (2017) — Biodiversitas 18(4): 1385–1393',
    scope:
      'Dinamika pertumbuhan non-linear, kelulushidupan (~70,4% pada umur 10 th, jarak 4×4 m = 625 bibit/ha), dan serapan karbon Anthocephalus cadamba (Jabon putih) di Kalimantan Utara (Plot kontrol: 16,07–18,02 t CO₂/ha/th).',
  },
  {
    citation: 'Nowak, D. J., Hoehn, R., & Crane, D. E. (2007); Khodakarami, L., et al. (2022)',
    scope:
      'Konversi stoikiometris antara penyimpanan karbon biomassa (C), penyerapan karbondioksida (CO₂), dan pelepasan oksigen bersih (O₂/CO₂ = 32/44 ≈ 0,727; O₂ = C × 2,67).',
  },
  {
    citation: 'Vacik, H., & Lexer, M. J. (2001); Iskandar et al. (2022); Pratiwi et al. (2021)',
    scope:
      'Kerangka Spatial Decision Support System (SDSS) untuk pemeringkatan kesesuaian spesies dan strategi revegetasi bertahap (pionir → spesies lokal & MPTS) pada lahan terdegradasi/pascatambang Kalimantan Timur.',
  },
];

export const UNCERTAINTY_NOTE =
  'Seluruh angka simpanan karbon (C), serapan CO₂, dan produksi O₂ merupakan proyeksi matematis berbasis literatur (bukan hasil pengukuran biomassa lapangan langsung pada blok). Realisasi lapangan dipengaruhi komposisi spesies akhir, kualitas tanah, iklim mikro, gangguan kebakaran/hama, serta konsistensi pemeliharaan.';
