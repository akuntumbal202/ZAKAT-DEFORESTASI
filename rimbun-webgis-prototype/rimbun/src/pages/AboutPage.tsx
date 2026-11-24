import { PublicLayout } from '../layouts/PublicLayout';
import { PageHeader, PageHeaderVisual, SectionHeader } from '../components/StatisticsCard';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { to } from '../router/router';
import { METHOD_NOTES, UNCERTAINTY_NOTE } from '../lib/impact/assumptions';
import { SITE } from '../config/site';

const PILLARS = [
  {
    icon: 'map',
    title: 'Platform informasi geospasial',
    body: 'Menyajikan persebaran area terdeforestasi dan karakteristik lokasi (iklim, tanah, kelerengan) agar publik dan lembaga dapat memahami di mana pemulihan paling dibutuhkan.',
  },
  {
    icon: 'wallet',
    title: 'Crowdfunding lingkungan',
    body: 'Satu donasi untuk satu lokasi pilihan. Progres pendanaan tiap program terlihat jelas, dan dana dikelola bersama mitra ZISWAF.',
  },
  {
    icon: 'chart',
    title: 'Pengukuran dampak',
    body: 'Estimasi serapan CO₂ dan produksi O₂ dengan asumsi yang terbuka, dirancang agar model ilmiah tervalidasi dapat dipasang kemudian.',
  },
];

const AUDIENCE = [
  { icon: 'users', title: 'Masyarakat umum', body: 'Mengakses informasi deforestasi dan kondisi lingkungan tanpa perlu akun.' },
  { icon: 'heart', title: 'Donatur', body: 'Mendukung lokasi tertentu, memantau kontribusi, dan melihat estimasi dampaknya.' },
  { icon: 'building', title: 'Lembaga & mitra', body: 'Mengidentifikasi lokasi potensial, meninjau kebutuhan pendanaan, dan melihat distribusi program.' },
];

const ROADMAP = [
  { phase: 'Fase 1', title: 'Prototipe & desain UI', body: 'Struktur halaman publik, alur donasi simulasi, dashboard donatur, dan kalkulator dampak.' },
  {
    phase: 'Fase 2',
    title: 'WebGIS Loa Kulu & Kurasi Admin',
    body: 'Integrasi 163 poligon deforestasi aktual, batas GADM, citra Sentinel-2 2025, serta panel kurasi Admin.',
    now: true,
  },
  { phase: 'Fase 3', title: 'Backend & katalog spesies final', body: 'Basis data spasial penuh, autentikasi produksi, serta validasi kesesuaian spesies bersama tim tanaman.' },
  { phase: 'Fase 4', title: 'Pembayaran & pelaporan ZISWAF', body: 'Integrasi payment gateway bersama mitra ZISWAF dan audit realisasi lapangan berkala.' },
];

export function AboutPage() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow={`Tentang ${SITE.name}`}
        title="Menghubungkan peta, dana, dan dampak dalam satu produk."
        lead={`${SITE.name} adalah platform WebGIS yang mempertemukan informasi deforestasi, program reboisasi, dan penggalangan dana lingkungan. Platform ini dikembangkan secara independen dan dirancang untuk bermitra dengan lembaga ZISWAF dalam penghimpunan serta pengelolaan dana.`}
        aside={
          <PageHeaderVisual
            imageUrl="/images/hero-canopy.jpg"
            alt="Lanskap hutan tropis Kalimantan wilayah fokus Loa Kulu"
            badge="Fokus · Kec. Loa Kulu"
            caption="163 poligon deforestasi (5.783,7 ha) + batas 12 desa GADM"
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
          <SectionHeader eyebrow="Untuk siapa" title="Dirancang untuk tiga jenis pengguna." />
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
            <span className="eyebrow eyebrow--light">Kemitraan</span>
            <h2>Amanah dalam pengelolaan dana.</h2>
            <p>
              Penghimpunan dan penyaluran dana direncanakan melalui lembaga ZISWAF (zakat, infak, sedekah, dan wakaf) sebagai mitra. Nilai amanah dan transparansi menjadi dasar setiap laporan yang kami tampilkan.
            </p>
          </div>
          <ul>
            <li>
              <Icon name="shield" size={18} /> Dana dialokasikan sesuai lokasi pilihan donatur
            </li>
            <li>
              <Icon name="file" size={18} /> Laporan realisasi per program
            </li>
            <li>
              <Icon name="handshake" size={18} /> Status kerja sama: dalam penjajakan
            </li>
          </ul>
        </div>

        <div className="section about__method" id="metodologi">
          <SectionHeader eyebrow="Metodologi dampak" title="Bagaimana estimasi dampak dihitung (versi prototipe)." />
          <div className="two-col">
            <ol className="method-steps">
              {METHOD_NOTES.map((m, i) => (
                <li key={m}>
                  <span className="num">{i + 1}</span>
                  <p>{m}</p>
                </li>
              ))}
            </ol>
            <div className="panel panel--pad">
              <h3 className="h-sub">
                <Icon name="alert" size={17} /> Batasan
              </h3>
              <p>{UNCERTAINTY_NOTE}</p>
              <p className="small muted" style={{ marginTop: 12 }}>
                Parameter yang dipakai sekarang hanyalah placeholder agar alur kalkulator dapat diuji. Nilainya akan diganti setelah metodologi ditetapkan bersama ahli.
              </p>
            </div>
          </div>
        </div>

        <div className="section">
          <SectionHeader eyebrow="Peta jalan" title="Dibangun bertahap." />
          <ol className="roadmap">
            {ROADMAP.map((r) => (
              <li key={r.phase} className={r.now ? 'is-now' : undefined}>
                <span className="roadmap__phase">
                  {r.phase}
                  {r.now && <em>sekarang</em>}
                </span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="about__cta">
          <Button size="lg" to={to.explore()} icon="map">
            Mulai jelajahi
          </Button>
          <Button size="lg" variant="secondary" to={to.transparency()}>
            Lihat transparansi
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
