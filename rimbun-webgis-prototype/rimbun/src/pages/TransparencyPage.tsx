import { useMemo, useState } from 'react';
import { PublicLayout } from '../layouts/PublicLayout';
import { PageHeader, PageHeaderVisual, StatisticsCard } from '../components/StatisticsCard';
import { useStore } from '../store/AppStore';
import { transparencyStats, platformStats } from '../services/statsService';
import { REPORTS, FIELD_DOCS, type FieldDoc, type ReportDoc } from '../data/mock/transparency';
import { formatDate, formatIDR, formatIDRShort, formatNumber, formatPercent, cx } from '../lib/format';
import { assetUrl } from '../lib/assets';
import { DonutChart, SegmentBar, VBarChart } from '../components/charts/Charts';
import { Callout, ProgressBar } from '../components/ui/Feedback';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Link, to } from '../router/router';
import { Badge, Illustrative } from '../components/ui/Badge';
import { SiteVisual } from '../components/project/SiteVisual';
import { SITE } from '../config/site';

const STAGES = ['Penggalangan', 'Persiapan', 'Penanaman', 'Pemeliharaan', 'Monitoring'] as const;

export function TransparencyPage() {
  const { projects, getProject } = useStore();
  const tr = useMemo(() => transparencyStats(projects), [projects]);
  const ps = useMemo(() => platformStats(projects), [projects]);

  const [report, setReport] = useState<ReportDoc | null>(null);
  const [activePhoto, setActivePhoto] = useState<FieldDoc | null>(null);
  const [printTarget, setPrintTarget] = useState<'summary' | ReportDoc>('summary');

  const reportProject = report?.project_id ? getProject(report.project_id) : undefined;
  const reportRow = report?.project_id ? tr.rows.find((r) => r.project.id === report.project_id) : undefined;
  const reportPhotos = useMemo(() => {
    if (!report) return [];
    if (report.project_id) {
      const own = FIELD_DOCS.filter((d) => d.project_id === report.project_id);
      return own.length ? own : FIELD_DOCS.slice(0, 2);
    }
    return FIELD_DOCS.slice(0, 4);
  }, [report]);

  const triggerPrint = (target: 'summary' | ReportDoc) => {
    setPrintTarget(target);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  // Printable report data derived from printTarget
  const printDoc = printTarget === 'summary' ? null : printTarget;
  const printProject = printDoc?.project_id ? getProject(printDoc.project_id) : undefined;
  const printRow = printDoc?.project_id ? tr.rows.find((r) => r.project.id === printDoc.project_id) : undefined;
  const printPhotos = useMemo(() => {
    if (printDoc?.project_id) {
      const own = FIELD_DOCS.filter((d) => d.project_id === printDoc.project_id);
      return own.length ? own : FIELD_DOCS.slice(0, 2);
    }
    return FIELD_DOCS.slice(0, 4);
  }, [printDoc]);

  const activePhotoProject = activePhoto ? getProject(activePhoto.project_id) : undefined;
  const printedDate = formatDate(new Date().toISOString(), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <PublicLayout>
      <div className="transp-page">
        <PageHeader
          eyebrow="Transparansi & laporan"
          title="Ke mana dana mengalir, dan apa hasilnya."
          lead="Halaman ini memisahkan target anggaran, dana terkumpul, dana yang telah digunakan, dan sisa dana untuk setiap program rehabilitasi di Kecamatan Loa Kulu."
          aside={
            <PageHeaderVisual
              imageUrl="/images/field-planting.jpg"
              alt="Dokumentasi kegiatan penanaman dan transparansi restorasi Loa Kulu"
              badge="Akuntabilitas Prototipe"
              caption={`${Math.round((tr.collected / Math.max(1, tr.target)) * 100)}% dana simulasi terkumpul di ${ps.count} program Loa Kulu`}
            />
          }
        >
          <div className="phead__callout">
            <Callout tone="warn" title="Laporan simulasi">
              Semua angka keuangan dan laporan pada halaman ini merupakan data contoh untuk prototipe dan <b>bukan laporan keuangan aktual</b>. Laporan resmi akan diterbitkan bersama mitra pengelola dana ZISWAF.
            </Callout>
          </div>
          <div className="phead__actions">
            <Button variant="primary" icon="printer" onClick={() => triggerPrint('summary')}>
              Cetak / Simpan PDF Laporan Ringkasan
            </Button>
          </div>
        </PageHeader>

        <section className="container transp">
          <div className="money4">
            <StatisticsCard icon="target" label="Target anggaran" value={formatIDRShort(tr.target)} note="Total seluruh program" />
            <StatisticsCard icon="wallet" label="Dana terkumpul" value={formatIDRShort(tr.collected)} note={`${Math.round((tr.collected / Math.max(1, tr.target)) * 100)}% dari target`} tone="forest" />
            <StatisticsCard icon="check-circle" label="Dana telah digunakan" value={formatIDRShort(tr.spent)} note={`Dialokasikan ${formatIDRShort(tr.allocated)}`} tone="ochre" />
            <StatisticsCard icon="database" label="Sisa dana" value={formatIDRShort(tr.remaining)} note="Terkumpul − digunakan" tone="clay" />
          </div>

          <div className="two-col">
            <div className="panel panel--pad">
              <div className="h-row">
                <h2 className="h-sec">Komposisi dana terhadap target</h2>
                <Illustrative label="Simulasi" />
              </div>
              <SegmentBar
                total={tr.target}
                format={formatIDRShort}
                segments={[
                  { label: 'Telah digunakan', value: tr.spent, tone: 'forest' },
                  { label: 'Dialokasikan, belum terpakai', value: Math.max(0, tr.allocated - tr.spent), tone: 'moss' },
                  { label: 'Terkumpul, belum dialokasikan', value: Math.max(0, tr.collected - tr.allocated), tone: 'ochre' },
                  { label: 'Kekurangan target', value: Math.max(0, tr.target - tr.collected), tone: 'line' },
                ]}
              />
            </div>
            <div className="panel panel--pad">
              <h2 className="h-sec">4 Pilar posisi dana</h2>
              <VBarChart
                ariaLabel="Perbandingan empat pilar dana program"
                format={formatIDRShort}
                items={[
                  { label: 'Target', value: tr.target },
                  { label: 'Terkumpul', value: tr.collected, highlight: true },
                  { label: 'Digunakan', value: tr.spent },
                  { label: 'Sisa dana', value: tr.remaining },
                ]}
              />
            </div>
          </div>

          <div className="two-col two-col--wide-left transp__split">
            <div className="panel panel--pad">
              <h2 className="h-sec">Rincian penggunaan dana</h2>
              <p className="small muted" style={{ marginBottom: 14 }}>
                Dana yang telah digunakan, dikelompokkan dalam 5 pos biaya utama restorasi Loa Kulu.
              </p>
              <DonutChart
                ariaLabel="Diagram alokasi komponen biaya restorasi"
                items={tr.byCategory}
                centerLabel="Telah digunakan"
                centerValue={formatIDRShort(tr.spent)}
                format={formatIDRShort}
              />
            </div>
            <div className="panel panel--pad transp__glance">
              <h2 className="h-sec">Sekilas program &amp; wilayah</h2>
              <dl className="kv">
                <div>
                  <dt>Total program aktif</dt>
                  <dd className="num">{ps.count} lokasi</dd>
                </div>
                <div>
                  <dt>Sedang menggalang dana</dt>
                  <dd className="num">{ps.active} program</dd>
                </div>
                <div>
                  <dt>Luas area ditargetkan</dt>
                  <dd className="num">{formatNumber(ps.totalArea)} ha</dd>
                </div>
                <div>
                  <dt>Cakupan deforestasi Loa Kulu</dt>
                  <dd className="num">
                    {formatNumber(Math.round(ps.totalDeforestedArea))} ha ({ps.totalPolygonCount} poligon)
                  </dd>
                </div>
                <div>
                  <dt>Bibit direncanakan</dt>
                  <dd className="num">{formatNumber(ps.totalSeedlings)}</dd>
                </div>
                <div>
                  <dt>Bibit tertanam (simulasi)</dt>
                  <dd className="num">{formatNumber(tr.seedlingsPlanted)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <section>
            <div className="h-row">
              <h2 className="h-sec">Realisasi &amp; status pelaksanaan per program</h2>
              <Button size="sm" variant="secondary" icon="printer" onClick={() => triggerPrint('summary')}>
                Cetak / Simpan PDF
              </Button>
            </div>
            <div className="table-wrap">
              <table className="table realisation">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Tahap</th>
                    <th className="r">Target</th>
                    <th className="r">Terkumpul</th>
                    <th className="r">Digunakan</th>
                    <th className="r">Sisa</th>
                    <th className="r">Bibit tertanam</th>
                  </tr>
                </thead>
                <tbody>
                  {tr.rows.map((r) => (
                    <tr key={r.project.id}>
                      <td>
                        <Link to={to.program(r.project.id)} className="realisation__name">
                          <span className="num muted">{r.project.id}</span> {r.project.name}
                        </Link>
                        <ProgressBar value={r.project.funding_percentage} size="sm" />
                      </td>
                      <td>
                        <div className="stage" title={r.stage}>
                          {STAGES.map((s, i) => (
                            <span key={s} className={cx('stage__dot', i <= STAGES.indexOf(r.stage) && 'is-on')} />
                          ))}
                          <span className="stage__label">{r.stage}</span>
                        </div>
                      </td>
                      <td className="r num">{formatIDRShort(r.project.funding_target)}</td>
                      <td className="r num">{formatIDRShort(r.project.funding_collected)}</td>
                      <td className="r num">{formatIDRShort(r.spent)}</td>
                      <td className="r num">{formatIDRShort(r.remaining)}</td>
                      <td className="r num">
                        {formatNumber(r.seedlings_planted)} <span className="muted">/ {formatNumber(r.project.total_seedlings)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="two-col transp__bottom">
            <section>
              <div className="h-row">
                <h2 className="h-sec">Laporan realisasi</h2>
                <span className="small muted">Klik untuk pratinjau atau simpan PDF</span>
              </div>
              <ul className="reports">
                {REPORTS.map((r) => (
                  <li key={r.id} className="report-row">
                    <button type="button" className="report" onClick={() => setReport(r)}>
                      <span className="report__icon">
                        <Icon name="file" size={18} />
                      </span>
                      <span className="report__text">
                        <b>{r.title}</b>
                        <small>
                          {r.kind} · {r.period} · {r.id}
                        </small>
                      </span>
                      <Icon name="chevron-right" size={18} />
                    </button>
                    <button
                      type="button"
                      className="report-row__pdf"
                      title={`Cetak / Simpan PDF ${r.id}`}
                      aria-label={`Cetak atau simpan PDF ${r.title}`}
                      onClick={() => triggerPrint(r)}
                    >
                      <Icon name="printer" size={16} />
                      <span>PDF</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="h-row">
                <h2 className="h-sec">Dokumentasi lapangan penanaman</h2>
                <span className="small muted">{FIELD_DOCS.length} foto · klik untuk perbesar</span>
              </div>
              <div className="docs docs--gallery">
                {FIELD_DOCS.map((d) => {
                  const p = getProject(d.project_id);
                  return (
                    <figure key={d.id} className="doc doc--interactive">
                      <button
                        type="button"
                        className="doc__trigger"
                        onClick={() => setActivePhoto(d)}
                        aria-label={`Perbesar foto: ${d.caption}`}
                      >
                        <div className="doc__media">
                          <SiteVisual imageUrl={d.image_url} category={p?.category ?? 'hutan-lahan-kering'} ratio="4/3" label={false} />
                          <span className="doc__stage">{d.stage}</span>
                        </div>
                        <figcaption>
                          <b>{d.caption}</b>
                          <small>
                            {d.location} · {formatDate(d.date)}
                          </small>
                        </figcaption>
                      </button>
                    </figure>
                  );
                })}
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                <Icon name="image" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Foto ilustrasi kegiatan lapangan untuk prototipe Kecamatan Loa Kulu; pada fase operasional foto &amp; laporan PDF akan diunggah langsung oleh tim lapangan/admin.
              </p>
            </section>
          </div>
        </section>

        {/* ── Modal Pratinjau Laporan Realisasi + Foto Lapangan + Cetak PDF ── */}
        <Modal
          open={!!report}
          onClose={() => setReport(null)}
          size="lg"
          title={report?.title ?? ''}
          subtitle={`${report?.kind} · ${report?.period} · ${report?.id}`}
          footer={
            report ? (
              <>
                <Button variant="secondary" onClick={() => setReport(null)}>
                  Tutup
                </Button>
                <Button variant="primary" icon="printer" onClick={() => triggerPrint(report)}>
                  Cetak / Simpan PDF
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="sim-banner">
            <Icon name="info" size={15} /> Contoh laporan simulasi prototipe, bukan laporan keuangan aktual.
          </div>
          {report?.summary_note && (
            <p className="small muted" style={{ marginBottom: 14 }}>
              {report.summary_note}
            </p>
          )}
          {reportProject && reportRow ? (
            <dl className="summary">
              <div>
                <dt>Program</dt>
                <dd>{reportProject.name}</dd>
              </div>
              <div>
                <dt>Tahap pelaksanaan</dt>
                <dd>{reportRow.stage}</dd>
              </div>
              <div>
                <dt>Dana dialokasikan</dt>
                <dd className="num">{formatIDR(reportRow.allocated)}</dd>
              </div>
              <div>
                <dt>Dana digunakan</dt>
                <dd className="num">{formatIDR(reportRow.spent)}</dd>
              </div>
              <div>
                <dt>Bibit tertanam</dt>
                <dd className="num">
                  {formatNumber(reportRow.seedlings_planted)} / {formatNumber(reportProject.total_seedlings)} bibit
                </dd>
              </div>
              <div>
                <dt>Tanggal laporan</dt>
                <dd>{reportRow.last_report ? formatDate(reportRow.last_report) : '—'}</dd>
              </div>
            </dl>
          ) : (
            <dl className="summary">
              <div>
                <dt>Cakupan</dt>
                <dd>Seluruh program klaster Loa Kulu ({ps.count} lokasi)</dd>
              </div>
              <div>
                <dt>Dana terkumpul</dt>
                <dd className="num">{formatIDR(tr.collected)}</dd>
              </div>
              <div>
                <dt>Dana dialokasikan</dt>
                <dd className="num">{formatIDR(tr.allocated)}</dd>
              </div>
              <div>
                <dt>Dana digunakan</dt>
                <dd className="num">{formatIDR(tr.spent)}</dd>
              </div>
              <div>
                <dt>Sisa dana</dt>
                <dd className="num">{formatIDR(tr.remaining)}</dd>
              </div>
              <div>
                <dt>Total bibit tertanam</dt>
                <dd className="num">{formatNumber(tr.seedlingsPlanted)} bibit</dd>
              </div>
            </dl>
          )}

          {reportPhotos.length > 0 && (
            <div className="modal-report-photos">
              <span className="eyebrow" style={{ marginBottom: 8 }}>
                Dokumentasi lapangan terkait
              </span>
              <div className="modal-report-photos__grid">
                {reportPhotos.map((ph) => (
                  <figure key={ph.id} className="modal-report-photos__item">
                    <img src={assetUrl(ph.image_url)} alt={ph.caption} />
                    <figcaption>
                      <b>{ph.caption}</b>
                      <small>
                        {ph.location} · {formatDate(ph.date)}
                      </small>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </Modal>

        {/* ── Modal Lightbox Perbesar Foto Lapangan ── */}
        <Modal
          open={!!activePhoto}
          onClose={() => setActivePhoto(null)}
          size="lg"
          title={activePhoto?.caption ?? ''}
          subtitle={activePhoto ? `${activePhoto.location} · ${formatDate(activePhoto.date)}` : ''}
          footer={
            activePhoto ? (
              <>
                {activePhotoProject && (
                  <Button
                    variant="secondary"
                    to={to.program(activePhotoProject.id)}
                    onClick={() => setActivePhoto(null)}
                    iconRight="arrow-right"
                  >
                    Lihat program {activePhotoProject.short_name}
                  </Button>
                )}
                <Button variant="primary" onClick={() => setActivePhoto(null)}>
                  Tutup
                </Button>
              </>
            ) : undefined
          }
        >
          {activePhoto && (
            <div className="lightbox">
              <img className="lightbox__img" src={assetUrl(activePhoto.image_url)} alt={activePhoto.caption} />
              <div className="lightbox__meta">
                <Badge tone="open">{activePhoto.stage}</Badge>
                <span className="small muted">
                  Lokasi: <b>{activePhoto.location}</b> · Tanggal: {formatDate(activePhoto.date)}
                </span>
              </div>
            </div>
          )}
        </Modal>
      </div>

      {/* ── Formal A4 Printable Document (Visible ONLY in @media print) ── */}
      <article className="print-report" aria-hidden="true">
        <header className="print-report__head">
          <div>
            <span className="print-report__eyebrow">{SITE.name} · {SITE.regionFocus}</span>
            <h1>{printDoc ? printDoc.title : 'Laporan Transparansi & Realisasi Klaster Loa Kulu'}</h1>
            <p className="print-report__sub">
              {printDoc
                ? `${printDoc.kind} · Periode ${printDoc.period} · Kode Dokumen ${printDoc.id}`
                : `Rekapitulasi ${ps.count} program aktif · Dicetak pada ${printedDate}`}
            </p>
          </div>
          <span className="print-report__stamp">SIMULASI PROTOTIPE</span>
        </header>

        {printDoc?.summary_note && <p className="print-report__lead">{printDoc.summary_note}</p>}

        {printProject && printRow ? (
          <>
            <section className="print-report__section">
              <h2>1. Ringkasan Program &amp; Realisasi Dana</h2>
              <table className="print-table">
                <tbody>
                  <tr>
                    <th>Nama Program</th>
                    <td>{printProject.name} ({printProject.polygon_code})</td>
                    <th>Tahap Pelaksanaan</th>
                    <td>{printRow.stage}</td>
                  </tr>
                  <tr>
                    <th>Target Anggaran</th>
                    <td className="num">{formatIDR(printProject.funding_target)}</td>
                    <th>Dana Terkumpul</th>
                    <td className="num">{formatIDR(printProject.funding_collected)} ({formatPercent(printProject.funding_percentage)})</td>
                  </tr>
                  <tr>
                    <th>Dana Dialokasikan</th>
                    <td className="num">{formatIDR(printRow.allocated)}</td>
                    <th>Dana Digunakan</th>
                    <td className="num">{formatIDR(printRow.spent)}</td>
                  </tr>
                  <tr>
                    <th>Sisa Dana</th>
                    <td className="num">{formatIDR(printRow.remaining)}</td>
                    <th>Bibit Tertanam</th>
                    <td className="num">{formatNumber(printRow.seedlings_planted)} / {formatNumber(printProject.total_seedlings)} bibit</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="print-report__section">
              <h2>2. Rincian Komponen Biaya Program</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Komponen Biaya</th>
                    <th className="r">Estimasi Anggaran</th>
                    <th className="r">Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {printProject.cost_breakdown.map((c) => (
                    <tr key={c.label}>
                      <td>
                        {c.label}
                        {c.note ? ` (${c.note})` : ''}
                      </td>
                      <td className="r num">{formatIDR(c.amount)}</td>
                      <td className="r num">{formatPercent((c.amount / Math.max(1, printProject.restoration_cost)) * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : (
          <>
            <section className="print-report__section">
              <h2>1. Ringkasan Posisi Dana Klaster Loa Kulu</h2>
              <div className="print-kpis">
                <div>
                  <small>Target Anggaran</small>
                  <strong className="num">{formatIDR(tr.target)}</strong>
                </div>
                <div>
                  <small>Dana Terkumpul</small>
                  <strong className="num">{formatIDR(tr.collected)}</strong>
                </div>
                <div>
                  <small>Dana Digunakan</small>
                  <strong className="num">{formatIDR(tr.spent)}</strong>
                </div>
                <div>
                  <small>Sisa Dana</small>
                  <strong className="num">{formatIDR(tr.remaining)}</strong>
                </div>
              </div>
            </section>

            <section className="print-report__section">
              <h2>2. Tabel Realisasi per Program</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Kode &amp; Program</th>
                    <th>Tahap</th>
                    <th className="r">Target</th>
                    <th className="r">Terkumpul</th>
                    <th className="r">Digunakan</th>
                    <th className="r">Bibit Tertanam</th>
                  </tr>
                </thead>
                <tbody>
                  {tr.rows.map((r) => (
                    <tr key={r.project.id}>
                      <td>
                        <b>{r.project.id}</b> · {r.project.short_name}
                      </td>
                      <td>{r.stage}</td>
                      <td className="r num">{formatIDRShort(r.project.funding_target)}</td>
                      <td className="r num">{formatIDRShort(r.project.funding_collected)}</td>
                      <td className="r num">{formatIDRShort(r.spent)}</td>
                      <td className="r num">
                        {formatNumber(r.seedlings_planted)} / {formatNumber(r.project.total_seedlings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="print-report__section">
              <h2>3. Alokasi Dana Terpakai menurut Pos Biaya</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Pos Biaya</th>
                    <th className="r">Realisasi</th>
                    <th className="r">Persentase</th>
                  </tr>
                </thead>
                <tbody>
                  {tr.byCategory.map((cat) => (
                    <tr key={cat.label}>
                      <td>{cat.label}</td>
                      <td className="r num">{formatIDR(Math.round(cat.value))}</td>
                      <td className="r num">{formatPercent((cat.value / Math.max(1, tr.spent)) * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        <section className="print-report__section">
          <h2>{printProject ? '3' : '4'}. Dokumentasi Kegiatan Lapangan</h2>
          <div className="print-photos">
            {printPhotos.map((ph) => (
              <figure key={ph.id} className="print-photos__item">
                <img src={assetUrl(ph.image_url)} alt={ph.caption} />
                <figcaption>
                  <b>[{ph.stage}]</b> {ph.caption} — {ph.location} ({formatDate(ph.date)})
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <footer className="print-report__foot">
          Dokumen ini dihasilkan oleh prototipe {SITE.name} pada {printedDate}. Angka pendanaan, realisasi, dan foto kegiatan bersifat ilustrasi prototipe dan bukan laporan keuangan resmi teraudit.
        </footer>
      </article>
    </PublicLayout>
  );
}
