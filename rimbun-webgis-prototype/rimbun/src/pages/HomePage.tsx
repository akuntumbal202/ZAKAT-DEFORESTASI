import { useMemo, useState } from 'react';
import { PublicLayout } from '../layouts/PublicLayout';
import { useStore } from '../store/AppStore';
import { Link, to } from '../router/router';
import { platformStats, transparencyStats } from '../services/statsService';
import { CATEGORY_LABEL, impactContextFor, isAcceptingDonations } from '../services/projectService';
import { donationToImpact } from '../lib/impact/impactModel';
import { cx, formatIDRShort, formatMass, formatNumber } from '../lib/format';
import { assetUrl } from '../lib/assets';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Illustrative, StatusBadge } from '../components/ui/Badge';
import { SectionHeader, StatisticsCard } from '../components/StatisticsCard';
import { ProjectCard } from '../components/project/ProjectCard';
import { SiteVisual } from '../components/project/SiteVisual';
import { DonationProgress } from '../components/project/DonationProgress';
import { SegmentBar } from '../components/charts/Charts';
import { Reveal, CountUp } from '../components/ui/Reveal';
import { useGatedActions } from '../store/actions';
import { PROJECTION_PERIODS, QUICK_AMOUNTS, type ProjectionPeriod } from '../config/site';

