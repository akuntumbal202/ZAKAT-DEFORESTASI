import { useEffect, useMemo, useState } from 'react';
import { PublicLayout } from '../layouts/PublicLayout';
import { useStore } from '../store/AppStore';
import { useGatedActions } from '../store/actions';
import { Link, to, useRouter } from '../router/router';
import { CATEGORY_LABEL, isAcceptingDonations } from '../services/projectService';
import { formatDate, formatIDR, formatIDRShort, formatNumber, formatPercent } from '../lib/format';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Badge, Illustrative, StatusBadge } from '../components/ui/Badge';
import { Callout, EmptyState } from '../components/ui/Feedback';
import { SiteVisual } from '../components/project/SiteVisual';
import { DonationProgress } from '../components/project/DonationProgress';
import { SaveButton } from '../components/project/ProjectCard';
import { SpeciesCard } from '../components/project/SpeciesCard';
import { BarList } from '../components/charts/Charts';
import { EnvironmentalImpactCalculator } from '../components/impact/EnvironmentalImpactCalculator';
import { MapView } from '../map/MapView';
import type { ProjectView } from '../types';

type Tab = 'overview' | 'plan' | 'funding' | 'impact';

function FundingCard({ project, onTab }: { project: ProjectView; onTab: (t: Tab) => void }) {
  const { donate } = useGatedActions();
  const { toast } = useStore();
  const accepting = isAcceptingDonations(project);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#${to.program(project.id)}`);
      toast('Tautan program disalin.');
    } catch {
      toast('Tidak bisa menyalin di peramban ini.', 'warn');
    }
  };
  return (
    <div className="fundcard">
      <div className="fundcard__head">
        <span className="eyebrow">Pendanaan</span>
        <Illustrative label="Simulasi" />
      </div>
      <DonationProgress project={project} variant="full" />
      {accepting ? (
        <Button size="lg" block icon="sprout" onClick={() => donate(project.id)}>
          Donasi ke lokasi ini
        </Button>
      ) : (
        <Callout tone="info" title={project.publication_status === 'draft' ? 'Status Draft Admin' : 'Pendanaan terpenuhi'}>
          {project.publication_status === 'draft'
            ? 'Program ini masih berstatus Draft dan belum dibuka untuk donasi publik.'
            : 'Program ini tidak lagi menerima donasi. Ikuti progresnya di tab Pendanaan atau halaman Transparansi.'}
        </Callout>
      )}
      <div className="fundcard__row">
        <SaveButton projectId={project.id} variant="full" />
        <Button variant="secondary" icon="copy" onClick={copy}>
          Salin tautan
        </Button>
      </div>
      <button type="button" className="fundcard__link" onClick={() => onTab('impact')}>
        <Icon name="calculator" size={16} /> Hitung estimasi dampak donasimu
        <Icon name="arrow-right" size={16} />
      </button>
    </div>
  );
}

