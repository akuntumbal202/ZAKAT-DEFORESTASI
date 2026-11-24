import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { PublicLayout } from '../../layouts/PublicLayout';
import { useStore } from '../../store/AppStore';
import { to, useRouter } from '../../router/router';
import { getAllPolygonAttributes, getPolygonAttribute } from '../../services/spatialService';
import { CATEGORY_LABEL } from '../../services/projectService';
import type { LoaKuluPolygonProps, ProjectView } from '../../types';
import { cx, formatIDRShort, formatNumber } from '../../lib/format';
import { MapView } from '../../map/MapView';
import type { MapMode } from '../../map/LeafletMap';
import { Icon } from '../../components/ui/Icon';
import { Input, Select } from '../../components/ui/Field';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ProgressBar } from '../../components/ui/Feedback';
import { ProgramEditorModal } from '../../components/admin/ProgramEditorModal';

type AdminFilter = 'all' | 'non-program' | 'draft' | 'published' | 'kelas-1';
type AdminSort = 'votes-desc' | 'luas-desc' | 'slope-desc';

export function AdminWorkspacePage() {
  const {
    state,
    allProjects,
    projects,
    nominations,
    setPublicationStatus,
    exportConfigJson,
    importConfigJson,
    resetDemo,
    toast,
  } = useStore();
  const { route, navigate } = useRouter();
  const allPolygons = useMemo(() => getAllPolygonAttributes(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<MapMode>('all-deforestation');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<AdminFilter>('all');
  const [sort, setSort] = useState<AdminSort>('votes-desc');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const selectedCode = route.param ?? null;

  const projectsByCode = useMemo(() => {
    const m = new Map<string, ProjectView>();
    allProjects.forEach((p) => m.set(p.polygon_code || p.id, p));
    return m;
  }, [allProjects]);

  const draftCount = allProjects.filter((p) => p.publication_status === 'draft').length;
  const totalVotes = Object.values(nominations).reduce((s, n) => s + n, 0);
  const totalHa = useMemo(() => allPolygons.reduce((s, p) => s + p.luas_ha, 0), [allPolygons]);

  const queue = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...allPolygons]
      .filter((poly) => {
        const proj = projectsByCode.get(poly.lk_code);
        if (mode === 'programs' && !proj) return false;
        if (filter === 'non-program' && proj) return false;
        if (filter === 'draft' && proj?.publication_status !== 'draft') return false;
        if (filter === 'published' && proj?.publication_status !== 'published') return false;
        if (filter === 'kelas-1' && poly.kelas_id !== 1) return false;
        if (!term) return true;
        return [poly.lk_code, poly.id, poly.tanah_dom, proj?.name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (sort === 'votes-desc') {
          return (nominations[b.lk_code] ?? 0) - (nominations[a.lk_code] ?? 0) || b.luas_ha - a.luas_ha;
        }
        if (sort === 'slope-desc') return b.slope_med - a.slope_med;
        return b.luas_ha - a.luas_ha;
      });
  }, [allPolygons, projectsByCode, mode, filter, sort, q, nominations]);

  const visibleCodes = useMemo(() => queue.map((p) => p.lk_code), [queue]);
  const selectedPoly = selectedCode ? getPolygonAttribute(selectedCode) : null;
  const selectedProj = selectedCode ? projectsByCode.get(selectedCode) : undefined;
  const editingPoly = editingCode ? getPolygonAttribute(editingCode) : null;
  const editingProj = editingCode ? projectsByCode.get(editingCode) : undefined;

  const select = (code: string | null) =>
    navigate(code ? to.adminMap(code) : to.admin(), { replace: true, keepScroll: true });

  const handleExport = () => {
    const json = exportConfigJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rimbun-loakulu-kurasi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Konfigurasi program Admin berhasil diekspor ke JSON.');
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importConfigJson(text);
    if (!res.ok) toast(res.error ?? 'Gagal impor JSON.', 'warn');
    e.target.value = '';
  };

  if (state.user?.role !== 'admin') {
    return (
      <PublicLayout>
        <div className="container section">
          <EmptyState
            icon="shield"
            title="Akses khusus Admin Kurator"
            body="Masuk menggunakan Akun Demo Admin Kurator di halaman Masuk untuk mengkurasi poligon Loa Kulu dan mempublikasikan program."
            action={
              <Button to={to.login()} icon="arrow-right">
                Ke halaman Masuk
              </Button>
            }
          />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout noFooter wideNav>
      <div className="admin-shell">
        {/* Top Admin Control Bar */}
        <header className="admin-bar">
          <div className="admin-bar__title">
            <Badge tone="funded">Mode Admin Kurator</Badge>
            <h1>Kurasi Poligon &amp; Program Loa Kulu</h1>
          </div>
          <div className="admin-bar__kpis num">
            <div>
              <small>Total Poligon</small>
              <b>{allPolygons.length} ({formatNumber(Math.round(totalHa))} ha)</b>
            </div>
            <div>
              <small>Published</small>
              <b>{projects.length}</b>
            </div>
            <div>
              <small>Draft</small>
              <b>{draftCount}</b>
            </div>
            <div>
              <small>Usulan Publik</small>
              <b>{totalVotes}</b>
            </div>
          </div>
          <div className="admin-bar__actions">
            <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
            <Button size="sm" variant="secondary" icon="download" onClick={handleExport}>
              Export JSON
            </Button>
            <Button size="sm" variant="secondary" icon="upload" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </Button>
            <Button size="sm" variant="ghost" icon="refresh" onClick={resetDemo}>
              Reset
            </Button>
          </div>
        </header>

        {/* Interactive 2-Tab Admin Map Workspace */}
        <div className={cx('explore explore--admin', selectedPoly && 'has-selection')}>
          <section className="explore__panel" aria-label="Antrean kurasi poligon Admin">
            <div className="explore__panel-head">
              <div className="segmented segmented--full" role="tablist" aria-label="Mode peta Admin">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'all-deforestation'}
                  className={cx('segmented__opt', mode === 'all-deforestation' && 'is-active')}
                  onClick={() => setMode('all-deforestation')}
                >
                  Semua Poligon ({allPolygons.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'programs'}
                  className={cx('segmented__opt', mode === 'programs' && 'is-active')}
                  onClick={() => setMode('programs')}
                >
                  Program &amp; Draft ({allProjects.length})
                </button>
              </div>

              <Input
                icon="search"
                type="search"
                placeholder="Cari LK-xxx, nama program, atau tanah…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <div className="two-col two-col--tight">
                <Select aria-label="Filter kurasi" value={filter} onChange={(e) => setFilter(e.target.value as AdminFilter)}>
                  <option value="all">Semua ({allPolygons.length})</option>
                  <option value="non-program">Belum Jadi Program</option>
                  <option value="draft">Draft Admin ({draftCount})</option>
                  <option value="published">Sudah Publish ({projects.length})</option>
                  <option value="kelas-1">Kelas 1 · Lahan Terbuka</option>
                </Select>
                <Select aria-label="Urutkan antrean" value={sort} onChange={(e) => setSort(e.target.value as AdminSort)}>
                  <option value="votes-desc">Usulan publik terbanyak</option>
                  <option value="luas-desc">Luas terbesar</option>
                  <option value="slope-desc">Lereng tercuram</option>
                </Select>
              </div>
            </div>

            <div className="explore__list">
              <ul className="xlist">
                {queue.map((poly: LoaKuluPolygonProps) => {
                  const proj = projectsByCode.get(poly.lk_code);
                  const votes = nominations[poly.lk_code] ?? 0;
                  const active = selectedCode === poly.lk_code;
                  return (
                    <li key={poly.lk_code}>
                      <button
                        type="button"
                        className={cx('xitem', active && 'is-active')}
                        onClick={() => select(active ? null : poly.lk_code)}
                      >
                        <span
                          className={cx(
                            'xitem__swatch',
                            proj?.publication_status === 'published'
                              ? 'tone-forest'
                              : proj?.publication_status === 'draft'
                                ? 'tone-ochre'
                                : 'tone-clay',
                          )}
                          aria-hidden
                        />
                        <span className="xitem__main">
                          <span className="xitem__top">
                            <span className="xitem__id num">{poly.lk_code}</span>
                            <span className="xitem__status">
                              {proj
                                ? proj.publication_status === 'published'
                                  ? 'Published'
                                  : 'Draft'
                                : poly.kelas_id === 1
                                  ? 'Belum Program · Terbuka'
                                  : 'Belum Program'}
                            </span>
                          </span>
                          <span className="xitem__name">{proj ? proj.name : `Poligon ${poly.id}`}</span>
                          <span className="xitem__meta">
                            <span className="num">{formatNumber(poly.luas_ha)} ha</span> · Lereng{' '}
                            <span className="num">{poly.slope_med.toFixed(1)}°</span>
                            {votes > 0 && ` · ${votes} usulan`}
                          </span>
                        </span>
                        <Icon name="chevron-right" size={18} className="xitem__chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <div className="explore__map">
            <MapView
              mode={mode}
              includeDrafts
              selectedId={selectedCode}
              visibleIds={visibleCodes}
              projectsByCode={projectsByCode}
              onSelect={(code) => select(code)}
            />
          </div>

          {selectedPoly && (
            <>
              <div className="explore__scrim" onClick={() => select(null)} aria-hidden />
              <div className="explore__detail">
                <aside className={cx('psidebar', sheetExpanded && 'is-expanded')} aria-label={`Kurasi Admin ${selectedPoly.lk_code}`}>
                  <button
                    type="button"
                    className="psidebar__grab"
                    onClick={() => setSheetExpanded((e) => !e)}
                    aria-label={sheetExpanded ? 'Perkecil panel' : 'Perbesar panel'}
                  >
                    <span />
                  </button>
                  <header className="psidebar__head">
                    <div className="psidebar__head-top">
                      <span className="psidebar__id num">
                        <Icon name="polygon" size={14} /> {selectedPoly.lk_code} · Admin Inspector
                      </span>
                      <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Tutup">
                        <Icon name="x" />
                      </button>
                    </div>
                    <h2 className="psidebar__title">
                      {selectedProj ? selectedProj.name : `Poligon Deforestasi ${selectedPoly.lk_code}`}
                    </h2>
                    <div className="psidebar__meta">
                      {selectedProj ? (
                        <>
                          <Badge tone={selectedProj.publication_status === 'published' ? 'open' : 'funded'}>
                            {selectedProj.publication_status === 'published' ? 'Published (Tayang di Publik)' : 'Draft (Belum Tayang)'}
                          </Badge>
                          <StatusBadge status={selectedProj.status} />
                        </>
                      ) : (
                        <Badge tone="muted">Belum Dijadikan Program</Badge>
                      )}
                    </div>
                  </header>

                  <div className="psidebar__scroll">
                    <div className="raw-summary">
                      <div className="raw-summary__kpis">
                        <div>
                          <span>Luas poligon</span>
                          <b className="num">{formatNumber(selectedPoly.luas_ha)} ha</b>
                        </div>
                        <div>
                          <span>Usulan publik</span>
                          <b className="num">{nominations[selectedPoly.lk_code] ?? 0} suara</b>
                        </div>
                      </div>

                      <dl className="kv kv--grid">
                        <div>
                          <dt>Elevasi</dt>
                          <dd className="num">{selectedPoly.elev_med.toFixed(1)} m (Δ {selectedPoly.elev_rng.toFixed(1)})</dd>
                        </div>
                        <div>
                          <dt>Lereng</dt>
                          <dd className="num">{selectedPoly.slope_med.toFixed(1)}° (P90 {selectedPoly.slope_p90.toFixed(1)}°)</dd>
                        </div>
                        <div>
                          <dt>Curah hujan</dt>
                          <dd className="num">{Math.round(selectedPoly.rain_mean)} mm/th</dd>
                        </div>
                        <div>
                          <dt>Tanah</dt>
                          <dd>{selectedPoly.tanah_dom}</dd>
                        </div>
                      </dl>

                      {selectedProj ? (
                        <div className="panel">
                          <div className="h-row">
                            <b className="small">Ringkasan Program</b>
                            <span className="num small">{CATEGORY_LABEL[selectedProj.category]}</span>
                          </div>
                          <p className="small muted">{selectedProj.summary}</p>
                          <ProgressBar value={selectedProj.funding_percentage} size="sm" />
                          <div className="h-row small num">
                            <span>Terkumpul {formatIDRShort(selectedProj.funding_collected)}</span>
                            <span>Target {formatIDRShort(selectedProj.funding_target)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="small muted">
                          Klik tombol <b>Kurasi &amp; Jadikan Program</b> di bawah untuk mengisi target dana, rekomendasi tanaman, dan narasi program secara otomatis maupun manual.
                        </p>
                      )}
                    </div>
                  </div>

                  <footer className="psidebar__foot admin-inspector-foot">
                    <Button
                      variant="primary"
                      icon={selectedProj ? 'edit' : 'plus-circle'}
                      onClick={() => setEditingCode(selectedPoly.lk_code)}
                      className="psidebar__fullbtn"
                    >
                      {selectedProj ? 'Edit Program' : 'Kurasi & Jadikan Program'}
                    </Button>
                    {selectedProj && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const next = selectedProj.publication_status === 'published' ? 'draft' : 'published';
                          setPublicationStatus(selectedProj.id, next);
                          toast(
                            next === 'published'
                              ? `${selectedProj.polygon_code} dipublikasikan ke Publik.`
                              : `${selectedProj.polygon_code} ditarik kembali ke Draft.`,
                            'info',
                          );
                        }}
                      >
                        {selectedProj.publication_status === 'published' ? 'Unpublish' : 'Publish'}
                      </Button>
                    )}
                  </footer>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      <ProgramEditorModal
        open={Boolean(editingCode)}
        polygon={editingPoly}
        existing={editingProj}
        onClose={() => setEditingCode(null)}
        onSaved={(saved) => select(saved.polygon_code)}
      />
    </PublicLayout>
  );
}
