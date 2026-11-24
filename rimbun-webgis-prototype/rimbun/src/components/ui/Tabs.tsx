import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../../lib/format';
import { Icon, type IconName } from './Icon';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  idPrefix: string;
  className?: string;
}

/** WAI-ARIA tabs with arrow-key navigation. Panels use id `${idPrefix}-panel-${id}`. */
export function Tabs<T extends string>({ items, value, onChange, idPrefix, className }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = items.length - 1;
    if (n >= 0) {
      e.preventDefault();
      onChange(items[n].id);
      refs.current[n]?.focus();
    }
  };
  return (
    <div className={cx('tabs', className)} role="tablist">
      {items.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            className={cx('tabs__tab', active && 'is-active')}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('segmented', size === 'sm' && 'segmented--sm')} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={cx('segmented__opt', o.value === value && 'is-active')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
