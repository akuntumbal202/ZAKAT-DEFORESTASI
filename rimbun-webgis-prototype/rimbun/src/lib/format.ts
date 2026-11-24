const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

export const formatIDR = (n: number) => idr.format(Math.round(n)).replace(/\s/g, '');

/** Short IDR: Rp1,2 M / Rp312 jt / Rp25 rb */
export function formatIDRShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `Rp${num1.format(n / 1e12)} T`;
  if (abs >= 1e9) return `Rp${num1.format(n / 1e9)} M`;
  if (abs >= 1e6) return `Rp${num1.format(n / 1e6)} jt`;
  if (abs >= 1e3) return `Rp${num.format(n / 1e3)} rb`;
  return `Rp${num.format(n)}`;
}

export const formatNumber = (n: number) => num.format(n);
export const formatNumber1 = (n: number) => num1.format(n);

/** Mass in kg → readable kg / ton. */
export function formatMass(kg: number): { value: string; unit: string } {
  if (kg >= 1000) return { value: num1.format(kg / 1000), unit: 'ton' };
  if (kg >= 10) return { value: num.format(kg), unit: 'kg' };
  return { value: num1.format(kg), unit: 'kg' };
}

export const formatPercent = (p: number) => `${Math.round(p)}%`;

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('id-ID', opts);
}

/** Parse "Rp 1.250.000" / "1250000" → 1250000 */
export function parseIDRInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function simId(prefix = 'SIM') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}
