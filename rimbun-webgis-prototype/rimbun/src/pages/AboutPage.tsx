import { PublicLayout } from '../layouts/PublicLayout';
import { PageHeader, PageHeaderVisual, SectionHeader } from '../components/StatisticsCard';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { to } from '../router/router';
import { GIS_METHOD_STEPS, IMPACT_ASSUMPTIONS, LITERATURE_REFERENCES, METHOD_NOTES, UNCERTAINTY_NOTE } from '../lib/impact/assumptions';
import { SITE } from '../config/site';

const PILLARS = [
  {
    icon: 'map',
    title: 'Informasi geospasial terbuka',
    body: 'Menyajikan persebaran area kehilangan tutupan pohon beserta parameter fisiknya (elevasi, kelerengan, curah hujan, dan jenis tanah) sebagai dasar penentuan prioritas rehabilitasi.',
  },
  {
    icon: 'wallet',
    title: 'Pendanaan berbasis lokasi',
    body: 'Setiap kontribusi dialokasikan langsung ke satu lokasi program pilihan dengan rincian kebutuhan bibit dan biaya yang ditampilkan secara terbuka.',
  },
  {
    icon: 'chart',
    title: 'Proyeksi dampak yang terukur',
    body: 'Menyediakan estimasi serapan CO₂ dan produksi O₂ dengan rumus terbuka yang memisahkan secara tegas antara data spasial aktual dan model simulasi.',
  },
];

const AUDIENCE = [
  { icon: 'users', title: 'Masyarakat umum', body: 'Meninjau persebaran deforestasi di Kecamatan Loa Kulu serta mengusulkan lokasi prioritas tanpa harus membuat akun.' },
  { icon: 'heart', title: 'Donatur', body: 'Memilih lokasi restorasi tertentu, memantau perkembangan dana, menyimpan lokasi pilihan, dan melihat estimasi dampak kontribusi.' },
  { icon: 'building', title: 'Lembaga & pengelola', body: 'Mengkurasi poligon deforestasi berdasarkan parameter fisik lahan, menyusun rencana penanaman, dan memantau distribusi program.' },
];

const ROADMAP = [
  { phase: 'Tahap 1', title: 'Perancangan antarmuka & alur pengguna', body: 'Struktur halaman publik, alur donasi simulasi, dashboard donatur, dan kalkulator proyeksi dampak.' },
  {
    phase: 'Tahap 2',
    title: 'WebGIS Loa Kulu, kurasi admin & database',
    body: 'Integrasi 163 poligon deforestasi aktual, batas GADM, citra Sentinel-2 2025, panel kurasi admin, dan sinkronisasi database Supabase.',
    now: true,
  },
  { phase: 'Tahap 3', title: 'Validasi katalog spesies & perluasan wilayah', body: 'Pemutakhiran parameter silvikultur bersama tim kehutanan/tanaman serta perluasan cakupan ke seluruh Kutai Kartanegara.' },
  { phase: 'Tahap 4', title: 'Kemitraan ZISWAF & pelaporan lapangan', body: 'Integrasi penghimpunan dana resmi bersama lembaga ZISWAF dan pembaruan laporan realisasi lapangan secara berkala.' },
];

