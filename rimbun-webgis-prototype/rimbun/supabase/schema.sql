-- =============================================================================
-- Rimbun WebGIS — Kecamatan Loa Kulu (Supabase Core Backend Schema + RLS + Seed)
-- =============================================================================
-- Cara pakai:
-- 1. Buka dashboard Supabase -> menu "SQL Editor" -> "New query"
-- 2. Copy-paste SELURUH isi file ini -> klik "Run"
-- 3. Aktifkan "Allow anonymous sign-ins" di Authentication -> Providers -> Auth Settings
--    agar masyarakat tanpa login tetap bisa menekan "Usulkan Program" (1 suara/sesi).
-- 4. Setelah Anda mendaftar akun pribadi di website, jalankan 1 baris di paling bawah
--    file ini untuk menaikkan akun Anda menjadi Admin asli.
-- =============================================================================

-- 1. Profiles (Role Donor / Admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Donatur Rimbun',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  role text not null default 'donor' check (role in ('donor', 'admin')),
  joined_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper aman (security definer) untuk cek role admin di seluruh policy RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Trigger otomatis membuat baris profile (role='donor') saat pengguna baru mendaftar (non-anonim)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into public.profiles (id, name, email, role)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(coalesce(new.email, 'donatur'), '@', 1)),
      coalesce(new.email, ''),
      'donor'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own_no_role_escalation" on public.profiles;
create policy "profiles_update_own_no_role_escalation"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 2. Programs (Kurasi Poligon Loa Kulu: Published & Draft)
create table if not exists public.programs (
  id text primary key,
  polygon_code text not null unique,
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  name text not null,
  short_name text not null,
  summary text not null default '',
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'urgent', 'funded', 'planting', 'monitoring')),
  category text not null default 'hutan-lahan-kering' check (category in ('pascatambang', 'hutan-lahan-kering', 'agroforestri', 'riparian')),
  condition_summary text not null default '',
  rehab_needs text not null default '',
  recommended_species jsonb not null default '[]'::jsonb,
  cost_breakdown jsonb not null default '[]'::jsonb,
  funding_target bigint not null default 0,
  funding_collected_base bigint not null default 0,
  donor_count_base integer not null default 0,
  started_at text not null default to_char(now(), 'YYYY-MM-DD'),
  updated_at text,
  updates jsonb not null default '[]'::jsonb,
  visual_seed integer not null default 1,
  image_url text not null default '/images/site-watershed.jpg',
  tags text[] not null default '{}'
);

alter table public.programs enable row level security;

drop policy if exists "programs_select_published_or_admin" on public.programs;
create policy "programs_select_published_or_admin"
  on public.programs for select
  using (publication_status = 'published' or public.is_admin());

drop policy if exists "programs_admin_insert" on public.programs;
create policy "programs_admin_insert"
  on public.programs for insert
  with check (public.is_admin());

drop policy if exists "programs_admin_update" on public.programs;
create policy "programs_admin_update"
  on public.programs for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "programs_admin_delete" on public.programs;
create policy "programs_admin_delete"
  on public.programs for delete
  using (public.is_admin());

-- 3. Nominations ("Usulkan Jadi Program" — mendukung Anonymous Auth & Donatur)
create table if not exists public.nominations (
  polygon_code text not null,
  voter_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (polygon_code, voter_id)
);

alter table public.nominations enable row level security;

-- Hanya pemilih bersangkutan (atau admin) yang melihat baris mentahnya
drop policy if exists "nominations_select_own_or_admin" on public.nominations;
create policy "nominations_select_own_or_admin"
  on public.nominations for select
  using (auth.uid() = voter_id or public.is_admin());

drop policy if exists "nominations_insert_self" on public.nominations;
create policy "nominations_insert_self"
  on public.nominations for insert
  with check (auth.uid() is not null and voter_id = auth.uid());

drop policy if exists "nominations_delete_self" on public.nominations;
create policy "nominations_delete_self"
  on public.nominations for delete
  using (auth.uid() is not null and voter_id = auth.uid());

-- Agregat jumlah usulan publik tanpa membocorkan voter_id
create or replace function public.get_nomination_counts()
returns table (polygon_code text, votes integer)
language sql
stable
security definer
set search_path = public
as $$
  select polygon_code, count(*)::integer as votes
  from public.nominations
  group by polygon_code;
