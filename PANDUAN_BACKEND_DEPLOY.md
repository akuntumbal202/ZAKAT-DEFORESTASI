# Panduan Setup Supabase & Tayang Online di GitHub Pages (Rimbun Loa Kulu)

Panduan singkat tanpa istilah rumit untuk menyambungkan **Rimbun WebGIS** ke database pusat **Supabase** (gratis) dan menayangkannya secara online lewat **GitHub Pages** (gratis).

---

## Bagian 1 — Siapkan Database di Supabase (±5 menit)

1. Buka **[https://supabase.com](https://supabase.com)** → klik **Start your project** → masuk memakai akun **GitHub** Anda.
2. Klik **New project**:
   - **Name**: `rimbun-loakulu`
   - **Database Password**: buat kata sandi bebas (simpan di catatan Anda)
   - **Region**: pilih **Southeast Asia (Singapore)** agar cepat diakses dari Indonesia
   - Klik **Create new project** dan tunggu ±1–2 menit sampai statusnya hijau.
3. **Buat 5 tabel + 6 program awal Loa Kulu (1 kali klik):**
   - Di menu kiri Supabase, buka **SQL Editor** → klik **New query**.
   - Buka file `rimbun-webgis-prototype/rimbun/supabase/schema.sql`, salin **seluruh** isinya, tempel ke SQL Editor, lalu klik **Run**.
   - Pastikan muncul pesan `Success. No rows returned`.
4. **Aktifkan Voting Tanpa Login (Anonymous Sign-Ins):**
   - Buka menu **Authentication → Sign In / Providers** (atau **Authentication → Configuration → Auth Providers**).
   - Scroll ke bagian **Allow anonymous sign-ins** → nyalakan toggle-nya → klik **Save**.
   - *(Opsional agar daftar akun baru bisa langsung login tanpa verifikasi inbox email)*: di **Authentication → Providers → Email**, Anda bisa mematikan **Confirm email** → klik **Save**.
5. **Ambil 2 Kunci Proyek Supabase:**
   - Buka menu **Project Settings** (ikon gerigi kiri bawah) → **API** (atau **Data API** / **API Keys**).
   - Salin dan simpan sementara:
     1. **Project URL** (contoh: `https://abcdefghijkl.supabase.co`)
     2. **anon / public** key (atau *Publishable key* yang diawali `eyJ...` atau `sb_publishable_...`)

---

## Bagian 2 — Uji Coba Lokal Sebelum Upload (Opsional tapi Disarankan)

1. Di dalam folder `rimbun-webgis-prototype/rimbun/`, salin file `.env.example` dan ganti namanya menjadi **`.env.local`**.
2. Isi 2 barisnya dengan kunci dari Bagian 1:
   ```env
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=kunci_anon_anda_di_sini
   ```
3. Klik ganda `Buka-Rimbun.bat` di folder utama. Sekarang web lokal Anda sudah membaca/menulis langsung ke Supabase!

---

## Bagian 3 — Jadikan Akun Pribadi Anda Sebagai Admin Asli

1. Buka website Rimbun → klik **Masuk → Daftar**, lalu daftarkan email pribadi Anda sendiri (misal `namaanda@gmail.com`).
2. Kembali ke dashboard Supabase → **SQL Editor → New query**, jalankan 1 perintah ini (ganti email sesuai akun yang baru Anda daftarkan):
   ```sql
   update public.profiles
   set role = 'admin'
   where lower(email) = lower('namaanda@gmail.com');
   ```
3. Refresh halaman web → akun pribadi Anda sekarang otomatis menjadi **Admin Asli** yang perubahannya langsung tersimpan ke database pusat dan tampil di semua perangkat!
4. Sementara tombol 1-klik **Akun Demo Donatur** dan **Akun Demo Admin Kurator** tetap aman di **Mode Sandbox Demo** (tidak pernah mengubah database asli dan otomatis reset saat logout).

---

## Bagian 4 — Upload ke GitHub & Tayangkan di GitHub Pages

1. Buat repository baru di **[https://github.com/new](https://github.com/new)** (misal nama repo: `rimbun-loakulu`, pilih **Public** agar GitHub Pages gratis aktif, **jangan** centang Add README).
2. Buka PowerShell di folder `d:\qgis\ZAKAT DEFORESTASI` lalu jalankan perintah ini (ganti URL repo dengan milik Anda):
   ```powershell
   git init
   git branch -M main
   git add .
   git commit -m "Rilis awal Rimbun WebGIS Loa Kulu dengan Supabase"
   git remote add origin https://github.com/USERNAME_ANDA/rimbun-loakulu.git
   git push -u origin main
   ```
   *(File `.gitignore` sudah otomatis mengecualikan folder `frontend/` lama, data mentah besar, dan `.env.local` rahasia Anda — total unggahan hanya ~11 MB!)*
3. **Masukkan 2 Kunci Supabase ke GitHub Secrets:**
   - Buka repo Anda di GitHub → klik tab **Settings** → menu kiri **Secrets and variables → Actions** → klik **New repository secret**.
   - Tambahkan 2 secret berikut:
     - Name: `VITE_SUPABASE_URL` → Value: *(Project URL Supabase Anda)*
     - Name: `VITE_SUPABASE_ANON_KEY` → Value: *(Anon / Publishable Key Supabase Anda)*
4. **Aktifkan GitHub Pages:**
   - Masih di **Settings** repo GitHub → menu kiri **Pages**.
   - Di bagian **Build and deployment → Source**, pilih **GitHub Actions**.
5. **Jalankan Deploy:**
   - Buka tab **Actions** di repo GitHub Anda → pilih workflow **Deploy Rimbun WebGIS to GitHub Pages** → klik **Run workflow** (atau akan jalan otomatis tiap kali Anda `git push`).
   - Tunggu ±1–2 menit sampai ikon centang hijau muncul. Alamat website online Anda akan muncul di sana (`https://USERNAME_ANDA.github.io/rimbun-loakulu/`).

---

## Catatan Perawatan Paket Gratis Supabase
- Jika website tidak dikunjungi siapa pun selama **7 hari berturut-turut**, Supabase gratis otomatis mengistirahatkan (*pause*) database. Cukup buka dashboard Supabase dan klik tombol **Restore project** untuk mengaktifkannya lagi (data tidak hilang).