export function AboutPage() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow={`Tentang ${SITE.name}`}
        title="Menghubungkan data deforestasi, program rehabilitasi, dan estimasi dampak."
        lead={`${SITE.name} adalah prototipe platform WebGIS yang memetakan area kehilangan tutupan pohon di Kecamatan Loa Kulu, menghubungkannya dengan rencana rehabilitasi berbasis poligon, dan dirancang untuk bermitra dengan lembaga ZISWAF dalam pengelolaan dana.`}
        aside={
          <PageHeaderVisual
            imageUrl="/images/hero-canopy.jpg"
            alt="Lanskap hutan tropis Kalimantan wilayah fokus Kecamatan Loa Kulu"
            badge="Wilayah Kajian · Loa Kulu"
            caption="163 poligon deforestasi ≥ 5 ha (5.783,7 ha) dan batas 12 desa GADM"
          />
        }
      />

      <section className="container about">
        <div className="pillars">
          {PILLARS.map((p, i) => (
            <article key={p.title} className="pillar">
              <span className="pillar__n num">0{i + 1}</span>
              <Icon name={p.icon} size={22} />
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>

        <div className="section">
          <SectionHeader eyebrow="Pengguna platform" title="Dirancang untuk tiga kelompok utama." />
          <div className="audience">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="audience__item">
                <span className="audience__icon">
                  <Icon name={a.icon} size={20} />
                </span>
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="partner" id="ziswaf">
          <div>
            <span className="eyebrow eyebrow--light">Skema kemitraan</span>
            <h2>Penghimpunan dan pengelolaan dana bersama lembaga ZISWAF.</h2>
            <p>
              Platform ini dikembangkan secara independen sebagai sistem informasi spasial dan transparansi program. Pada tahap implementasi nyata, penghimpunan serta penyaluran dana direncanakan bekerja sama dengan lembaga pengelola ZISWAF (zakat, infak, sedekah, dan wakaf) resmi.
            </p>
          </div>
          <ul>
            <li>
              <Icon name="shield" size={18} /> Alokasi dana terikat langsung pada lokasi poligon pilihan donatur
            </li>
            <li>
              <Icon name="file" size={18} /> Pemisahan jelas antara target, dana terkumpul, realisasi, dan sisa dana
            </li>
            <li>
              <Icon name="handshake" size={18} /> Status saat ini: tahap prototipe &amp; penjajakan kemitraan
            </li>
          </ul>
        </div>

        <div className="section about__method" id="metodologi">
          <SectionHeader
            eyebrow="Metodologi"
            title="Sumber data spasial dan model estimasi dampak."
            lead="Rimbun memisahkan secara jelas antara data fisik hasil pengolahan geospasial (aktual untuk wilayah Loa Kulu) dan parameter proyeksi pendanaan/karbon (simulasi)."
          />

          <div className="stack-lg">
            <div className="two-col two-col--wide-left">
              <div>
                <h3 className="h-sub" style={{ marginBottom: 14 }}>
                  <Icon name="map" size={17} /> A. Metodologi pemetaan deforestasi &amp; parameter fisik
                </h3>
                <ol className="method-steps">
                  {GIS_METHOD_STEPS.map((m, i) => (
                    <li key={m}>
                      <span className="num">{i + 1}</span>
                      <p>{m}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="panel panel--pad">
                <h3 className="h-sub">
                  <Icon name="database" size={17} /> Pemisahan data aktual vs referensi
                </h3>
                <p className="small">
                  <b>Data hasil ekstraksi GIS aktual per poligon:</b> batas poligon, luas (ha), kelas tutupan 2025, elevasi median &amp; rentang (FABDEM), kelerengan median/std/P90 (FABDEM), curah hujan tahunan (ERA5-Land), serta jenis tanah dominan &amp; persentase cakupannya.
                </p>
                <p className="small muted" style={{ marginTop: 10 }}>
                  <b>Data referensi &amp; simulasi prototipe:</b> kisaran suhu umum Kalimantan Timur (26–28 °C), perkiraan pH/drainase dari kelas tanah (bukan uji lab), daftar spesies awal, target biaya, serta transaksi donasi.
                </p>
              </div>
            </div>

            <div className="two-col two-col--wide-left">
              <div>
                <h3 className="h-sub" style={{ marginBottom: 14 }}>
                  <Icon name="chart" size={17} /> B. Metodologi proyeksi karbon (C), serapan CO₂ &amp; produksi O₂
                </h3>
                <ol className="method-steps">
                  {METHOD_NOTES.map((m, i) => (
                    <li key={m}>
                      <span className="num">{i + 1}</span>
                      <p>{m}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="panel panel--pad">
                <h3 className="h-sub">
                  <Icon name="alert" size={17} /> Batasan model ({IMPACT_ASSUMPTIONS.version})
                </h3>
                <p className="small">{UNCERTAINTY_NOTE}</p>
                <p className="small muted" style={{ marginTop: 10 }}>
                  Database spesies dikelola secara modular di Supabase (dengan status verifikasi Valid/Dummy) sehingga parameter biofisik dan laju serapan per spesies dapat diperbarui oleh tim biologi/silvikultur tanpa mengubah tampilan antarmuka.
                </p>
              </div>
            </div>

            <div className="panel panel--pad">
              <h3 className="h-sub" style={{ marginBottom: 12 }}>
                <Icon name="file" size={17} /> C. Rujukan literatur ilmiah (SDSS &amp; kalkulator dampak)
              </h3>
              <ul className="lit-refs">
                {LITERATURE_REFERENCES.map((ref) => (
                  <li key={ref.citation}>
                    <b>{ref.citation}</b>
                    <span>{ref.scope}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Tahapan pengembangan" title="Rencana pengembangan bertahap." />
          <ol className="roadmap">
            {ROADMAP.map((r) => (
              <li key={r.phase} className={r.now ? 'is-now' : undefined}>
                <span className="roadmap__phase">
                  {r.phase}
                  {r.now && <em>tahap saat ini</em>}
                </span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="about__cta">
          <Button size="lg" to={to.explore()} icon="map">
            Buka peta interaktif
          </Button>
          <Button size="lg" variant="secondary" to={to.transparency()}>
            Lihat laporan transparansi
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
