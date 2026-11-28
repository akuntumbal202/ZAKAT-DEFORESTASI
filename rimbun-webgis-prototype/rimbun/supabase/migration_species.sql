-- =============================================================================
-- Rimbun WebGIS — Migrasi Database Spesies Tanaman (public.species)
-- =============================================================================
-- AMAN DIJALANKAN DI DATABASE YANG SUDAH LIVE!
-- Tidak menghapus atau mengubah tabel programs, donations, profiles, dll.
--
-- Cara pakai:
-- 1. Buka Supabase Dashboard -> menu "SQL Editor" -> "New query"
-- 2. Copy-paste SELURUH isi file ini -> klik "Run"
-- 3. Refresh halaman website Rimbun. Tab "Database Spesies" di Admin langsung aktif!
--
-- Catatan:
-- - Kolom Data Inti (NOT NULL): local_name, scientific_name, role, elev_min_m,
--   elev_max_m, slope_max_deg, rain_min_mm, rain_max_mm, soils, kelas_ids.
-- - Kolom Data Turunan / Opsional (boleh NULL tanpa membuat baris jadi 'dummy'):
--   co2_ton_per_ha_yr, density_per_ha, default_survival, default_share, carbon_source.
-- - Kolom verification_status ('valid' | 'dummy'):
--   5 spesies dengan data karbon empiris langsung dari 3 PDF + Racelis (2019)
--   ditandai 'valid'; 11 spesies referensi awal lainnya ditandai 'dummy' agar
--   mudah dibersihkan nanti ketika data final tim tanaman masuk.
-- =============================================================================