$$;

grant execute on function public.get_nomination_counts() to anon, authenticated;

-- 4. Donations (Simulasi donasi tersinkron untuk Donatur terdaftar)
create table if not exists public.donations (
  id text primary key,
  project_id text not null references public.programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount >= 10000),
  display_name text not null,
  anonymous boolean not null default false,
  message text not null default '',
  payment_method text not null check (payment_method in ('qris', 'va-bank', 'ewallet', 'card')),
  status text not null default 'simulasi-berhasil',
  created_at timestamptz not null default now()
);

alter table public.donations enable row level security;

drop policy if exists "donations_select_public" on public.donations;
create policy "donations_select_public"
  on public.donations for select
  using (true);

drop policy if exists "donations_insert_real_user" on public.donations;
create policy "donations_insert_real_user"
  on public.donations for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );

-- 5. Saved Projects (Bookmark program per akun Donatur)
create table if not exists public.saved_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references public.programs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.saved_projects enable row level security;

drop policy if exists "saved_select_own" on public.saved_projects;
create policy "saved_select_own"
  on public.saved_projects for select
  using (auth.uid() = user_id);

drop policy if exists "saved_insert_own" on public.saved_projects;
create policy "saved_insert_own"
  on public.saved_projects for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );

drop policy if exists "saved_delete_own" on public.saved_projects;
create policy "saved_delete_own"
  on public.saved_projects for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- Seed Awal: 6 Program Published + 1 Draft Kecamatan Loa Kulu