export function ProjectDetailPage() {
  const { route } = useRouter();
  const { getProject, getProjectAnyStatus, state } = useStore();
  const { donate } = useGatedActions();
  const isAdmin = state.user?.role === 'admin';
  const project = isAdmin ? getProjectAnyStatus(route.param) : getProject(route.param);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => setTab('overview'), [route.param]);

  const miniMapProjects = useMemo(() => {
    const m = new Map<string, ProjectView>();
    if (project) m.set(project.polygon_code || project.id, project);
    return m;
  }, [project]);

  if (!project) {
    return (
      <PublicLayout>
        <div className="container section">
          <EmptyState
            icon="polygon"
            title="Program tidak ditemukan"
            body={`Tidak ada program publik dengan ID “${route.param ?? ''}”. Mungkin masih berstatus Draft atau tautannya keliru.`}
            action={
              <Button to={to.programs()} variant="secondary">
                Lihat semua program
              </Button>
            }
          />
        </div>
      </PublicLayout>
    );
  }

  const site = project.site;
  const accepting = isAcceptingDonations(project);
  const recent = state.donations.filter((d) => d.project_id === project.id).slice(0, 5);
  const switchTab = (t: Tab) => {
    setTab(t);
    document.getElementById('detail-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PublicLayout wideNav>
      <div className="detail">
        <div className="container container--wide">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to={to.programs()}>Program</Link>
            <Icon name="chevron-right" size={14} />
            <span aria-current="page">{project.name}</span>
          </nav>

          <header className="detail__head">
            <div className="detail__meta">
              <StatusBadge status={project.status} />
              {project.publication_status === 'draft' && <Badge tone="funded">Draft Admin</Badge>}
              <span className="detail__id num">
                <Icon name="polygon" size={14} /> {project.polygon_code || project.id}
              </span>
              <span>{CATEGORY_LABEL[project.category]}</span>
              <span>{site?.region_label}</span>
            </div>
            <h1 className="detail__title">{project.name}</h1>
            <p className="detail__lead">{project.summary}</p>
          </header>

          <div className="detail__gallery">
            <SiteVisual seed={project.visual_seed} category={project.category} imageUrl={project.image_url} alt={project.name} ratio="auto" className="detail__visual" />
            <div className="detail__mini-map">
              <MapView
                compact
                mode="programs"
                includeDrafts={isAdmin}
                selectedId={project.polygon_code || project.id}
                visibleIds={[project.polygon_code || project.id]}
                projectsByCode={miniMapProjects}
                onSelect={() => {}}
              />
              <Link to={to.explore(project.polygon_code || project.id)} className="detail__map-link">
                <Icon name="map" size={15} /> Buka di Explore Map
              </Link>
            </div>
            <dl className="detail__facts">
              <div>
                <dt>Luas poligon</dt>
                <dd className="num">{site ? `${formatNumber(site.area_ha)} ha` : '—'}</dd>
              </div>
              <div>
                <dt>Bibit dibutuhkan</dt>
                <dd className="num">{formatNumber(project.total_seedlings)}</dd>
              </div>
              <div>
                <dt>Kebutuhan biaya</dt>
                <dd className="num">{formatIDRShort(project.restoration_cost)}</dd>
              </div>
              <div>
                <dt>Dimulai</dt>
                <dd>{formatDate(project.started_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="detail__layout">
            <div className="detail__main">
              <div id="detail-tabs" className="detail__tabs">
                <Tabs
                  idPrefix="pd"
                  value={tab}
                  onChange={setTab}
                  items={[
                    { id: 'overview', label: 'Overview', icon: 'info' },
                    { id: 'plan', label: 'Rencana Restorasi', icon: 'sprout' },
                    { id: 'funding', label: 'Pendanaan', icon: 'wallet' },
                    { id: 'impact', label: 'Dampak Lingkungan', icon: 'cloud' },
                  ]}
                />
              </div>

              <div className="detail__panel page-enter" key={tab} role="tabpanel" id={`pd-panel-${tab}`} aria-labelledby={`pd-tab-${tab}`}>
                {tab === 'overview' && (
                  <div className="stack-lg">
                    <section>
                      <h2 className="h-sec">Tentang lokasi</h2>
                      <p className="prose">{project.description}</p>
                    </section>
                    <div className="two-col">
                      <section className="panel">
                        <h3 className="h-sub">
                          <Icon name="alert" size={17} /> Kondisi deforestasi
                        </h3>
                        <p>{project.condition_summary}</p>
                        {site && (
                          <div className="cover-change">
                            <div>
                              <small>Tutupan 2020</small>
                              <b>{site.land_cover_before}</b>
                            </div>
                            <Icon name="arrow-right" size={18} />
                            <div>
                              <small>Tutupan 2025</small>
                              <b>{site.land_cover_now}</b>
                            </div>
                          </div>
                        )}
                        {site && (
                          <p className="small muted">
                            Indikasi gangguan: <b>{site.disturbance}</b>
                          </p>
                        )}
                      </section>
                      <section className="panel">
                        <h3 className="h-sub">
                          <Icon name="sprout" size={17} /> Kebutuhan rehabilitasi
                        </h3>
                        <p>{project.rehab_needs}</p>
                        <ul className="chips">
                          {project.tags.map((t) => (
                            <li key={t} className="chip">
                              {t}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                    <section>
                      <h2 className="h-sec">Status &amp; pembaruan program</h2>
                      <ol className="timeline">
                        {project.updates.map((u) => (
                          <li key={u.date + u.title}>
                            <span className="timeline__date">{formatDate(u.date)}</span>
                            <div>
                              <b>{u.title}</b>
                              <p>{u.body}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                    <Callout tone="info" icon="database" title="Atribut spasial aktual Loa Kulu">
                      Luas ({site ? `${formatNumber(site.area_ha)} ha` : '—'}), elevasi, kelerengan, curah hujan, dan jenis tanah bersumber dari poligon analisis spasial Loa Kulu (GEE ID: {site?.geometry_reference ?? '—'}).
                    </Callout>
                  </div>
                )}

                {tab === 'plan' && (
                  <div className="stack-lg">
                    {site && (
                      <section>
                        <h2 className="h-sec">Karakteristik fisik lingkungan</h2>
                        <div className="envgrid">
                          <div className="env">
                            <Icon name="rain" />
                            <span className="env__k">Iklim &amp; Hujan</span>
                            <b>{site.climate.type}</b>
                            <small>
                              Curah hujan {site.climate.rainfall_mm_year} mm/th · {site.climate.temperature_c} °C
                            </small>
                          </div>
                          <div className="env">
                            <Icon name="layers" />
                            <span className="env__k">Tanah Dominan</span>
                            <b>{site.soil.type}</b>
                            <small>
                              pH {site.soil.ph} · drainase {site.soil.drainage.toLowerCase()}
                            </small>
                          </div>
                          <div className="env">
                            <Icon name="mountain" />
                            <span className="env__k">Topografi &amp; Lereng</span>
                            <b>{site.slope.class}</b>
                            <small>
                              {site.slope.range_pct} · elevasi {site.elevation_m}
                            </small>
                          </div>
                          <div className="env">
                            <Icon name="info" />
                            <span className="env__k">Catatan Spasial</span>
                            <ul>
                              {site.other_notes.map((n) => (
                                <li key={n}>{n}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </section>
                    )}
                    <section>
                      <div className="h-row">
                        <h2 className="h-sec">Rekomendasi spesies tanaman</h2>
                        <span className="h-row__aside num">
                          Total <b>{formatNumber(project.total_seedlings)}</b> bibit
                        </span>
                      </div>
                      <Callout tone="sim" title="Katalog tanaman placeholder (modular)">
                        Rekomendasi dan kriteria spesies di bawah ini masih berlabel placeholder agar tampilan dan alur kurasi Admin dapat diuji sembari menunggu daftar tanaman final.
                      </Callout>
                      <div className="species-list">
                        {project.recommended_species.map((r) => (
                          <SpeciesCard key={r.species_id} rec={r} share={r.seedlings / project.total_seedlings} />
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {tab === 'funding' && (
                  <div className="stack-lg">
                    <section className="fund-kpis">
                      <div>
                        <span>Total estimasi kebutuhan</span>
                        <b className="num">{formatIDR(project.restoration_cost)}</b>
                      </div>
                      <div>
                        <span>Target pendanaan</span>
                        <b className="num">{formatIDR(project.funding_target)}</b>
                      </div>
                      <div>
                        <span>Dana terkumpul</span>
                        <b className="num">{formatIDR(project.funding_collected)}</b>
                      </div>
                      <div className="is-accent">
                        <span>Sisa kebutuhan</span>
                        <b className="num">{formatIDR(project.funding_remaining)}</b>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="h-row">
                        <h3 className="h-sub">Progres pendanaan</h3>
                        <b className="num big-pct">{project.funding_percentage.toFixed(1).replace('.', ',')}%</b>
                      </div>
                      <div className="progress progress--lg" role="progressbar" aria-valuenow={Math.round(project.funding_percentage)} aria-valuemin={0} aria-valuemax={100} aria-label="Progres pendanaan">
                        <span className="progress__fill" style={{ width: `${Math.min(100, project.funding_percentage)}%` }} />
                      </div>
                      <div className="h-row small muted">
                        <span>{formatNumber(project.donor_count)} donatur</span>
                        <span>Biaya per bibit (all-in) ≈ {formatIDR(project.cost_per_seedling)}</span>
                      </div>
                    </section>
                    <section>
                      <div className="h-row">
                        <h2 className="h-sec">Rincian estimasi biaya</h2>
                        <Illustrative />
                      </div>
                      <div className="two-col two-col--wide-left">
                        <div className="table-wrap">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Komponen</th>
                                <th className="r">Estimasi</th>
                                <th className="r">Porsi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {project.cost_breakdown.map((c) => (
                                <tr key={c.label}>
                                  <td>
                                    {c.label}
                                    {c.note && <small className="muted"> · {c.note}</small>}
                                  </td>
                                  <td className="r num">{formatIDR(c.amount)}</td>
                                  <td className="r num">{formatPercent((c.amount / project.restoration_cost) * 100)}</td>
                                </tr>
                              ))}
                              <tr className="is-hl">
                                <td>Total</td>
                                <td className="r num">{formatIDR(project.restoration_cost)}</td>
                                <td className="r num">100%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="panel">
                          <BarList items={project.cost_breakdown.map((c) => ({ label: c.label, value: c.amount }))} format={formatIDRShort} />
                        </div>
                      </div>
                    </section>
                    <section>
                      <h2 className="h-sec">Donasi terbaru di sesi ini</h2>
                      {recent.length ? (
                        <ul className="donor-list">
                          {recent.map((d) => (
                            <li key={d.id}>
                              <span className="avatar">{d.anonymous ? 'HA' : d.display_name.slice(0, 2).toUpperCase()}</span>
                              <div>
                                <b>{d.anonymous ? 'Hamba Allah' : d.display_name}</b>
                                {d.message && <p>“{d.message}”</p>}
                              </div>
                              <span className="num">{formatIDRShort(d.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState icon="users" title="Belum ada donasi simulasi" body="Donasi yang kamu lakukan di prototipe ini akan muncul di sini." />
                      )}
                    </section>
                    {accepting && (
                      <Button size="lg" icon="sprout" onClick={() => donate(project.id)}>
                        Donasi sekarang
                      </Button>
                    )}
                  </div>
                )}

                {tab === 'impact' && (
                  <div className="stack-lg">
                    <section>
                      <h2 className="h-sec">Estimasi dampak lingkungan</h2>
                      <p className="prose muted">Kalkulator ini memakai biaya per bibit dan asumsi keberhasilan hidup program {project.short_name}. Ubah nominal dan periode untuk melihat proyeksinya.</p>
                    </section>
                    <EnvironmentalImpactCalculator fixedProject={project} />
                  </div>
                )}
              </div>
            </div>

            <aside className="detail__aside">
              <FundingCard project={project} onTab={switchTab} />
            </aside>
          </div>
        </div>

        {accepting && (
          <div className="mobile-cta">
            <div>
              <span className="num">{Math.floor(project.funding_percentage)}%</span>
              <small>sisa {formatIDRShort(project.funding_remaining)}</small>
            </div>
            <Button icon="sprout" onClick={() => donate(project.id)}>
              Donasi
            </Button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
