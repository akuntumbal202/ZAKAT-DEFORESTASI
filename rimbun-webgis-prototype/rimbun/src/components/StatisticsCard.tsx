import type { ReactNode } from 'react';
import { cx } from '../lib/format';
import { assetUrl } from '../lib/assets';
import { Icon, type IconName } from './ui/Icon';
import { Illustrative } from './ui/Badge';

/** Stat display. `variant="strip"` = hairline inline stat; `card` = boxed (dashboard). */
export function StatisticsCard({
  label,
  value,
  unit,
  icon,
  note,
  variant = 'card',
  illustrative,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: IconName;
  note?: ReactNode;
  variant?: 'card' | 'strip';
  illustrative?: boolean;
  tone?: 'forest' | 'ochre' | 'clay';
}) {
  return (
    <div className={cx('stat', `stat--${variant}`, tone && `stat--${tone}`)}>
      <div className="stat__top">
        {icon && (
          <span className="stat__icon">
            <Icon name={icon} size={17} />
          </span>
        )}
        <span className="stat__label">{label}</span>
      </div>
      <div className="stat__value num">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </div>
      {(note || illustrative) && (
        <div className="stat__note">
          {note}
          {illustrative && <Illustrative />}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, lead, action, align = 'left' }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; action?: ReactNode; align?: 'left' | 'center' }) {
  return (
    <header className={cx('shead', align === 'center' && 'shead--center')}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="shead__title">{title}</h2>
        {lead && <p className="shead__lead">{lead}</p>}
      </div>
      {action && <div className="shead__action">{action}</div>}
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  aside,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={cx('phead', Boolean(aside) && 'phead--split')}>
      <div className={cx('container', Boolean(aside) && 'phead__grid')}>
        <div className="phead__copy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="phead__title">{title}</h1>
          {lead && <p className="phead__lead">{lead}</p>}
          {children}
        </div>
        {aside && <div className="phead__aside">{aside}</div>}
      </div>
    </section>
  );
}

export function PageHeaderVisual({
  imageUrl,
  alt,
  badge,
  caption,
}: {
  imageUrl: string;
  alt: string;
  badge: string;
  caption: string;
}) {
  return (
    <figure className="phead-visual">
      <img src={assetUrl(imageUrl)} alt={alt} />
      <figcaption className="phead-visual__cap">
        <span className="phead-visual__badge">{badge}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