-- (Idempoten: aman dijalankan ulang tanpa menimpa editan Admin)
-- =============================================================================
insert into public.programs (
  id, polygon_code, publication_status, name, short_name, summary, description,
  status, category, condition_summary, rehab_needs, recommended_species, cost_breakdown,
  funding_target, funding_collected_base, donor_count_base, started_at, image_url, visual_seed, tags
) values
(
  'LK-124', 'LK-124', 'published',
  'Rehabilitasi Lahan Terbuka Blok Tengah Loa Kulu',
  'Blok Tengah LK-124',
  'Lahan terbuka/pascatambang seluas 132,93 ha di Loa Kulu yang membutuhkan perbaikan media tanam dan penutupan tajuk pionir.',
  'Poligon LK-124 merupakan salah satu hamparan lahan terbuka terbesar (132,93 ha) hasil analisis transisi Dynamic World 2020–2025 di Loa Kulu. Elevasi median 23,5 m dengan tanah Padsolik Merah Kuning dan curah hujan ~2.960 mm/tahun. Program tahap awal difokuskan pada stabilisasi tanah pucuk dan penanaman 30.000 bibit pionir serta spesies lokal tahan paparan.',
  'urgent', 'pascatambang',
  'Tutupan lahan terbuka (Kelas 1) dengan paparan panas tinggi dan kehilangan lapisan humus alami.',
  'Aplikasi kompos/amelioran tanah, penanaman pionir pengikat nitrogen, serta pemeliharaan 36 bulan.',
  '[{"species_id":"sengon","seedlings":13000,"suitability_reason":"Placeholder: pionir cepat tumbuh pengikat nitrogen untuk membentuk naungan mikro awal.","survival_estimate":0.78},{"species_id":"sungkai","seedlings":10500,"suitability_reason":"Placeholder: spesies asli Kalimantan yang tangguh pada tanah Padsolik terbuka.","survival_estimate":0.82},{"species_id":"trembesi","seedlings":6500,"suitability_reason":"Placeholder: tajuk lebar untuk menurunkan suhu permukaan tanah terbuka.","survival_estimate":0.74}]'::jsonb,
  '[{"label":"Pengadaan bibit pionir & lokal","amount":316800000,"note":"30.000 bibit"},{"label":"Perbaikan media tanam, kompos & kapur","amount":264000000,"note":"Ameliorasi tanah terdegradasi"},{"label":"Penanaman (tenaga kerja lokal)","amount":211200000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":264000000},{"label":"Monitoring pertumbuhan & pelaporan","amount":132000000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":132000000}]'::jsonb,
  1320000000, 462000000, 518, '2026-08-12', '/images/site-watershed.jpg', 124,
  array['Loa Kulu', 'Lahan Terbuka', 'Prioritas Tinggi']
),
(
  'LK-002', 'LK-002', 'published',
  'Penghijauan Lereng Hulu Barat Loa Kulu',
  'Lereng Barat LK-002',
  'Zona perbukitan miring 13,3° seluas 32,99 ha di elevasi 278,8 m yang rawan erosi limpasan hujan.',
  'Poligon LK-002 terletak di sisi barat Kecamatan Loa Kulu pada elevasi median 278,8 m (rentang elevasi 83,9 m) dengan kelerengan median 13,3° (P90 mencapai 22,0°). Program dirancang menggabungkan pohon penguat lereng berakar dalam dan pengayaan dipterokarpa untuk menjaga stabilitas lereng tangkapan air.',
  'urgent', 'hutan-lahan-kering',
  'Hutan beralih menjadi semak belukar pada lereng agak curam (13,3°) dengan curah hujan 2.819 mm/th.',
  'Penanaman mengikuti garis kontur dengan aren konservasi, sungkai, dan meranti merah.',
  '[{"species_id":"sungkai","seedlings":5200,"suitability_reason":"Placeholder: pionir lokal Kalimantan untuk menutup semak terbuka pada lereng.","survival_estimate":0.82},{"species_id":"aren","seedlings":4400,"suitability_reason":"Placeholder: perakaran serabut rapat efektif menahan erosi lereng 13,3°.","survival_estimate":0.8},{"species_id":"meranti-merah","seedlings":3600,"suitability_reason":"Placeholder: pengayaan tegakan hutan hujan pada tanah Komplek Padsolik-Latosol.","survival_estimate":0.65}]'::jsonb,
  '[{"label":"Pengadaan & pembibitan unggul","amount":133056000,"note":"13.200 bibit"},{"label":"Persiapan jalur tanam & ajir","amount":57024000},{"label":"Penanaman bersama warga lokal","amount":85536000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":104544000},{"label":"Monitoring & pelaporan publik","amount":47520000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":47520000}]'::jsonb,
  475200000, 312000000, 384, '2026-07-05', '/images/site-corridor.jpg', 2,
  array['Loa Kulu', 'Lereng Curam', 'Konservasi Tanah']
),
(
  'LK-023', 'LK-023', 'published',
  'Sabuk Agroforestri Masyarakat Loa Kulu',
  'Agroforestri LK-023',
  'Pemulihan 27,00 ha lahan semak/kebun terbuka dengan perpaduan pohon kayu dan buah bernilai ekonomi warga.',
  'Poligon LK-023 berada di elevasi median 48,6 m dengan kemiringan sedang (7,3°) dan tanah Komplek Padsolik Merah Kuning, Latosol & Litosol. Pendekatan agroforestri dipilih agar masyarakat lokal memiliki insentif ekonomi berkelanjutan untuk merawat pohon hingga dewasa.',
  'open', 'agroforestri',
  'Didominasi semak belukar dan lahan garapan terbuka (Kelas 2) dengan potensi erosi ringan-sedang.',
  'Pembersihan jalur tanam selektif dan penanaman 10.800 bibit pola tumpangsari lestari.',
  '[{"species_id":"sengon","seedlings":4200,"suitability_reason":"Placeholder: penaung cepat tumbuh dan penyubur nitrogen tanah.","survival_estimate":0.78},{"species_id":"durian","seedlings":3400,"suitability_reason":"Placeholder: hasil panen bernilai tinggi untuk menjaga keberlanjutan rawat petani.","survival_estimate":0.76},{"species_id":"petai","seedlings":3200,"suitability_reason":"Placeholder: legum agroforestri yang adaptif di perbukitan rendah Loa Kulu.","survival_estimate":0.78}]'::jsonb,
  '[{"label":"Pengadaan & pembibitan unggul","amount":93744000,"note":"10.800 bibit"},{"label":"Persiapan jalur tanam & ajir","amount":40176000},{"label":"Penanaman bersama warga lokal","amount":60264000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":73656000},{"label":"Monitoring & pelaporan publik","amount":33480000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":33480000}]'::jsonb,
  334800000, 268400000, 412, '2026-06-18', '/images/site-agroforestry.jpg', 23,
  array['Loa Kulu', 'Agroforestri', 'Pemberdayaan Warga']
),
(
  'LK-151', 'LK-151', 'published',
  'Restorasi Lahan Basah Organosol Timur Loa Kulu',
  'Organosol LK-151',
  'Pemulihan 15,38 ha zona datar lembap bertanah Organosol Glei Humus dekat jalur aliran timur Loa Kulu.',
  'Poligon LK-151 berada pada dataran rendah (elevasi median 10,1 m, lereng 0,7°) dengan dominasi tanah Organosol Glei Humus dan curah hujan tinggi 3.060 mm/tahun. Pemulihan vegetasi difokuskan pada spesies toleran kelembapan tinggi untuk menjaga tata air dan mencegah kekeringan musiman.',
  'open', 'riparian',
  'Zona semak basah terbuka pada tanah organosol datar yang membutuhkan tegakan adaptif lembap.',
  'Penanaman 6.200 bibit adaptif lahan basah dengan pola gundukan ringan di titik tergenang.',
  '[{"species_id":"jabon","seedlings":2800,"suitability_reason":"Placeholder: pionir toleran tanah lembap dan fluktuasi muka air.","survival_estimate":0.8},{"species_id":"sungkai","seedlings":2200,"suitability_reason":"Placeholder: adaptif pada tanah masam Kalimantan dan cepat menutup lahan terbuka.","survival_estimate":0.82},{"species_id":"ulin","seedlings":1200,"suitability_reason":"Placeholder: pengayaan spesies konservasi jangka panjang Kalimantan.","survival_estimate":0.58}]'::jsonb,
  '[{"label":"Pengadaan & pembibitan unggul","amount":59024000,"note":"6.200 bibit"},{"label":"Persiapan jalur tanam & ajir","amount":25296000},{"label":"Penanaman bersama warga lokal","amount":37944000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":46376000},{"label":"Monitoring & pelaporan publik","amount":21080000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":21080000}]'::jsonb,
  210800000, 92500000, 146, '2026-09-22', '/images/site-peatland.jpg', 151,
  array['Loa Kulu', 'Organosol', 'Tata Air']
),
(
  'LK-095', 'LK-095', 'published',
  'Pemulihan Lahan Terbuka Utara Loa Kulu',
  'Utara LK-095',
  'Blok lahan terbuka 26,82 ha di sisi utara Loa Kulu yang telah terdanai penuh dan memasuki tahap penanaman.',
  'Poligon LK-095 (26,82 ha, elevasi 67,6 m, lereng landai 4,6°) adalah program percontohan fase awal di utara Loa Kulu. Target pendanaan tahap pertama telah terpenuhi sehingga saat ini berfokus pada persiapan jalur tanam, aplikasi kompos, dan penanaman bertahap.',
  'planting', 'pascatambang',
  'Lahan terbuka Kelas 1 dengan tanah Padsolik Merah Kuning dan lereng bergelombang ringan.',
  'Penanaman 10.700 bibit pionir dan pengayaan gaharu setelah naungan terbentuk.',
  '[{"species_id":"sengon","seedlings":4800,"suitability_reason":"Placeholder: penutup tajuk cepat sekaligus penyubur tanah terpapar.","survival_estimate":0.78},{"species_id":"sungkai","seedlings":3700,"suitability_reason":"Placeholder: spesies tangguh Kalimantan untuk lahan terbuka.","survival_estimate":0.82},{"species_id":"gaharu","seedlings":2200,"suitability_reason":"Placeholder: tanaman bernilai ekonomi jangka panjang.","survival_estimate":0.68}]'::jsonb,
  '[{"label":"Pengadaan bibit pionir & lokal","amount":112992000,"note":"10.700 bibit"},{"label":"Perbaikan media tanam, kompos & kapur","amount":94160000,"note":"Ameliorasi tanah terdegradasi"},{"label":"Penanaman (tenaga kerja lokal)","amount":75328000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":94160000},{"label":"Monitoring pertumbuhan & pelaporan","amount":47080000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":47080000}]'::jsonb,
  470800000, 470800000, 615, '2026-03-10', '/images/planting-docs.jpg', 95,
  array['Loa Kulu', 'Penanaman Aktif', 'Lahan Terbuka']
),
(
  'LK-017', 'LK-017', 'published',
  'Monitoring Koridor Hijau Selatan Loa Kulu',
  'Selatan LK-017',
  'Blok percontohan 13,41 ha yang telah menyelesaikan penanaman awal dan kini berada pada tahap pemeliharaan.',
  'Poligon LK-017 (13,41 ha, elevasi 69,2 m, lereng 7,3°) menjadi blok percontohan pemantauan pasca-tanam untuk memverifikasi kelulushidupan bibit serta transparansi penyaluran dana dari target hingga realisasi.',
  'monitoring', 'hutan-lahan-kering',
  'Bibit tahap awal telah tertanam pada eks semak terbuka dan rutin disulam.',
  'Penyiangan gulma, pemupukan susulan, dan pengukuran pertumbuhan berkala.',
  '[{"species_id":"sungkai","seedlings":2400,"suitability_reason":"Placeholder: pionir lokal pengisi lapisan tajuk awal.","survival_estimate":0.82},{"species_id":"meranti-merah","seedlings":1800,"suitability_reason":"Placeholder: pengayaan spesies utama Kalimantan.","survival_estimate":0.65},{"species_id":"aren","seedlings":1200,"suitability_reason":"Placeholder: penahan erosi pada kontur miring.","survival_estimate":0.8}]'::jsonb,
  '[{"label":"Pengadaan & pembibitan unggul","amount":54432000,"note":"5.400 bibit"},{"label":"Persiapan jalur tanam & ajir","amount":23328000},{"label":"Penanaman bersama warga lokal","amount":34992000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":42768000},{"label":"Monitoring & pelaporan publik","amount":19440000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":19440000}]'::jsonb,
  194400000, 194400000, 298, '2025-11-18', '/images/hero-canopy.jpg', 17,
  array['Loa Kulu', 'Monitoring', 'Percontohan']
),
(
  'LK-053', 'LK-053', 'draft',
  'Draft Kurasi: Lereng Terbuka Barat Daya LK-053',
  'Draft LK-053',
  'Lahan terbuka Kelas 1 seluas 18,77 ha pada kemiringan 11,4° yang sedang disiapkan kurator Admin sebelum dipublikasikan.',
  'Poligon LK-053 merupakan contoh program berstatus Draft di sisi Admin. Publik belum melihat lokasi ini di katalog program hingga Admin melengkapi target anggaran dan menekan tombol Publish.',
  'urgent', 'pascatambang',
  'Lahan terbuka berlereng 11,4° (P90 15,8°) di elevasi 114,6 m dengan tanah Padsolik Merah Kuning.',
  'Pengendalian erosi lereng terbuka, perbaikan media tanam, dan penanaman 7.500 bibit pionir.',
  '[{"species_id":"sungkai","seedlings":3000,"suitability_reason":"Placeholder: pionir lokal tahan paparan terbuka.","survival_estimate":0.82},{"species_id":"aren","seedlings":2500,"suitability_reason":"Placeholder: penguat lereng 11,4°.","survival_estimate":0.8},{"species_id":"sengon","seedlings":2000,"suitability_reason":"Placeholder: penutup tajuk cepat dan pengikat nitrogen.","survival_estimate":0.78}]'::jsonb,
  '[{"label":"Pengadaan bibit pionir & lokal","amount":79200000,"note":"7.500 bibit"},{"label":"Perbaikan media tanam, kompos & kapur","amount":66000000,"note":"Ameliorasi tanah terdegradasi"},{"label":"Penanaman (tenaga kerja lokal)","amount":52800000},{"label":"Pemeliharaan & penyulaman 3 tahun","amount":66000000},{"label":"Monitoring pertumbuhan & pelaporan","amount":33000000},{"label":"Operasional & penyaluran mitra ZISWAF","amount":33000000}]'::jsonb,
  330000000, 0, 0, '2026-11-20', '/images/site-watershed.jpg', 53,
  array['Loa Kulu', 'Draft Admin', 'Lahan Terbuka']
)
on conflict (id) do nothing;

-- =============================================================================
-- LANGKAH PROMOSI ADMIN ASLI (jalankan terpisah SETELAH Anda daftar di web):
-- =============================================================================
-- update public.profiles
-- set role = 'admin'
-- where lower(email) = lower('email-anda@contoh.com');
