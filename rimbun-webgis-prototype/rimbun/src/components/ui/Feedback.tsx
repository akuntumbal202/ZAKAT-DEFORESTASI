import { useEffect, type ReactNode } from 'react';
import { cx } from '../../lib/format';
import { useStore } from '../../store/AppStore';
import { Icon, type IconName } from './Icon';

export function ProgressBar({ value, size = 'md', tone = 'forest', label }: { value: number; size?: 'sm' | 'md' | 'lg'; tone?: 'forest' | 'ochre' | 'light'; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx('progress', `progress--${size}`, `progress--${tone}`, v >= 100 && 'is-complete')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label ?? 'Progres pendanaan'}
    >
      <span className="progress__fill" style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({ icon = 'leaf', title, body, action }: { icon?: IconName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="empty__title">{title}</h3>
      {body && <p className="empty__body">{body}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 8, className }: { h?: number | string; w?: number | string; r?: number; className?: string }) {
  return <span className={cx('skeleton', className)} style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}

export function Callout({ tone = 'info', icon, title, children }: { tone?: 'info' | 'warn' | 'sim'; icon?: IconName; title?: string; children: ReactNode }) {
  return (
    <div className={cx('callout', `callout--${tone}`)} role="note">
      <Icon name={icon ?? (tone === 'warn' ? 'alert' : 'info')} size={18} />
      <div>
        {title && <strong className="callout__title">{title}</strong>}
        <div className="callout__body">{children}</div>
      </div>
    </div>
  );
}

export function ToastHost() {
  const { state, dispatch } = useStore();
  const t = state.toast;
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => dispatch({ type: 'clearToast' }), 3600);
    return () => clearTimeout(h);
  }, [t, dispatch]);
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="true">
      {t && (
        <div key={t.id} className={cx('toast', `toast--${t.tone}`)}>
          <Icon name={t.tone === 'warn' ? 'alert' : t.tone === 'info' ? 'info' : 'check-circle'} size={18} />
          <span>{t.text}</span>
          <button className="toast__close" onClick={() => dispatch({ type: 'clearToast' })} aria-label="Tutup notifikasi">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
