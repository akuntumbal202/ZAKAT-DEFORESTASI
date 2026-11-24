import { useEffect, useMemo, useState } from 'react';
import { PublicLayout } from '../layouts/PublicLayout';
import { useStore } from '../store/AppStore';
import { to, useRouter } from '../router/router';
import { CATEGORY_LABEL, STATUS_META } from '../services/projectService';
import { getAllPolygonAttributes, getPolygonAttribute } from '../services/spatialService';
import type { LoaKuluPolygonProps, ProjectStatus, ProjectView, RestorationProject } from '../types';
import { cx, formatIDRShort, formatNumber } from '../lib/format';
import { MapView } from '../map/MapView';
import type { MapMode } from '../map/LeafletMap';
import { Icon } from '../components/ui/Icon';
import { Input, Select } from '../components/ui/Field';
import { EmptyState, ProgressBar } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { ProjectDetailSidebar } from '../components/project/ProjectDetailSidebar';
import { RawPolygonSidebar } from '../components/project/RawPolygonSidebar';

type StatusFilter = 'all' | 'active' | ProjectStatus;
type RawFilter = 'all' | 'non-program' | 'program' | 'kelas-1' | 'kelas-2';
type RawSort = 'luas-desc' | 'slope-desc' | 'votes-desc';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Butuh dana' },
  { value: 'urgent', label: 'Mendesak' },
  { value: 'planting', label: 'Penanaman' },
  { value: 'monitoring', label: 'Monitoring' },
];

export function matchesStatus(p: ProjectView, f: StatusFilter) {
  if (f === 'all') return true;
  if (f === 'active') return p.status === 'open' || p.status === 'urgent';
  return p.status === f;
}

function ProgramListItem({ p, active, onClick }: { p: ProjectView; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={cx('xitem', active && 'is-active')} onClick={onClick} aria-pressed={active}>
        <span
          className={cx(
            'xitem__swatch',
            `tone-${p.status === 'urgent' || p.status === 'open' ? 'clay' : p.status === 'funded' ? 'ochre' : 'forest'}`,
          )}
          aria-hidden
        />
        <span className="xitem__main">
          <span className="xitem__top">
            <span className="xitem__id num">{p.polygon_code}</span>
            <span className="xitem__status">{STATUS_META[p.status].label}</span>
          </span>
          <span className="xitem__name">{p.name}</span>
          <span className="xitem__meta">
            {CATEGORY_LABEL[p.category]} · <span className="num">{p.site ? `${formatNumber(p.site.area_ha)} ha` : '—'}</span>
          </span>
          <span className="xitem__prog">
            <ProgressBar value={p.funding_percentage} size="sm" />
            <span className="num">
              {Math.floor(p.funding_percentage)}% · {formatIDRShort(p.funding_collected)}
            </span>
          </span>
        </span>
        <Icon name="chevron-right" size={18} className="xitem__chev" />
      </button>
    </li>
  );
}