create table if not exists public.species (
  id text primary key,
  local_name text not null,
  scientific_name text not null,
  growth_form text not null default 'pohon'
    check (growth_form in ('pohon', 'pohon buah', 'palma', 'bambu')),
  role text not null
    check (role in ('pionir', 'klimaks', 'agroforestri', 'riparian')),
  verification_status text not null default 'valid'
    check (verification_status in ('valid', 'dummy')),

  -- Data Inti Parameter Biofisik (SDSS) — WAJIB
  elev_min_m numeric not null,
  elev_max_m numeric not null,
  slope_max_deg numeric not null,
  rain_min_mm numeric not null,
  rain_max_mm numeric not null,
  soils text[] not null default '{}',
  kelas_ids smallint[] not null default '{1,2}',

  -- Data Turunan / Opsional (boleh NULL — aplikasi pakai fallback ilmiah otomatis)
  co2_ton_per_ha_yr numeric,
  density_per_ha integer,
  default_survival numeric,
  default_share numeric,
  carbon_source text,
  description text not null default '',
  traits text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.species enable row level security;

-- Publik boleh membaca seluruh katalog spesies (untuk peta, detail program, kalkulator)
drop policy if exists "species_select_public" on public.species;
create policy "species_select_public"
  on public.species for select
  using (true);

-- Hanya Admin asli (public.is_admin()) yang boleh menambah, mengubah, atau menghapus spesies
drop policy if exists "species_admin_insert" on public.species;
create policy "species_admin_insert"
  on public.species for insert
  with check (public.is_admin());

drop policy if exists "species_admin_update" on public.species;
create policy "species_admin_update"
  on public.species for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "species_admin_delete" on public.species;
create policy "species_admin_delete"
  on public.species for delete
  using (public.is_admin());

-- =============================================================================
-- Seed Awal 16 Spesies Kalimantan Timur / Loa Kulu (Idempoten)
-- 5 spesies 'valid' (angka karbon langsung dari Fajariani 2020, Sarjono 2017, Racelis 2019)
-- 11 spesies 'dummy' (referensi awal menunggu verifikasi biofisik tim tanaman)
-- =============================================================================
insert into public.species (
  id, local_name, scientific_name, growth_form, role, verification_status,
  elev_min_m, elev_max_m, slope_max_deg, rain_min_mm, rain_max_mm, soils, kelas_ids,
  co2_ton_per_ha_yr, density_per_ha, default_survival, default_share, carbon_source,
  description, traits
) values
-- ── 5 SPESIES VALID (Rujukan empiris karbon langsung) ─────────────────────────
(
  'johar', 'Johar', 'Senna siamea', 'pohon', 'pionir', 'valid',
  0, 800, 25, 1000, 3500, array['Padsolik', 'Latosol', 'Aluvial', 'Litosol'], array[1, 2]::smallint[],
  19.00, 625, 0.78, 0.38,
  'Fajariani et al. (2020) — reklamasi pascatambang PT MHU Loa Kulu, Kukar (18,94–20,38 t CO₂/ha/th umur 6–9 th)',
  'Pohon pionir legum tangguh yang terbukti berhasil pada lahan reklamasi pascatambang batubara di Kecamatan Loa Kulu dengan laju serapan karbon stabil.',
  array['Pionir', 'Tahan pascatambang', 'Validasi Loa Kulu']
),
(
  'trembesi', 'Trembesi', 'Albizia saman', 'pohon', 'pionir', 'valid',
  0, 500, 20, 1500, 3800, array['Padsolik', 'Aluvial', 'Latosol'], array[1, 2]::smallint[],
  23.44, 400, 0.74, 0.30,
  'Fajariani et al. (2020) — reklamasi pascatambang PT MHU Loa Kulu, Kukar (23,44 t CO₂/ha/th tegakan campuran umur 9 th)',
  'Pohon bertajuk lebar pengikat nitrogen untuk menciptakan iklim mikro teduh di lahan terbuka dan bekas tambang Loa Kulu (sin. Samanea saman).',
  array['Tajuk lebar', 'Pengikat nitrogen', 'Validasi Loa Kulu']
),
(
  'jabon', 'Jabon Putih', 'Anthocephalus cadamba', 'pohon', 'riparian', 'valid',
  0, 500, 15, 2000, 4500, array['Aluvial', 'Organosol', 'Padsolik'], array[2]::smallint[],
  18.02, 625, 0.70, 0.36,
  'Sarjono et al. (2017) — Kalimantan Utara, Plot 1 kontrol 4×4 m (16,07–18,02 t CO₂/ha/th; survival 70,4% umur 10 th)',
  'Pohon lokal Kalimantan cepat tumbuh untuk dataran rendah lembap dan zona organosol/aluvial; sensitif kekeringan sehingga tidak disarankan untuk lahan kritis kering (sin. Neolamarckia cadamba).',
  array['Lokal Kalimantan', 'Toleran lahan lembap', 'Cepat tumbuh']
),
(
  'akasia', 'Akasia', 'Acacia mangium', 'pohon', 'pionir', 'valid',
  0, 600, 28, 1500, 4000, array['Padsolik', 'Latosol', 'Litosol'], array[1, 2]::smallint[],
  45.83, 1111, 0.80, 0.34,
  'Racelis et al. (2019) — batas atas pionir cepat tumbuh Indonesia (12,50 Mg C/ha/th ≈ 45,83 t CO₂/ha/th); Fajariani et al. (2020) PT MHU Loa Kulu',
  'Pionir pengikat nitrogen sangat cepat tumbuh pada tanah masam terbuka pascatambang; direkomendasikan sebagai penaung fase awal yang dikendalikan dan diperkaya spesies lokal.',
  array['Pionir sangat cepat', 'Pengikat nitrogen', 'Tahan tanah masam']
),
(
  'meranti-merah', 'Meranti Merah', 'Shorea leprosula', 'pohon', 'klimaks', 'valid',
  0, 700, 30, 2200, 4500, array['Padsolik', 'Latosol'], array[2]::smallint[],
  10.60, 400, 0.65, 0.32,
  'Racelis et al. (2019) — kelompok Dipterocarpaceae Indonesia (2,89 Mg C/ha/th ≈ 10,60 t CO₂/ha/th); Pratiwi et al. (2021)',
  'Tegakan utama Dipterocarpaceae asli Kalimantan yang ditanam sebagai pengayaan kanopi tinggi setelah penaung pionir tersedia.',
  array['Dipterocarpaceae asli', 'Butuh naungan awal', 'Kanopi utama']
),

-- ── 11 SPESIES DUMMY (Parameter awal menunggu verifikasi tim tanaman) ──────────
(
  'sengon', 'Sengon', 'Falcataria moluccana', 'pohon', 'pionir', 'dummy',
  0, 800, 25, 1800, 4200, array['Padsolik', 'Latosol', 'Aluvial'], array[1, 2]::smallint[],
  null, 625, 0.78, 0.40,
  'Fallback rata-rata Racelis et al. (2019); kandidat pionir Proposal 2.1.4 & PT MHU Loa Kulu (Fajariani et al., 2020)',
  'Polong-polongan cepat tumbuh pengikat nitrogen yang umum dipakai sebagai tanaman pionir pembentuk naungan awal (sin. Falcataria falcata).',
  array['Pionir', 'Pengikat nitrogen', 'Cepat tumbuh']
),
(
  'sungkai', 'Sungkai', 'Peronema canescens', 'pohon', 'pionir', 'dummy',
  0, 600, 28, 2000, 4200, array['Padsolik', 'Latosol', 'Litosol', 'Organosol'], array[1, 2]::smallint[],
  null, 625, 0.82, 0.36,
  'Fallback rata-rata Racelis et al. (2019); kandidat pionir Proposal 2.1.4 & PT MHU Loa Kulu (Fajariani et al., 2020)',
  'Spesies asli Kalimantan yang tangguh pada lahan terbuka, semak belukar, maupun tanah masam bekas pembukaan.',
  array['Spesies Kalimantan', 'Tahan paparan terbuka', 'Pionir']
),
(
  'ulin', 'Ulin / Kayu Besi', 'Eusideroxylon zwageri', 'pohon', 'klimaks', 'dummy',
  0, 500, 25, 2200, 4500, array['Padsolik', 'Latosol', 'Aluvial'], array[2]::smallint[],
  null, 400, 0.58, 0.22,
  'Fallback kelompok lokal/konservasi Racelis et al. (2019); kandidat konservasi Pratiwi et al. (2021)',
  'Pohon konservasi endemik Kalimantan berumur panjang dan berkayu sangat kuat, cocok untuk pengayaan inti blok.',
  array['Endemik Kalimantan', 'Konservasi tinggi', 'Tumbuh lambat']
),
(
  'gaharu', 'Gaharu', 'Aquilaria malaccensis', 'pohon', 'klimaks', 'dummy',
  15, 750, 26, 2000, 4200, array['Padsolik', 'Latosol'], array[1, 2]::smallint[],
  null, 400, 0.68, 0.25,
  'Fallback kelompok lokal/konservasi Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
  'Pohon hutan penghasil resin bernilai tinggi yang sesuai dipadukan dalam pengayaan bertahap dengan naungan sedang.',
  array['Bernilai ekonomi', 'Pengayaan tajuk', 'Diatur CITES']
),
(
  'durian', 'Durian / Lai Lokal', 'Durio zibethinus', 'pohon buah', 'agroforestri', 'dummy',
  10, 700, 20, 2000, 3800, array['Padsolik', 'Latosol', 'Aluvial'], array[2]::smallint[],
  null, 250, 0.76, 0.30,
  'Fallback rata-rata Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
  'Tanaman agroforestri bernilai ekonomi jangka panjang agar masyarakat sekitar ikut merawat tegakan restorasi.',
  array['MPTS / Agroforestri', 'Ekonomi masyarakat', 'Tajuk sedang']
),
(
  'petai', 'Petai', 'Parkia speciosa', 'pohon buah', 'agroforestri', 'dummy',
  10, 900, 22, 2000, 4000, array['Padsolik', 'Latosol'], array[2]::smallint[],
  null, 250, 0.78, 0.30,
  'Fallback rata-rata Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
  'Polong-polongan agroforestri yang membantu fiksasi nitrogen tanah dan memberi hasil panen berkelanjutan.',
  array['MPTS / Agroforestri', 'Pengikat nitrogen', 'Ekonomi warga']
),
(
  'aren', 'Aren Konservasi', 'Arenga pinnata', 'palma', 'agroforestri', 'dummy',
  20, 1100, 35, 2000, 4500, array['Padsolik', 'Latosol', 'Litosol'], array[1, 2]::smallint[],
  null, 400, 0.80, 0.32,
  'Fallback rata-rata Racelis et al. (2019); menunggu kurasi biofisik tim tanaman',
  'Palma berakar serabut rapat dan dalam yang efektif menahan erosi pada lereng curam sekaligus memberi nilai nira.',
  array['Penahan erosi', 'Lahan berlereng', 'Ekonomi lestari']
),
(
  'mahang', 'Mahang', 'Macaranga gigantea', 'pohon', 'pionir', 'dummy',
  0, 700, 28, 2000, 4500, array['Padsolik', 'Latosol', 'Aluvial'], array[1, 2]::smallint[],
  null, 625, 0.82, 0.32,
  'Pionir regenerasi alami PT MHU Loa Kulu (Fajariani et al., 2020) & Purnomo et al. (2022); fallback karbon Racelis (2019)',
  'Pionir asli hutan sekunder Kalimantan berdaun lebar yang cepat menutup bukaan lahan dan melindungi permukaan tanah dari erosi hujan.',
  array['Pionir lokal', 'Regenerasi alami', 'Penutup tanah cepat']
),
(
  'laban', 'Laban / Halaban', 'Vitex pinnata', 'pohon', 'pionir', 'dummy',
  0, 800, 30, 1800, 4200, array['Padsolik', 'Latosol', 'Litosol'], array[1, 2]::smallint[],
  null, 625, 0.80, 0.32,
  'Tercatat dalam revegetasi PT MHU Loa Kulu (Fajariani et al., 2020); fallback karbon Racelis et al. (2019)',
  'Spesies pionir asli tahan api ringan dan tanah terdegradasi yang sering tumbuh dominan pada tahap pemulihan awal Kalimantan Timur.',
  array['Pionir lokal', 'Tahan tanah miskin', 'Adaptif pascatambang']
),
(
  'cempedak', 'Cempedak / Nangka', 'Artocarpus integer', 'pohon buah', 'agroforestri', 'dummy',
  0, 700, 20, 2000, 4000, array['Padsolik', 'Latosol', 'Aluvial'], array[2]::smallint[],
  null, 250, 0.76, 0.28,
  'Kandidat MPTS Kalimantan Timur (Pratiwi et al., 2021 / Proposal 2.1.4); fallback karbon Racelis et al. (2019)',
  'Spesies buah serbaguna (MPTS) asli kawasan Malesia yang mendukung ketahanan pangan dan ekonomi warga sekitar blok rehabilitasi.',
  array['MPTS / Agroforestri', 'Buah lokal', 'Ekonomi warga']
),
(
  'mangga-kalimantan', 'Kasturi / Mangga Lokal', 'Mangifera casturi', 'pohon buah', 'agroforestri', 'dummy',
  0, 500, 18, 2000, 3800, array['Padsolik', 'Latosol', 'Aluvial'], array[2]::smallint[],
  null, 250, 0.75, 0.28,
  'Kandidat MPTS Kalimantan (Pratiwi et al., 2021 / Proposal 2.1.4); fallback karbon Racelis et al. (2019)',
  'Spesies mangga lokal/endemik Kalimantan bernilai konservasi dan ekonomi buah untuk pengayaan agroforestri.',
  array['MPTS / Agroforestri', 'Endemik Kalimantan', 'Konservasi buah']
)
on conflict (id) do nothing;

-- Opsional: perintah cepat untuk membersihkan seluruh spesies 'dummy' nanti jika sudah tidak dipakai program:
-- delete from public.species where verification_status = 'dummy';
