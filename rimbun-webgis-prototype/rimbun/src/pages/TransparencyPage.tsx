import { useMemo, useState } from 'react';
import { PublicLayout } from '../layouts/PublicLayout';
import { PageHeader, PageHeaderVisual, StatisticsCard } from '../components/StatisticsCard';
import { useStore } from '../store/AppStore';
import { transparencyStats, platformStats } from '../services/statsService';
import { REPORTS, FIELD_DOCS } from '../data/mock/transparency';
import { formatDate, formatIDR, formatIDRShort, formatNumber, cx } from '../lib/format';
import { DonutChart, SegmentBar, VBarChart } from '../components/charts/Charts';
import { Callout } from '../components/ui/Feedback';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { Link, to } from '../router/router';
import { Illustrative } from '../components/ui/Badge';
import { SiteVisual } from '../components/project/SiteVisual';
import { ProgressBar } from '../components/ui/Feedback';
import type { ReportDoc } from '../data/mock/transparency';

const STAGES = ['Penggalangan', 'Persiapan', 'Penanaman', 'Pemeliharaan', 'Monitoring'] as const;

export function TransparencyPage() {
  const { projects, getProject } = useStore();
  const tr = useMemo(() => transparencyStats(projects), [projects]);
  const ps = useMemo(() => platformStats(projects), [projects]);
  const [report, setReport] = useState<ReportDoc | null>(null);
  const reportProject = report?.project_id ? getProject(report.project_id) : undefined;
  const reportRow = report?.project_id ? tr.rows.find((r) => r.project.id === report.project_id) : undefined;

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Transparansi & laporan"
        title="Ke mana dana mengalir, dan apa hasilnya."
        lead="Halaman ini memisahkan target anggaran, dana terkumpul, dana yang telah digunakan, dan sisa dana untuk setiap program."
        aside={
          <PageHeaderVisual
            imageUrl="/images/planting-docs.jpg"
            alt="Dokumentasi pembibitan dan penanaman restorasi Loa Kulu"
            badge="Akuntabilitas Prototipe"
            caption={`${Math.round((tr.collected / Math.max(1, tr.target)) * 100)}% dana simulasi terkumpul di ${ps.count} program Loa Kulu`}
          />
        }
      >
        <div className="phead__callout">
          <Callout tone="warn" title="Laporan simulasi">
            Semua angka pada halaman ini adalah data contoh untuk prototipe dan <b>bukan laporan keuangan aktual</b>. Laporan resmi akan diterbitkan bersama mitra pengelola dana.
          </Callout>
        </div>
      </PageHeader>

      <section className="container transp">
        <div className="money4">
          <StatisticsCard icon="target" label="Target anggaran" value={formatIDRShort(tr.target)} note="Total seluruh program" />
          <StatisticsCard icon="wallet" label="Dana terkumpul" value={formatIDRShort(tr.collected)} note={`${Math.round((tr.collected / tr.target) * 100)}% dari target`} tone="forest" />
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
                { label: 'Dialokasikan, belum terpakai', value: tr.allocated - tr.spent, tone: 'moss' },
                { label: 'Terkumpul, belum dialokasikan', value: tr.collected - tr.allocated, tone: 'ochre' },
                { label: 'Kekurangan target', value: tr.target - tr.collected, tone: 'line' },
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
                <dt>Total program terpublikasi</dt>
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
            <h2 className="h-sec">Realisasi & status pelaksanaan per program</h2>
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

        <div className="two-col">
          <section>
            <h2 className="h-sec">Laporan realisasi</h2>
            <ul className="reports">
              {REPORTS.map((r) => (
                <li key={r.id}>
                  <button className="report" onClick={() => setReport(r)}>
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
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="h-sec">Dokumentasi penanaman</h2>
            <div className="docs">
              {FIELD_DOCS.map((d) => {
                const p = getProject(d.project_id);
                return (
                  <figure key={d.id} className="doc">
                    <SiteVisual imageUrl={d.image_url} category={p?.category ?? 'hutan-lahan-kering'} ratio="4/3" label={false} />
                    <figcaption>
                      <b>{d.caption}</b>
                      <small>
                        {p?.short_name} · {formatDate(d.date)}
                      </small>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              <Icon name="image" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Dokumentasi visual representatif untuk prototipe Kecamatan Loa Kulu; foto lapangan aktual diunggah pada fase implementasi.
            </p>
          </section>
        </div>
      </section>

      <Modal open={!!report} onClose={() => setReport(null)} title={report?.title ?? ''} subtitle={`${report?.kind} · ${report?.period} · ${report?.id}`}>
        <div className="sim-banner">
          <Icon name="info" size={15} /> Contoh laporan simulasi, bukan laporan keuangan aktual.
        </div>
        {reportProject && reportRow ? (
          <dl className="summary">
            <div>
              <dt>Program</dt>
              <dd>{reportProject.name}</dd>
            </div>
            <div>
              <dt>Tahap</dt>
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
              <dd className="num">{formatNumber(reportRow.seedlings_planted)}</dd>
            </div>
            <div>
              <dt>Laporan terakhir</dt>
              <dd>{reportRow.last_report ? formatDate(reportRow.last_report) : '—'}</dd>
            </div>
          </dl>
        ) : (
          <dl className="summary">
            <div>
              <dt>Cakupan</dt>
              <dd>Seluruh program</dd>
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
          </dl>
        )}
        <p className="small muted">Versi final akan berupa dokumen PDF yang diterbitkan mitra pengelola dana dan dapat diunduh dari halaman ini.</p>
      </Modal>
    </PublicLayout>
  );
}
