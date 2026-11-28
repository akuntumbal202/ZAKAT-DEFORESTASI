import { useState } from 'react';
import type { ProjectView } from '../../types';
import { cx, formatIDRShort, formatMass, formatNumber } from '../../lib/format';
import { CATEGORY_LABEL, impactContextFor, isAcceptingDonations } from '../../services/projectService';
import { donationToImpact } from '../../lib/impact/impactModel';
import { to } from '../../router/router';
import { useGatedActions } from '../../store/actions';
import { useStore } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { Illustrative, StatusBadge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { Tabs } from '../ui/Tabs';
import { SiteVisual } from './SiteVisual';
import { DonationProgress } from './DonationProgress';
import { SaveButton } from './ProjectCard';

type Tab = 'ringkas' | 'kondisi' | 'dana';

export function ProjectDetailSidebar({
  project,
  onClose,
  contextNote,
}: {
  project: ProjectView;
  onClose: () => void;
  contextNote?: string;
}) {
  const [tab, setTab] = useState<Tab>('ringkas');
  const [expanded, setExpanded] = useState(false);
  const { speciesById } = useStore();
  const { donate } = useGatedActions();
  const site = project.site;
  const accepting = isAcceptingDonations(project);
  const impact = donationToImpact(project.funding_target, 10, impactContextFor(project, speciesById));
  const co2 = formatMass(impact.co2Kg);

  return (
    <aside className={cx('psidebar', expanded && 'is-expanded')} aria-label={`Detail lokasi ${project.name}`}>
      <button type="button" className="psidebar__grab" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Perkecil panel' : 'Perbesar panel'}>
        <span />
      </button>
      <header className="psidebar__head">
        <div className="psidebar__head-top">
          <span className="psidebar__id num">
            <Icon name="polygon" size={14} /> {project.polygon_code || project.id}
          </span>
          <div className="psidebar__head-actions">
            <SaveButton projectId={project.id} />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup panel detail">
              <Icon name="x" />
            </button>
          </div>
        </div>
        <h2 className="psidebar__title">{project.name}</h2>
        <div className="psidebar__meta">
          <StatusBadge status={project.status} />
          <span>{CATEGORY_LABEL[project.category]}</span>
        </div>
        {contextNote && <p className="psidebar__ctx">{contextNote}</p>}
      </header>

      <div className="psidebar__scroll">
        <SiteVisual seed={project.visual_seed} category={project.category} imageUrl={project.image_url} ratio="16/8" />
        <Tabs
          idPrefix="side"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'ringkas', label: 'Ringkasan' },
            { id: 'kondisi', label: 'Kondisi' },
            { id: 'dana', label: 'Pendanaan' },
          ]}
          className="tabs--compact"
        />

        <div className="psidebar__panel" role="tabpanel" id={`side-panel-${tab}`} aria-labelledby={`side-tab-${tab}`}>
          {tab === 'ringkas' && (
            <>
              <p className="psidebar__lead">{project.summary}</p>
              <dl className="kv">
                <div>
                  <dt>Luas poligon</dt>
                  <dd className="num">{site ? `${formatNumber(site.area_ha)} ha` : '—'}</dd>
                </div>
                <div>
                  <dt>Wilayah</dt>
                  <dd>{site?.region_label ?? '—'}</dd>
                </div>
                <div>
                  <dt>Gangguan</dt>
                  <dd>{site?.disturbance ?? '—'}</dd>
                </div>
                <div>
                  <dt>Kebutuhan</dt>
                  <dd>{project.rehab_needs}</dd>
                </div>
              </dl>
              <div className="psidebar__species">
                <span className="eyebrow">Rekomendasi tanaman (SDSS)</span>
                <ul>
                  {project.recommended_species.map((r) => (
                    <li key={r.species_id}>
                      <span>
                        {speciesById[r.species_id]?.local_name ?? r.species_id}
                        <i> {speciesById[r.species_id]?.scientific_name}</i>
                      </span>
                      <span className="num">{formatNumber(r.seedlings)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {tab === 'kondisi' && site && (
            <dl className="kv kv--grid">
              <div>
                <dt>
                  <Icon name="rain" size={14} /> Curah hujan
                </dt>
                <dd>{site.climate.rainfall_mm_year} mm/th</dd>
              </div>
              <div>
                <dt>
                  <Icon name="mountain" size={14} /> Elevasi
                </dt>
                <dd>{site.elevation_m}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="trend" size={14} /> Kelerengan
                </dt>
                <dd>
                  {site.slope.class} · {site.slope.range_pct}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="layers" size={14} /> Tanah
                </dt>
                <dd>{site.soil.type}</dd>
              </div>
              <div>
                <dt>Tutupan 2020</dt>
                <dd>{site.land_cover_before}</dd>
              </div>
              <div>
                <dt>Tutupan 2025</dt>
                <dd>{site.land_cover_now}</dd>
              </div>
            </dl>
          )}
          {tab === 'kondisi' && !site && <p className="muted">Atribut lokasi belum tersedia.</p>}
          {tab === 'dana' && (
            <>
              <DonationProgress project={project} />
              <div className="psidebar__impact">
                <span>Jika target tercapai, proyeksi 10 tahun</span>
                <b className="num">
                  ≈ {co2.value} {co2.unit} CO₂
                </b>
                <Illustrative />
              </div>
              <p className="small muted">Biaya per bibit (all-in): {formatIDRShort(project.cost_per_seedling)}</p>
            </>
          )}
        </div>
        <p className="psidebar__prov">
          <Icon name="database" size={13} /> Parameter fisik dari dataset Loa Kulu · pendanaan &amp; spesies masih simulasi
        </p>
      </div>

      <footer className="psidebar__foot">
        <Button variant="secondary" to={to.program(project.id)} iconRight="arrow-up-right">
          Detail lengkap
        </Button>
        <Button icon="sprout" onClick={() => donate(project.id)} disabled={!accepting}>
          {accepting ? 'Donasi' : 'Terdanai'}
        </Button>
      </footer>
    </aside>
  );
}
