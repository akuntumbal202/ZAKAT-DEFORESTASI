import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/format';

/**
 * Scroll-triggered reveal wrapper using native IntersectionObserver.
 * Keeps animations GPU-composited (opacity + transform) and falls back cleanly.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cx('reveal', visible && 'is-visible', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Smooth 60fps count-up number triggered on first intersection. */
export function CountUp({
  value,
  decimals = 0,
  duration = 650,
  format,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return;
    }

    const animate = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(value * eased);
        if (p < 1) requestAnimationFrame(tick);
        else setShown(value);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          animate();
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  const rounded = decimals > 0 ? Number(shown.toFixed(decimals)) : Math.round(shown);
  const text = format ? format(rounded) : rounded.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span ref={ref} className="num">
      {text}
    </span>
  );
}
