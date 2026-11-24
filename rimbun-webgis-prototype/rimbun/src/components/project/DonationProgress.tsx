import type { ProjectView } from '../../types';
import { cx, formatIDR, formatIDRShort, formatNumber } from '../../lib/format';
import { ProgressBar } from '../ui/Feedback';

/** Funding progress block. `compact` for cards, `full` for detail pages. */
export function DonationProgress({ project, variant = 'compact', inverse }: { project: ProjectView; variant?: 'compact' | 'full'; inverse?: boolean }) {
  const pct = project.funding_percentage;
  if (variant === 'compact') {
    return (
      <div className={cx('dprog', inverse && 'dprog--inverse')}>
        <div className="dprog__row">
          <span className="dprog__collected num">{formatIDRShort(project.funding_collected)}</span>
          <span className="dprog__pct num">{Math.floor(pct)}%</span>
        </div>
        <ProgressBar value={pct} size="sm" tone={inverse ? 'light' : 'forest'} />
        <div className="dprog__row dprog__row--muted">
          <span>dari {formatIDRShort(project.funding_target)}</span>
          <span>{formatNumber(project.donor_count)} donatur</span>
        </div>
      </div>
    );
  }
  return (
    <div className="dprog dprog--full">
      <div className="dprog__big">
        <span className="num">{formatIDR(project.funding_collected)}</span>
        <span className="dprog__of">terkumpul dari {formatIDR(project.funding_target)}</span>
      </div>
      <ProgressBar value={pct} size="lg" />
      <dl className="dprog__stats">
        <div>
          <dt>Pendanaan</dt>
          <dd className="num">{pct.toFixed(1).replace('.', ',')}%</dd>
        </div>
        <div>
          <dt>Sisa kebutuhan</dt>
          <dd className="num">{formatIDRShort(project.funding_remaining)}</dd>
        </div>
        <div>
          <dt>Donatur</dt>
          <dd className="num">{formatNumber(project.donor_count)}</dd>
        </div>
      </dl>
    </div>
  );
}
