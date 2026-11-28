/**
 * MOCK — transparency, realisation, reports, and field documentation entries
 * tied to Loa Kulu seed programs. Simulation only; NOT an official audited report.
 */

export interface ProjectRealisation {
  project_id: string;
  allocated: number;
  spent: number;
  seedlings_planted: number;
  stage: 'Penggalangan' | 'Persiapan' | 'Penanaman' | 'Pemeliharaan' | 'Monitoring';
  last_report: string | null;
}

export const REALISATION: ProjectRealisation[] = [
  { project_id: 'LK-124', allocated: 280_000_000, spent: 195_000_000, seedlings_planted: 4_800, stage: 'Persiapan', last_report: '2026-11-02' },
  { project_id: 'LK-002', allocated: 210_000_000, spent: 142_000_000, seedlings_planted: 3_100, stage: 'Persiapan', last_report: '2026-10-24' },
  { project_id: 'LK-023', allocated: 185_000_000, spent: 138_000_000, seedlings_planted: 4_200, stage: 'Penanaman', last_report: '2026-11-08' },
  { project_id: 'LK-151', allocated: 0, spent: 0, seedlings_planted: 0, stage: 'Penggalangan', last_report: null },
  { project_id: 'LK-095', allocated: 410_000_000, spent: 318_000_000, seedlings_planted: 7_400, stage: 'Penanaman', last_report: '2026-11-12' },
  { project_id: 'LK-017', allocated: 194_400_000, spent: 181_500_000, seedlings_planted: 5_400, stage: 'Monitoring', last_report: '2026-10-15' },
];

export interface ReportDoc {
  id: string;
  title: string;
  period: string;
  project_id: string | null;
  kind: 'Realisasi' | 'Monitoring' | 'Ringkasan';
  summary_note: string;
}

export const REPORTS: ReportDoc[] = [
  {
    id: 'LP-LK-2026-Q4',
    title: 'Ringkasan penyaluran klaster Loa Kulu',
    period: 'Okt–Nov 2026',
    project_id: null,
    kind: 'Ringkasan',
    summary_note:
      'Rekapitulasi progres penggalangan, alokasi, realisasi penggunaan dana, dan dokumentasi kegiatan lapangan pada seluruh program aktif di Kecamatan Loa Kulu.',
  },
  {
    id: 'LP-LK017-M1',
    title: 'Monitoring tahun ke-1 · Selatan LK-017',
    period: 'Okt 2026',
    project_id: 'LK-017',
    kind: 'Monitoring',
    summary_note:
      'Hasil pemantauan pertumbuhan tinggi tanaman muda, evaluasi tingkat kelulushidupan awal, dan penyiangan gulma pada petak percontohan Selatan LK-017.',
  },
  {
    id: 'LP-LK095-R2',
    title: 'Realisasi penanaman tahap 1 · Utara LK-095',
    period: 'Nov 2026',
    project_id: 'LK-095',
    kind: 'Realisasi',
    summary_note:
      'Laporan realisasi pembibitan di persemaian komunitas dan penanaman bertahap 7.400 bibit pionir lokal di blok terbuka Utara LK-095.',
  },
  {
    id: 'LP-LK124-R1',
    title: 'Persiapan media tanam & bibit · Blok Tengah LK-124',
    period: 'Nov 2026',
    project_id: 'LK-124',
    kind: 'Realisasi',
    summary_note:
      'Pelaksanaan pembuatan lubang tanam, pemasangan ajir bambu, dan aplikasi kompos pada tanah Padsolik terbuka sebelum penanaman utama di Blok Tengah LK-124.',
  },
];

export interface FieldDoc {
  id: string;
  project_id: string;
  stage: ProjectRealisation['stage'];
  caption: string;
  location: string;
  date: string;
  image_url: string;
}

export const FIELD_DOCS: FieldDoc[] = [
  {
    id: 'D1',
    project_id: 'LK-095',
    stage: 'Persiapan',
    caption: 'Perawatan bibit pionir lokal di persemaian komunitas',
    location: 'Persemaian Utara · LK-095',
    date: '2026-11-10',
    image_url: '/images/field-nursery.jpg',
  },
  {
    id: 'D2',
    project_id: 'LK-023',
    stage: 'Penanaman',
    caption: 'Penanaman bibit bersama warga mengikuti kontur lereng',
    location: 'Sabuk Agroforestri · LK-023',
    date: '2026-11-06',
    image_url: '/images/field-planting.jpg',
  },
  {
    id: 'D3',
    project_id: 'LK-124',
    stage: 'Persiapan',
    caption: 'Pembuatan lubang tanam, ajir bambu, dan aplikasi kompos',
    location: 'Blok Lahan Terbuka · LK-124',
    date: '2026-10-29',
    image_url: '/images/field-soilprep.jpg',
  },
  {
    id: 'D4',
    project_id: 'LK-017',
    stage: 'Monitoring',
    caption: 'Pengukuran tinggi anakan dan pencatatan pertumbuhan tahun ke-1',
    location: 'Petak Percontohan · LK-017',
    date: '2026-10-15',
    image_url: '/images/field-monitoring.jpg',
  },
  {
    id: 'D5',
    project_id: 'LK-002',
    stage: 'Persiapan',
    caption: 'Seleksi bibit penguat lereng sebelum distribusi ke hulu barat',
    location: 'Lereng Hulu Barat · LK-002',
    date: '2026-10-24',
    image_url: '/images/planting-docs.jpg',
  },
  {
    id: 'D6',
    project_id: 'LK-151',
    stage: 'Penggalangan',
    caption: 'Survei kondisi kelembapan zona organosol sebelum penanaman',
    location: 'Zona Organosol Timur · LK-151',
    date: '2026-10-19',
    image_url: '/images/site-peatland.jpg',
  },
];
