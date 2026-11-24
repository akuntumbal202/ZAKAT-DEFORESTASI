/**
 * Global site configuration — Rimbun Loa Kulu Prototype.
 */
export const SITE = {
  name: 'Rimbun',
  regionFocus: 'Kecamatan Loa Kulu, Kutai Kartanegara',
  tagline: 'Explore Deforestation. Fund Restoration. Measure Environmental Impact.',
  taglineId: 'Jelajahi deforestasi Loa Kulu. Danai restorasi. Ukur dampaknya.',
  partnerLabel: 'Mitra ZISWAF (dalam penjajakan)',
  storageKey: 'rimbun.loakulu.v1',
  phase: 'Prototipe Wilayah Loa Kulu · data spasial aktual & simulasi pendanaan',
} as const;

export const QUICK_AMOUNTS = [25_000, 50_000, 100_000, 250_000] as const;
export const MIN_DONATION = 10_000;
export const PROJECTION_PERIODS = [3, 10, 15] as const;
export type ProjectionPeriod = (typeof PROJECTION_PERIODS)[number];

export const SITE_IMAGES = [
  { url: '/images/site-watershed.jpg', label: 'Lahan terbuka & lereng hulu' },
  { url: '/images/site-corridor.jpg', label: 'Tepian hutan & koridor lereng' },
  { url: '/images/site-agroforestry.jpg', label: 'Agroforestri perbukitan' },
  { url: '/images/site-peatland.jpg', label: 'Lahan basah / aluvial / organosol' },
  { url: '/images/planting-docs.jpg', label: 'Persemaian & pembibitan lokal' },
  { url: '/images/hero-canopy.jpg', label: 'Lanskap kanopi hutan Kalimantan' },
] as const;
