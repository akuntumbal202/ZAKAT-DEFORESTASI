import { useId, useState } from 'react';
import { cx } from '../../lib/format';

/**
 * Lightweight SVG charts (no chart library). Enough for Phase 1; swap for
 * Recharts/visx later if interactions grow.
 */

interface AreaProps {
  values: number[];
  labels: string[];
  format: (v: number) => string;
  height?: number;
  ariaLabel: string;
  highlightLast?: boolean;
}

export function AreaChart({ values, labels, format, height = 200, ariaLabel, highlightLast = true }: AreaProps) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 8, r: 8, t: 18, b: 26 };
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const active = hover ?? (highlightLast ? n - 1 : null);
  const tickEvery = n > 10 ? Math.ceil(n / 6) : 1;

  return (
    <figure className="chart" aria-label={ariaLabel} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--c-forest-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--c-forest-500)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} className="chart__grid" />
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={line} className="chart__line" />
        {labels.map((l, i) =>
          i % tickEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} className="chart__tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {l}
            </text>
          ) : null,
        )}
        {values.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W / Math.max(n, 2)) / 2}
            y={0}
            width={W / Math.max(n, 2)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {active != null && values[active] != null && (
          <g className="chart__focus" pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={pad.t - 6} y2={H - pad.b} />
            <circle cx={x(active)} cy={y(values[active])} r={4.5} />
            <text
              x={Math.min(Math.max(x(active), 60), W - 60)}
              y={Math.max(y(values[active]) - 12, 12)}
              textAnchor="middle"
              className="chart__value"
            >
              {format(values[active])}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

export function BarList({ items, format, max }: { items: { label: string; value: number; sub?: string }[]; format: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="barlist">
      {items.map((it) => (
        <li key={it.label} className="barlist__row">
          <div className="barlist__meta">
            <span className="barlist__label">{it.label}</span>
            <span className="barlist__value num">{format(it.value)}</span>
          </div>
          <span className="barlist__track">
            <span className="barlist__fill" style={{ width: `${(it.value / m) * 100}%` }} />
          </span>
          {it.sub && <span className="barlist__sub">{it.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

export interface Segment {
  label: string;
  value: number;
  tone: 'forest' | 'moss' | 'ochre' | 'clay' | 'line';
}

/** Single horizontal bar split into segments — used for budget vs collected vs spent. */
export function SegmentBar({ segments, total, format }: { segments: Segment[]; total: number; format: (v: number) => string }) {
  return (
    <div className="segbar">
      <div className="segbar__track" role="img" aria-label={segments.map((s) => `${s.label}: ${format(s.value)}`).join(', ')}>
        {segments.map((s) => (
          <span key={s.label} className={cx('segbar__seg', `tone-${s.tone}`)} style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%` }} />
        ))}
      </div>
      <ul className="segbar__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className={cx('swatch', `tone-${s.tone}`)} aria-hidden />
            <span className="segbar__l">{s.label}</span>
            <span className="segbar__v num">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VBarChart({ items, format, ariaLabel }: { items: { label: string; value: number; highlight?: boolean }[]; format: (v: number) => string; ariaLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="vbars" role="img" aria-label={ariaLabel}>
      {items.map((it) => (
        <div key={it.label} className={cx('vbars__col', it.highlight && 'is-hl')}>
          <span className="vbars__val num">{format(it.value)}</span>
          <span className="vbars__bar" style={{ height: `${Math.max(4, (it.value / max) * 100)}%` }} />
          <span className="vbars__label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

interface DualAreaProps {
  co2Values: number[];
  o2Values: number[];
  labels: string[];
  format: (v: number) => string;
  height?: number;
  ariaLabel: string;
}

/** Dual-series pure-SVG area chart for cumulative CO₂ absorbed and O₂ produced. */
export function DualAreaChart({ co2Values, o2Values, labels, format, height = 190, ariaLabel }: DualAreaProps) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 8, r: 8, t: 18, b: 26 };
  const max = Math.max(1, ...co2Values, ...o2Values);
  const n = Math.max(co2Values.length, o2Values.length);
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  const co2Line = co2Values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const o2Line = o2Values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const co2Area = `${co2Line} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const o2Area = `${o2Line} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const active = hover ?? n - 1;
  const tickEvery = n > 10 ? Math.ceil(n / 6) : 1;

  return (
    <figure className="chart dualchart" aria-label={ariaLabel} role="img">
      <div className="dualchart__legend">
        <span>
          <i className="swatch swatch--co2" aria-hidden /> Serapan CO₂:{' '}
          <b className="num">{co2Values[active] != null ? format(co2Values[active]) : '—'}</b>
        </span>
        <span>
          <i className="swatch swatch--o2" aria-hidden /> Produksi O₂:{' '}
          <b className="num">{o2Values[active] != null ? format(o2Values[active]) : '—'}</b>
        </span>
        {labels[active] && <span className="muted num">({labels[active]})</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`co2${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--c-forest-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--c-forest-500)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`o2${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--c-ochre-400)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--c-ochre-400)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} className="chart__grid" />
        ))}
        <path d={co2Area} fill={`url(#co2${gid})`} />
        <path d={o2Area} fill={`url(#o2${gid})`} />
        <path d={co2Line} className="chart__line" />
        <path d={o2Line} className="chart__line chart__line--o2" />
        {labels.map((l, i) =>
          i % tickEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} className="chart__tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {l}
            </text>
          ) : null,
        )}
        {co2Values.map((_, i) => (
          <rect
            key={i}
            x={x(i) - W / Math.max(n, 2) / 2}
            y={0}
            width={W / Math.max(n, 2)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {active != null && co2Values[active] != null && (
          <g className="chart__focus" pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={pad.t - 6} y2={H - pad.b} />
            <circle cx={x(active)} cy={y(co2Values[active])} r={4.5} />
            {o2Values[active] != null && <circle cx={x(active)} cy={y(o2Values[active])} r={4} className="chart__dot--o2" />}
          </g>
        )}
      </svg>
    </figure>
  );
}

const DONUT_TONES = ['var(--c-forest-600)', 'var(--c-moss-400, #5c8a68)', 'var(--c-ochre-400)', 'var(--c-clay-500)', 'var(--c-ink-400)'];

/** Lightweight pure-SVG donut ring chart for cost allocation & breakdown. */
export function DonutChart({
  items,
  centerLabel,
  centerValue,
  format,
  ariaLabel,
}: {
  items: { label: string; value: number }[];
  centerLabel: string;
  centerValue: string;
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const R = 58;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donut" role="img" aria-label={ariaLabel}>
      <div className="donut__ring-wrap">
        <svg viewBox="0 0 160 160" className="donut__svg" onMouseLeave={() => setActive(null)}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--c-paper-2)" strokeWidth="22" />
          {total > 0 &&
            items.map((it, idx) => {
              const frac = Math.max(0, it.value) / total;
              const dash = frac * C;
              const gap = C - dash;
              const dashOffset = -offset;
              offset += dash;
              const isAct = active === idx;
              return (
                <circle
                  key={it.label}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={DONUT_TONES[idx % DONUT_TONES.length]}
                  strokeWidth={isAct ? 25 : 22}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 80 80)"
                  style={{ transition: 'stroke-width 0.16s ease, opacity 0.16s ease', opacity: active === null || isAct ? 1 : 0.45, cursor: 'pointer' }}
                  onMouseEnter={() => setActive(idx)}
                />
              );
            })}
        </svg>
        <div className="donut__center">
          <small>{active !== null ? items[active].label : centerLabel}</small>
          <strong className="num">{active !== null ? format(items[active].value) : centerValue}</strong>
        </div>
      </div>
      <ul className="donut__legend">
        {items.map((it, idx) => {
          const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
          return (
            <li
              key={it.label}
              className={cx(active === idx && 'is-active')}
              onMouseEnter={() => setActive(idx)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="swatch" style={{ background: DONUT_TONES[idx % DONUT_TONES.length] }} aria-hidden />
              <span className="donut__l">{it.label}</span>
              <span className="donut__v num">
                {format(it.value)} <small className="muted">({pct}%)</small>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
