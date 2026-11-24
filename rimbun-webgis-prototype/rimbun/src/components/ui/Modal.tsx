import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/format';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  closeLabel?: string;
  /** Prevent closing (e.g. while a simulated payment is processing). */
  locked?: boolean;
}

/** Accessible dialog. Becomes a full-height sheet on small screens. */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', locked }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const live = useRef({ onClose, locked });
  live.current = { onClose, locked };

  // Focus management + scroll lock: runs once per open.
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    document.body.classList.add('no-scroll');
    const t = setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('.modal__body button, .modal__body input');
      el?.focus();
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !live.current.locked) live.current.onClose();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      lastFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div ref={panel} className={cx('modal__panel', `modal__panel--${size}`)} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__head">
          <div>
            <h2 id="modal-title" className="modal__title">
              {title}
            </h2>
            {subtitle && <div className="modal__sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup" disabled={locked}>
            <Icon name="x" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
