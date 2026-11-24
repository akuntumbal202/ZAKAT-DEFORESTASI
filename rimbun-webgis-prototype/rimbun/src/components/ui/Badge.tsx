import type { ReactNode } from 'react';
import { cx } from '../../lib/format';
import type { ProjectStatus } from '../../types';
import { STATUS_META } from '../../services/projectService';
import { Icon } from './Icon';

export function Badge({ tone = 'neutral', children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={cx('badge', `badge--${tone}`, className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone}>
      <span className="badge__dot" aria-hidden />
      {m.label}
    </Badge>
  );
}

/** Marks a number/visual as illustrative or simulated. Used everywhere mock data is shown. */
export function Illustrative({ label = 'Ilustratif', title, inverse }: { label?: string; title?: string; inverse?: boolean }) {
  return (
    <span className={cx('illus', inverse && 'illus--inverse')} title={title ?? 'Angka/visual contoh untuk prototipe — bukan data aktual'}>
      <Icon name="info" size={12} />
      {label}
    </span>
  );
}
