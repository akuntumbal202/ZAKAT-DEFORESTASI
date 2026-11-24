import { useEffect, useMemo, useState } from 'react';
import { PublicLayout } from '../layouts/PublicLayout';
import { PageHeader, PageHeaderVisual } from '../components/StatisticsCard';
import { useStore } from '../store/AppStore';
import { CATEGORY_LABEL, simulateLatency } from '../services/projectService';
import type { ProjectView, RestorationProject } from '../types';
import { cx, formatIDRShort } from '../lib/format';
import { Input, Select } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { ProjectCard, ProjectCardSkeleton } from '../components/project/ProjectCard';
import { matchesStatus } from './ExploreMapPage';
import { Illustrative } from '../components/ui/Badge';

type Sort = 'priority' | 'need-desc' | 'progress-desc' | 'progress-asc' | 'newest';
type StatusFilter = Parameters<typeof matchesStatus>[1];

const SORTERS: Record<Sort, (a: ProjectView, b: ProjectView) => number> = {
  priority: (a, b) => rank(a) - rank(b) || b.funding_remaining - a.funding_remaining,
  'need-desc': (a, b) => b.funding_remaining - a.funding_remaining,
  'progress-desc': (a, b) => b.funding_percentage - a.funding_percentage,
  'progress-asc': (a, b) => a.funding_percentage - b.funding_percentage,
  newest: (a, b) => b.started_at.localeCompare(a.started_at),
};
function rank(p: ProjectView) {
  return { urgent: 0, open: 1, funded: 2, planting: 3, monitoring: 4 }[p.status];
}

export function ProgramsPage() {
  const { projects } = useStore();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<'all' | RestorationProject['category']>('all');
  const [sort, setSort] = useState<Sort>('priority');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    let alive = true;
    simulateLatency(450).then(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects
      .filter((p) => matchesStatus(p, status) && (category === 'all' || p.category === category))
      .filter((p) => !term || [p.name, p.id, p.summary, p.site?.region_label ?? '', ...p.tags].join(' ').toLowerCase().includes(term))
      .sort(SORTERS[sort]);
  }, [projects, q, status, category, sort]);

  const needTotal = list.reduce((s, p) => s + p.funding_remaining, 0);
  const filtersActive = q || status !== 'all' || category !== 'all';

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Program restorasi"
        title="Pilih lokasi yang ingin kamu pulihkan."
        lead="Setiap program terhubung 1:1 dengan poligon deforestasi aktual Kecamatan Loa Kulu beserta rekomendasi bibit dan rincian biaya. Donasimu dialokasikan penuh ke titik pilihanmu."
        aside={
          <PageHeaderVisual
            imageUrl="/images/site-corridor.jpg"
            alt="Koridor rehabilitasi hutan dan lereng Loa Kulu"
            badge={`${projects.length} Program Terpublikasi`}
            caption="Terkurasi dari 163 poligon deforestasi Kecamatan Loa Kulu"
          />
        }
      >
        <p className="phead__meta">
          <Illustrative label="Simulasi pendanaan" /> Parameter lokasi spasial aktual Loa Kulu; target dana &amp; progres bersifat simulasi prototipe.
        </p>
      </PageHeader>

      <section className="container programs">
        <div className="toolbar">
          <Input className="toolbar__search" icon="search" type="search" placeholder="Cari program, ID, atau wilayah…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari program" />
          <Select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Semua status</option>
            <option value="active">Butuh dana</option>
            <option value="urgent">Mendesak</option>
            <option value="funded">Dana terpenuhi</option>
            <option value="planting">Tahap penanaman</option>
            <option value="monitoring">Monitoring</option>
          </Select>
          <Select aria-label="Filter kategori" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            <option value="all">Semua ekosistem</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="priority">Prioritas (mendesak dulu)</option>
            <option value="need-desc">Kebutuhan dana terbesar</option>
            <option value="progress-desc">Progres tertinggi</option>
            <option value="progress-asc">Progres terendah</option>
            <option value="newest">Terbaru</option>
          </Select>
          <div className="toolbar__view" role="radiogroup" aria-label="Tampilan">
            <button role="radio" aria-checked={layout === 'grid'} className={cx(layout === 'grid' && 'is-active')} onClick={() => setLayout('grid')} aria-label="Tampilan grid">
              <Icon name="grid" size={17} />
            </button>
            <button role="radio" aria-checked={layout === 'list'} className={cx(layout === 'list' && 'is-active')} onClick={() => setLayout('list')} aria-label="Tampilan daftar">
              <Icon name="list" size={17} />
            </button>
          </div>
        </div>

        <div className="programs__summary" aria-live="polite">
          {loading ? (
            'Memuat program…'
          ) : (
            <>
              <b>{list.length}</b> program · total kebutuhan tersisa <b className="num">{formatIDRShort(needTotal)}</b>
              {filtersActive && (
                <button
                  className="linklike"
                  onClick={() => {
                    setQ('');
                    setStatus('all');
                    setCategory('all');
                  }}
                >
                  Hapus filter
                </button>
              )}
            </>
          )}
        </div>

        {loading ? (
          <div className={cx('pgrid', layout === 'list' && 'pgrid--list')}>
            {Array.from({ length: 6 }, (_, i) => (
              <ProjectCardSkeleton key={i} layout={layout} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="search"
            title="Belum ada program yang cocok"
            body="Ubah kata kunci atau filter untuk melihat program lain."
            action={
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onClick={() => {
                  setQ('');
                  setStatus('all');
                  setCategory('all');
                }}
              >
                Reset pencarian
              </Button>
            }
          />
        ) : (
          <div className={cx('pgrid', layout === 'list' && 'pgrid--list')}>
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} layout={layout} />
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