export function HomePage() {
  const { projects, speciesById } = useStore();
  const { donate } = useGatedActions();
  const stats = useMemo(() => platformStats(projects, speciesById), [projects, speciesById]);
  const tr = useMemo(() => transparencyStats(projects), [projects]);
  const open = projects.filter(isAcceptingDonations);
  const lead = open.find((p) => p.status === 'urgent') ?? open[0] ?? projects[0];
  const sideFeatured = open
    .filter((p) => p.id !== lead?.id)
    .sort((a, b) => b.funding_percentage - a.funding_percentage)
    .slice(0, 2);

  const [teaser, setTeaser] = useState<number>(100_000);
  const [teaserPeriod, setTeaserPeriod] = useState<ProjectionPeriod>(10);
  const teaserImpact = donationToImpact(teaser, teaserPeriod, impactContextFor(null));
  const co2 = formatMass(stats.projectedCo2Kg10y);
  const tCo2 = formatMass(teaserImpact.co2Kg);
  const tO2 = formatMass(teaserImpact.o2Kg);

  return (
    <PublicLayout overlayNav>
      {/* ── Hero: Loa Kulu Canopy Photo + Spatial Inventory Card ── */}
      <section className="hero">
        <div className="hero__photo" aria-hidden>
          <img src={assetUrl('/images/hero-canopy.jpg')} alt="" />
          <div className="hero__scrim" />
        </div>

        <div className="container hero__inner">
          <div className="hero__copy page-enter">
            <span className="hero__kicker">
              <Icon name="polygon" size={14} /> Kutai Kartanegara · Wilayah Fokus Kecamatan Loa Kulu
            </span>
            <h1 className="hero__title">
              Pemetaan deforestasi dan pemulihan hutan <em>Kecamatan Loa Kulu.</em>
            </h1>
            <p className="hero__lead">
              Telusuri 163 poligon kehilangan tutupan pohon di Kecamatan Loa Kulu (5.783,7 ha), tinjau kondisi fisik tiap lokasi, dan simulasikan dukungan Anda pada program rehabilitasi yang telah dikurasi.
            </p>
            <div className="hero__ctas">
              <Button size="lg" variant="light" to={to.explore()} icon="map">
                Buka peta interaktif
              </Button>
              <Button size="lg" variant="outline-light" to={to.programs()} iconRight="arrow-right">
                Lihat {stats.count} program
              </Button>
            </div>
          </div>

          <aside className="hero__summary page-enter" aria-label="Ringkasan Spasial Loa Kulu">
            <div className="hero__summary-head">
              <span className="eyebrow eyebrow--light">Dataset Spasial · Loa Kulu</span>
              <span className="hero__badge">2020–2025</span>
            </div>
            <h2>Peta Deforestasi &amp; Rehabilitasi</h2>
            <p className="hero__summary-sub">
              Analisis raster multi-sumber (Dynamic World Sentinel-2, FABDEM 30 m, curah hujan ERA5-Land, dan peta jenis tanah) pada seluruh bukaan hutan ≥ 5 ha.
            </p>

            <dl className="hero__summary-grid">
              <div>
                <dt>Poligon teranalisis</dt>
                <dd className="num">{formatNumber(stats.totalPolygonCount)} poligon</dd>
              </div>
              <div>
                <dt>Total area hilang</dt>
                <dd className="num">{formatNumber(Math.round(stats.totalDeforestedArea))} ha</dd>
              </div>
              <div>
                <dt>Sudah jadi program</dt>
                <dd className="num">{stats.count} titik aktif</dd>
              </div>
              <div>
                <dt>Tutupan terbanyak</dt>
                <dd>Semak &amp; Lahan Terbuka</dd>
              </div>
            </dl>

            <div className="hero__summary-links">
              <Button size="sm" variant="accent" to={to.explore()} icon="layers">
                Peta Program Restorasi
              </Button>
              <Button size="sm" variant="outline-light" to="explore::all" icon="polygon">
                Bandingkan 163 Poligon
              </Button>
            </div>
          </aside>
        </div>

        {/* 5-stat strip with CountUp */}
        <div className="hero__stats">
          <div className="container hero__stats-row">
            <StatisticsCard variant="strip" label="Poligon teranalisis" value={<CountUp value={stats.totalPolygonCount} />} unit="≥ 5 ha" />
            <StatisticsCard variant="strip" label="Deforestasi Loa Kulu" value={<CountUp value={Math.round(stats.totalDeforestedArea)} />} unit="ha" />
            <StatisticsCard variant="strip" label="Program terkurasi" value={<CountUp value={stats.count} />} unit="lokasi" />
            <StatisticsCard variant="strip" label="Dana terkumpul" value={formatIDRShort(stats.totalCollected)} unit="simulasi" />
            <StatisticsCard variant="strip" label="Potensi serapan CO₂ · 10 th" value={co2.value} unit={co2.unit} />
          </div>
          <div className="container hero__stats-note">
            <Illustrative />
            <span>Data poligon dan parameter fisik berasal dari analisis citra satelit aktual Loa Kulu; angka pendanaan dan potensi karbon (asumsi 100% target terdanai) bersifat simulasi.</span>
          </div>
        </div>
      </section>

      {/* ── Mengapa pendekatan berbasis poligon ───────────────── */}
      <section className="problem section">
        <Reveal className="container problem__grid">
          <div>
            <span className="eyebrow">Mengapa pendekatan berbasis poligon</span>
            <h2 className="problem__title">Rehabilitasi hutan membutuhkan lokasi yang jelas, data fisik terukur, dan perhitungan dampak yang terbuka.</h2>
          </div>
          <ol className="problem__list">
            <li>
              <span className="problem__n num">01</span>
              <div>
                <h3>Setiap lokasi memiliki kondisi fisik yang berbeda</h3>
                <p>Lahan terbuka bekas bukaan/tambang, semak pada lereng miring, dan zona tanah organosol lembap memerlukan jenis tanaman serta perlakuan penanaman yang berbeda.</p>
              </div>
            </li>
            <li>
              <span className="problem__n num">02</span>
              <div>
                <h3>Akses terbuka untuk membandingkan seluruh lokasi</h3>
                <p>Peta interaktif menampilkan program aktif bersamaan dengan seluruh 163 poligon deforestasi agar masyarakat dapat meninjau dan mengusulkan prioritas rehabilitasi.</p>
              </div>
            </li>
            <li>
              <span className="problem__n num">03</span>
              <div>
                <h3>Estimasi dampak disajikan bersama batasannya</h3>
                <p>Biaya per bibit, tingkat kelulushidupan, dan proyeksi serapan karbon ditampilkan secara terbuka serta dipisahkan tegas antara simulasi model dan data lapangan.</p>
              </div>
            </li>
          </ol>
        </Reveal>
      </section>

      {/* ── Program Unggulan (compact <= 82vh layout) ─────────── */}
      <section className="featured section section--tight" id="program-unggulan">
        <Reveal className="container">
          <div className="h-row">
            <div>
              <span className="eyebrow">Program unggulan Loa Kulu</span>
              <h2 className="h-sec">Tiga titik rehabilitasi prioritas</h2>
            </div>
            <Link to={to.programs()} className="text-link">
              Semua {stats.count} program <Icon name="arrow-right" size={16} />
            </Link>
          </div>

          <div className="featured__grid featured__grid--compact">
            {lead && (
              <article className="feature-big feature-big--compact">
                <SiteVisual
                  imageUrl={lead.image_url}
                  category={lead.category}
                  ratio="16/9"
                  label={false}
                  className="feature-big__visual"
                />
                <div className="feature-big__body">
                  <div className="feature-big__meta">
                    <StatusBadge status={lead.status} />
                    <span>{CATEGORY_LABEL[lead.category]}</span>
                    <span className="num">
                      {lead.polygon_code} · {lead.site ? formatNumber(lead.site.area_ha) : '—'} ha
                    </span>
                  </div>
                  <h3>{lead.name}</h3>
                  <p>{lead.summary}</p>
                  <DonationProgress project={lead} inverse />
                  <div className="feature-big__actions">
                    <Button variant="accent" icon="sprout" onClick={() => donate(lead.id)}>
                      Donasi ke lokasi ini
                    </Button>
                    <Button variant="outline-light" to={to.program(lead.id)}>
                      Detail lokasi
                    </Button>
                  </div>
                </div>
              </article>
            )}
            <div className="featured__side featured__side--compact">
              {sideFeatured.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Cara Kerja ────────────────────────────────────────── */}
      <section className="how section">
        <Reveal className="container">
          <SectionHeader eyebrow="Alur keterlibatan" title="Dari peta poligon hingga laporan dampak." align="center" />
          <ol className="how__steps">
            {[
              { n: '01', icon: 'map', title: 'Bandingkan Peta', desc: 'Tinjau program restorasi atau seluruh 163 poligon deforestasi Loa Kulu di WebGIS.' },
              { n: '02', icon: 'compass', title: 'Tinjau Parameter & Bibit', desc: 'Cek elevasi, kelerengan, curah hujan, jenis tanah, serta spesies rekomendasi.' },
              { n: '03', icon: 'sprout', title: 'Salurkan Kontribusi', desc: 'Alokasikan donasi simulasi langsung ke lokasi spesifik pilihan Anda.' },
              { n: '04', icon: 'chart', title: 'Pantau Proyeksi & Dana', desc: 'Cetak bukti digital dan lihat proyeksi serapan CO₂ & produksi O₂ 3–15 tahun.' },
            ].map((s) => (
              <li key={s.n} className="how__step">
                <span className="how__num num">{s.n}</span>
                <Icon name={s.icon} size={22} className="how__icon" />
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* ── Impact Teaser (with 3/10/15 period toggle) ────────── */}
      <section className="impact-teaser section">
        <Reveal className="container impact-teaser__grid">
          <div>
            <span className="eyebrow">Kalkulator dampak</span>
            <h2 className="impact-teaser__title">Simulasikan proyeksi dampak dari kontribusi Anda.</h2>
            <p className="impact-teaser__lead">
              Hitung estimasi jumlah bibit, akumulasi serapan CO₂, dan produksi O₂ berdasarkan nominal donasi atau target serapan karbon pada rentang 3, 10, dan 15 tahun.
            </p>
            <Button to={to.calculator()} variant="primary" icon="calculator">
              Buka kalkulator lengkap
            </Button>
          </div>

          <div className="teaser-box">
            <div className="teaser-box__top">
              <span className="teaser-box__label">Pilih nominal simulasi</span>
              <div className="teaser-box__periods" role="group" aria-label="Periode proyeksi">
                {PROJECTION_PERIODS.map((p) => (
                  <button
                    key={p}
                    className={cx('chip-btn chip-btn--xs', teaserPeriod === p && 'is-active')}
                    onClick={() => setTeaserPeriod(p)}
                  >
                    {p} th
                  </button>
                ))}
              </div>
            </div>

            <div className="teaser-box__chips">
              {QUICK_AMOUNTS.slice(0, 4).map((q) => (
                <button key={q} className={cx('chip-btn', teaser === q && 'is-active')} onClick={() => setTeaser(q)}>
                  {formatIDRShort(q)}
                </button>
              ))}
            </div>

            <div className="teaser-box__results teaser-box__results--3">
              <div>
                <small>Bibit didukung</small>
                <strong className="num">
                  {formatNumber(teaserImpact.seedlings)} <span>bibit</span>
                </strong>
              </div>
              <div>
                <small>CO₂ terserap · {teaserPeriod} th</small>
                <strong className="num">
                  {tCo2.value} <span>{tCo2.unit}</span>
                </strong>
              </div>
              <div>
                <small>O₂ dihasilkan · {teaserPeriod} th</small>
                <strong className="num">
                  {tO2.value} <span>{tO2.unit}</span>
                </strong>
              </div>
            </div>
            <Illustrative />
          </div>
        </Reveal>
      </section>

      {/* ── Transparansi & Kemitraan ZISWAF ───────────────────── */}
      <section className="trust section">
        <Reveal className="container trust__grid">
          <div>
            <span className="eyebrow">Transparansi &amp; ZISWAF</span>
            <h2 className="trust__title">Pengelolaan dana yang terbuka dan terpisah per program.</h2>
            <p className="trust__lead">
              Platform ini dikembangkan secara independen dan dirancang untuk bermitra dengan lembaga ZISWAF. Setiap program memisahkan target anggaran, dana terkumpul, penggunaan lapangan, dan sisa dana secara terbuka.
            </p>
            <div className="trust__actions">
              <Button to={to.transparency()} variant="secondary" icon="shield">
                Halaman transparansi
              </Button>
              <Button to={to.about('ziswaf')} variant="ghost">
                Skema ZISWAF →
              </Button>
            </div>
          </div>

          <div className="trust__panel">
            <div className="trust__photo">
              <img src={assetUrl('/images/planting-docs.jpg')} alt="Kegiatan pembibitan dan rehabilitasi hutan Loa Kulu" loading="lazy" />
            </div>
            <div className="trust__panel-head">
              <span>Ringkasan dana simulasi · {stats.count} program</span>
              <Illustrative label="Simulasi" />
            </div>
            <div className="trust__big num">{formatIDRShort(tr.collected)}</div>
            <span className="small muted">terkumpul dari target {formatIDRShort(tr.target)}</span>
            <SegmentBar
              total={tr.target}
              format={formatIDRShort}
              segments={[
                { label: 'Digunakan', value: tr.spent, tone: 'forest' },
                { label: 'Dialokasikan', value: tr.allocated - tr.spent, tone: 'moss' },
                { label: 'Belum terdanai', value: tr.target - tr.collected, tone: 'line' },
              ]}
            />
          </div>
        </Reveal>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────── */}
      <section className="closing">
        <div className="container closing__inner">
          <div>
            <h2>Mulai jelajahi data dan program rehabilitasi Loa Kulu.</h2>
            <p className="muted-light">Tinjau persebaran deforestasi di peta interaktif atau pilih langsung program rehabilitasi yang membutuhkan dukungan.</p>
          </div>
          <div className="closing__ctas">
            <Button size="lg" variant="light" to={to.explore()} icon="map">
              Buka Peta Interaktif
            </Button>
            <Button size="lg" variant="outline-light" to={to.programs()} iconRight="arrow-right">
              Lihat Semua Program
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
