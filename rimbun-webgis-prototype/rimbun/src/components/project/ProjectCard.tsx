import type { ProjectView } from '../../types';
import { cx, formatNumber } from '../../lib/format';
import { CATEGORY_LABEL, isAcceptingDonations } from '../../services/projectService';
import { Link, to } from '../../router/router';
import { useGatedActions } from '../../store/actions';
import { useStore } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { SiteVisual } from './SiteVisual';
import { DonationProgress } from './DonationProgress';

export function SaveButton({ projectId, variant = 'icon' }: { projectId: string; variant?: 'icon' | 'full' | 'floating' }) {
  const { isSaved } = useStore();
  const { toggleSave } = useGatedActions();
  const saved = isSaved(projectId);
  if (variant === 'full') {
    return (
      <Button variant="secondary" icon="heart" onClick={() => toggleSave(projectId)} aria-pressed={saved} className={cx(saved && 'is-saved')}>
        {saved ? 'Tersimpan' : 'Simpan'}
      </Button>
    );
  }
  return (
    <button
      type="button"
      className={cx('save-btn', variant === 'floating' && 'save-btn--floating', saved && 'is-saved')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSave(projectId);
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Hapus dari tersimpan' : 'Simpan program'}
      title={saved ? 'Hapus dari tersimpan' : 'Simpan program'}
    >
      <Icon name="heart" size={17} filled={saved} />
    </button>
  );
}

export function ProjectCard({ project, layout = 'grid' }: { project: ProjectView; layout?: 'grid' | 'list' }) {
  const { donate } = useGatedActions();
  const accepting = isAcceptingDonations(project);
  return (
    <article className={cx('pcard', `pcard--${layout}`)}>
      <Link to={to.program(project.id)} className="pcard__media" aria-label={`Lihat detail ${project.name}`} tabIndex={-1}>
        <SiteVisual seed={project.visual_seed} category={project.category} imageUrl={project.image_url} alt={project.name} label={false} ratio={layout === 'list' ? '4/3' : '16/10'} />
        <span className="pcard__id num">{project.polygon_code || project.id}</span>
      </Link>
      <SaveButton projectId={project.id} variant="floating" />
      <div className="pcard__body">
        <div className="pcard__meta">
          <StatusBadge status={project.status} />
          <span className="pcard__cat">{CATEGORY_LABEL[project.category]}</span>
        </div>
        <h3 className="pcard__title">
          <Link to={to.program(project.id)}>{project.name}</Link>
        </h3>
        <p className="pcard__summary">{project.summary}</p>
        <dl className="pcard__facts">
          <div>
            <dt>Luas</dt>
            <dd className="num">{project.site ? `${formatNumber(project.site.area_ha)} ha` : '—'}</dd>
          </div>
          <div>
            <dt>Bibit</dt>
            <dd className="num">{formatNumber(project.total_seedlings)}</dd>
          </div>
          <div className="pcard__region">
            <dt>Tanah</dt>
            <dd>{project.site?.soil.type.split(',')[0] ?? '—'}</dd>
          </div>
        </dl>
        <DonationProgress project={project} />
        <div className="pcard__actions">
          <Button variant="secondary" size="sm" to={to.program(project.id)} iconRight="arrow-right">
            Detail
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon="sprout"
            onClick={() => donate(project.id)}
            disabled={!accepting}
            title={accepting ? undefined : 'Pendanaan program ini sudah terpenuhi'}
          >
            {accepting ? 'Donasi' : 'Terdanai'}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProjectCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'list' }) {
  return (
    <div className={cx('pcard', `pcard--${layout}`, 'pcard--skeleton')} aria-hidden>
      <div className="pcard__media">
        <span className="skeleton" style={{ display: 'block', aspectRatio: layout === 'list' ? '4/3' : '16/10' }} />
      </div>
      <div className="pcard__body">
        <span className="skeleton" style={{ height: 18, width: '40%' }} />
        <span className="skeleton" style={{ height: 24, width: '80%' }} />
        <span className="skeleton" style={{ height: 14, width: '95%' }} />
        <span className="skeleton" style={{ height: 8, width: '100%', marginTop: 12 }} />
        <span className="skeleton" style={{ height: 34, width: '100%', marginTop: 12 }} />
      </div>
    </div>
  );
}
