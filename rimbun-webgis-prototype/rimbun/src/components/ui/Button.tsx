import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from '../../router/router';
import { cx } from '../../lib/format';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'light' | 'outline-light' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };
type LinkButtonProps = Common & { to: string; onClick?: () => void; 'aria-label'?: string; title?: string };

export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant = 'primary', size = 'md', icon, iconRight, block, loading, children, className, ...rest } = props;
  const cls = cx('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', loading && 'is-loading', !children && 'btn--icon', className);
  const inner = (
    <>
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </>
  );
  if ('to' in rest && rest.to !== undefined) {
    const { to, ...linkRest } = rest as LinkButtonProps;
    return (
      <Link to={to} className={cls} {...linkRest}>
        {inner}
      </Link>
    );
  }
  const btn = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={btn.type ?? 'button'} className={cls} aria-busy={loading || undefined} {...btn} disabled={btn.disabled || loading}>
      {inner}
    </button>
  );
}