function RawPolygonListItem({
  poly,
  program,
  votes,
  active,
  onClick,
}: {
  poly: LoaKuluPolygonProps;
  program?: ProjectView;
  votes: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className={cx('xitem', active && 'is-active')} onClick={onClick} aria-pressed={active}>
        <span
          className={cx('xitem__swatch', program ? 'tone-forest' : poly.kelas_id === 1 ? 'tone-clay' : 'tone-ochre')}
          aria-hidden
        />
        <span className="xitem__main">
          <span className="xitem__top">
            <span className="xitem__id num">{poly.lk_code}</span>
            <span className={cx('xitem__status', program && 'is-prog')}>
              {program ? 'Program Resmi' : poly.kelas_id === 1 ? 'Lahan Terbuka' : 'Semak / Kebun'}
            </span>
          </span>
          <span className="xitem__name">{program ? program.name : `Poligon ${poly.id}`}</span>
          <span className="xitem__meta">
            <span className="num">{formatNumber(poly.luas_ha)} ha</span> · Lereng{' '}
            <span className="num">{poly.slope_med.toFixed(1)}°</span> · {poly.tanah_dom.split(',')[0]}
          </span>
          {!program && votes > 0 && (
            <span className="xitem__votes num">
              <Icon name="flag" size={11} /> {votes} usulan publik
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={18} className="xitem__chev" />
      </button>
    </li>
  );
}

export function ExploreMapPage() {
  const { projects, getProject, nominations } = useStore();
  const { route, navigate } = useRouter();
  const allPolygons = useMemo(() => getAllPolygonAttributes(), []);

  const [mode, setMode] = useState<MapMode>(() =>
    route.section === 'all' || (route.param && !getProject(route.param)) ? 'all-deforestation' : 'programs',
  );
  useEffect(() => {
    if (route.section === 'all') setMode('all-deforestation');
  }, [route.section]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<'all' | RestorationProject['category']>('all');
  const [rawFilter, setRawFilter] = useState<RawFilter>('all');
  const [rawSort, setRawSort] = useState<RawSort>('luas-desc');

  const selectedCode = route.param ?? null;
  const selectedProgram = selectedCode ? getProject(selectedCode) : undefined;
  const selectedRaw = selectedCode ? getPolygonAttribute(selectedCode) : null;

  const projectsByCode = useMemo(() => {
    const m = new Map<string, ProjectView>();
    projects.forEach((p) => m.set(p.polygon_code || p.id, p));
    return m;
  }, [projects]);

  const filteredPrograms = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter(
      (p) =>
        matchesStatus(p, status) &&
        (category === 'all' || p.category === category) &&
        (!term ||
          [p.name, p.id, p.polygon_code, p.summary, p.site?.soil.type ?? '', ...p.tags]
            .join(' ')
            .toLowerCase()
            .includes(term)),
    );
  }, [projects, q, status, category]);

  const filteredRaw = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...allPolygons]
      .filter((poly) => {
        const isProg = projectsByCode.has(poly.lk_code);
        if (rawFilter === 'program' && !isProg) return false;
        if (rawFilter === 'non-program' && isProg) return false;
        if (rawFilter === 'kelas-1' && poly.kelas_id !== 1) return false;
        if (rawFilter === 'kelas-2' && poly.kelas_id !== 2) return false;
        if (!term) return true;
        const prog = projectsByCode.get(poly.lk_code);
        return [poly.lk_code, poly.id, poly.tanah_dom, prog?.name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (rawSort === 'slope-desc') return b.slope_med - a.slope_med;
        if (rawSort === 'votes-desc') return (nominations[b.lk_code] ?? 0) - (nominations[a.lk_code] ?? 0) || b.luas_ha - a.luas_ha;
        return b.luas_ha - a.luas_ha;
      });
  }, [allPolygons, projectsByCode, rawFilter, rawSort, q, nominations]);

  const visibleCodes = useMemo(() => {
    if (mode === 'programs') return filteredPrograms.map((p) => p.polygon_code || p.id);
    return filteredRaw.map((p) => p.lk_code);
  }, [mode, filteredPrograms, filteredRaw]);

  const select = (code: string | null) =>
    navigate(code ? to.explore(code) : to.explore(), { replace: true, keepScroll: true });

  const hasSelection = Boolean(selectedProgram || (mode === 'all-deforestation' && selectedRaw));

  const switchMode = (nextMode: MapMode) => {
    setMode(nextMode);
    if (nextMode === 'programs' && selectedCode && !projectsByCode.has(selectedCode)) {
      select(null);
    }
  };

  const reset = () => {
    setQ('');
    setStatus('all');
    setCategory('all');
    setRawFilter('all');
  };

  return (
    <PublicLayout noFooter wideNav>
      <div className={cx('explore', hasSelection && 'has-selection')}>
        <section className="explore__panel" aria-label="Pencarian dan daftar lokasi">
          <div className="explore__panel-head">
            <div className="explore__title-row">
              <h1>Peta Loa Kulu</h1>
              <span className="explore__count num" aria-live="polite">
                {mode === 'programs' ? `${filteredPrograms.length} program` : `${filteredRaw.length} / ${allPolygons.length} poligon`}
              </span>
            </div>

            {/* 2-Tab Map Switcher */}
            <div className="segmented segmented--full" role="tablist" aria-label="Pilih mode peta">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'programs'}
                className={cx('segmented__opt', mode === 'programs' && 'is-active')}
                onClick={() => switchMode('programs')}
              >
                Peta Program ({projects.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'all-deforestation'}
                className={cx('segmented__opt', mode === 'all-deforestation' && 'is-active')}
                onClick={() => switchMode('all-deforestation')}
              >
                Seluruh Deforestasi ({allPolygons.length})
              </button>
            </div>

            <Input
              icon="search"
              placeholder={mode === 'programs' ? 'Cari nama program, LK-xxx, tanah…' : 'Cari LK-xxx, ID GEE, jenis tanah…'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari lokasi"
              type="search"
            />

            {mode === 'programs' ? (
              <>
                <div className="explore__filters" role="radiogroup" aria-label="Filter status program">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      type="button"
                      key={f.value}
                      role="radio"
                      aria-checked={status === f.value}
                      className={cx('chip-btn', status === f.value && 'is-active')}
                      onClick={() => setStatus(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Select aria-label="Filter kategori" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                  <option value="all">Semua kategori ekosistem</option>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </>
            ) : (
              <div className="two-col two-col--tight">
                <Select aria-label="Filter poligon deforestasi" value={rawFilter} onChange={(e) => setRawFilter(e.target.value as RawFilter)}>
                  <option value="all">Semua ({allPolygons.length})</option>
                  <option value="non-program">Belum Program</option>
                  <option value="program">Sudah Jadi Program</option>
                  <option value="kelas-1">Kelas 1 · Terbuka</option>
                  <option value="kelas-2">Kelas 2 · Semak</option>
                </Select>
                <Select aria-label="Urutkan poligon" value={rawSort} onChange={(e) => setRawSort(e.target.value as RawSort)}>
                  <option value="luas-desc">Luas terbesar</option>
                  <option value="slope-desc">Lereng tercuram</option>
                  <option value="votes-desc">Usulan terbanyak</option>
                </Select>
              </div>
            )}
          </div>

          <div className="explore__list">
            {mode === 'programs' ? (
              filteredPrograms.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="Tidak ada program yang cocok"
                  body="Coba ubah filter atau lihat tab Seluruh Deforestasi untuk mengusulkan lokasi baru."
                  action={
                    <Button size="sm" variant="secondary" icon="refresh" onClick={reset}>
                      Reset filter
                    </Button>
                  }
                />
              ) : (
                <ul className="xlist">
                  {filteredPrograms.map((p) => (
                    <ProgramListItem
                      key={p.id}
                      p={p}
                      active={selectedCode === p.polygon_code}
                      onClick={() => select(selectedCode === p.polygon_code ? null : p.polygon_code)}
                    />
                  ))}
                </ul>
              )
            ) : filteredRaw.length === 0 ? (
              <EmptyState
                icon="search"
                title="Tidak ada poligon yang cocok"
                body="Ubah kata kunci atau filter kelas poligon."
                action={
                  <Button size="sm" variant="secondary" icon="refresh" onClick={reset}>
                    Reset filter
                  </Button>
                }
              />
            ) : (
              <ul className="xlist">
                {filteredRaw.map((poly) => (
                  <RawPolygonListItem
                    key={poly.lk_code}
                    poly={poly}
                    program={projectsByCode.get(poly.lk_code)}
                    votes={nominations[poly.lk_code] ?? 0}
                    active={selectedCode === poly.lk_code}
                    onClick={() => select(selectedCode === poly.lk_code ? null : poly.lk_code)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="explore__map">
          <MapView
            mode={mode}
            selectedId={selectedCode}
            visibleIds={visibleCodes}
            projectsByCode={projectsByCode}
            onSelect={(code) => select(code)}
          />
        </div>

        {hasSelection && (
          <>
            <div className="explore__scrim" onClick={() => select(null)} aria-hidden />
            <div className="explore__detail">
              {selectedProgram ? (
                <ProjectDetailSidebar
                  key={selectedProgram.id}
                  project={selectedProgram}
                  contextNote={mode === 'all-deforestation' ? 'Poligon ini telah dikurasi menjadi Program Reboisasi resmi.' : undefined}
                  onClose={() => select(null)}
                />
              ) : selectedRaw ? (
                <RawPolygonSidebar
                  key={selectedRaw.lk_code}
                  polygon={selectedRaw}
                  onClose={() => select(null)}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
