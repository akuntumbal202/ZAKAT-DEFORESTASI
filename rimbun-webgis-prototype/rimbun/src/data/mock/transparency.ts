/**
 * MOCK — transparency & realisation figures tied to Loa Kulu seed programs.
 * Simulation only; NOT an official audited financial report.
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
}

export const REPORTS: ReportDoc[] = [
  { id: 'LP-LK-2026-Q4', title: 'Ringkasan penyaluran klaster Loa Kulu', period: 'Okt–Nov 2026', project_id: null, kind: 'Ringkasan' },
  { id: 'LP-LK017-M1', title: 'Monitoring tahun ke-1 · Selatan LK-017', period: 'Okt 2026', project_id: 'LK-017', kind: 'Monitoring' },
  { id: 'LP-LK095-R2', title: 'Realisasi penanaman tahap 1 · Utara LK-095', period: 'Nov 2026', project_id: 'LK-095', kind: 'Realisasi' },
  { id: 'LP-LK124-R1', title: 'Persiapan media tanam & bibit · Blok Tengah LK-124', period: 'Nov 2026', project_id: 'LK-124', kind: 'Realisasi' },
];

export interface FieldDoc {
  id: string;
  project_id: string;
  caption: string;
  date: string;
  image_url: string;
}

export const FIELD_DOCS: FieldDoc[] = [
  { id: 'D1', project_id: 'LK-095', caption: 'Pembibitan pionir lokal di persemaian komunitas', date: '2026-11-10', image_url: '/images/planting-docs.jpg' },
  { id: 'D2', project_id: 'LK-023', caption: 'Penanaman kontur sabuk agroforestri warga', date: '2026-11-06', image_url: '/images/site-agroforestry.jpg' },
  { id: 'D3', project_id: 'LK-124', caption: 'Pemetaan jalur stabilisasi lahan terbuka', date: '2026-10-29', image_url: '/images/site-watershed.jpg' },
  { id: 'D4', project_id: 'LK-151', caption: 'Observasi kelembapan zona organosol timur', date: '2026-10-19', image_url: '/images/site-peatland.jpg' },
];
