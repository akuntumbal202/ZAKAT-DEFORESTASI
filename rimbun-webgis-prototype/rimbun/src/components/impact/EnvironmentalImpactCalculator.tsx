import { useMemo, useState } from 'react';
import { PROJECTION_PERIODS, QUICK_AMOUNTS, type ProjectionPeriod } from '../../config/site';
import { donationToImpact, impactToDonation } from '../../lib/impact/impactModel';
import { IMPACT_ASSUMPTIONS, METHOD_NOTES, UNCERTAINTY_NOTE } from '../../lib/impact/assumptions';
import { cx, formatIDR, formatIDRShort, formatMass, formatNumber, formatNumber1, parseIDRInput } from '../../lib/format';
import { impactContextFor, isAcceptingDonations } from '../../services/projectService';
import { useStore } from '../../store/AppStore';
import { useGatedActions } from '../../store/actions';
import type { ProjectView } from '../../types';
import { DualAreaChart } from '../charts/Charts';
import { Button } from '../ui/Button';
import { Illustrative } from '../ui/Badge';
import { Input, Select } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Tabs';

type Mode = 'donation' | 'impact';

interface Props {
  /** Lock the calculator to one program (Project Detail tab). */
  fixedProject?: ProjectView;
  initialAmount?: number;
}

function Metric({ label, value, unit, icon, accent }: { label: string; value: string; unit?: string; icon: string; accent?: boolean }) {
  return (
    <div className={cx('metric', accent && 'metric--accent')}>
      <span className="metric__icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="metric__label">{label}</span>
      <span className="metric__value num">
        {value}
        {unit && <small> {unit}</small>}
      </span>
    </div>
  );
}

export function EnvironmentalImpactCalculator({ fixedProject, initialAmount = 100_000 }: Props) {
  const { projects } = useStore();
  const { donate } = useGatedActions();
  const [mode, setMode] = useState<Mode>('donation');
  const [period, setPeriod] = useState<ProjectionPeriod>(10);
  const [amount, setAmount] = useState(initialAmount);
  const [targetTon, setTargetTon] = useState(1);
  const [projectId, setProjectId] = useState<string>(fixedProject?.id ?? '');

  const project = fixedProject ?? projects.find((p) => p.id === projectId);
  const ctx = impactContextFor(project);

  const a = useMemo(() => donationToImpact(amount, period, ctx), [amount, period, ctx.costPerSeedling, ctx.survivalRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => impactToDonation(targetTon * 1000, period, ctx), [targetTon, period, ctx.costPerSeedling, ctx.survivalRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const compareA = useMemo(
    () => PROJECTION_PERIODS.map((p) => donationToImpact(amount, p, ctx)),
    [amount, ctx.costPerSeedling, ctx.survivalRate], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const compare = useMemo(
    () => PROJECTION_PERIODS.map((p) => impactToDonation(targetTon * 1000, p, ctx)),
    [targetTon, ctx.costPerSeedling, ctx.survivalRate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const series = mode === 'donation' ? a.series : b.series;
  const co2Series = useMemo(() => series.map((s) => s.cumulativeCo2Kg), [series]);
  const o2Series = useMemo(
    () => series.map((s) => s.cumulativeCo2Kg * IMPACT_ASSUMPTIONS.o2PerCo2MassRatio),
    [series],
  );
  const co2 = formatMass(a.co2Kg);
  const o2 = formatMass(a.o2Kg);
  const canDonate = project ? isAcceptingDonations(project) : true;
  const donateTarget = project && canDonate ? project : projects.find((p) => isAcceptingDonations(p));

  return (
    <section className="calc" aria-label="Kalkulator dampak lingkungan">
      <div className="calc__bar">
        <Segmented
          label="Mode kalkulasi"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'donation', label: 'Dana → Dampak' },
            { value: 'impact', label: 'Dampak → Dana' },
          ]}
        />
        <div className="calc__period">
          <span className="calc__period-label">Periode proyeksi</span>
          <Segmented
            size="sm"
            label="Periode proyeksi"
            value={period}
            onChange={(v) => setPeriod(v as ProjectionPeriod)}
            options={PROJECTION_PERIODS.map((p) => ({ value: p, label: `${p} th` }))}
          />
        </div>
      </div>

      <div className="calc__grid">
        {/* ── Inputs ─────────────────────────────── */}
        <div className="calc__inputs">
          {!fixedProject && (
            <Select label="Lokasi / program" value={projectId} onChange={(e) => setProjectId(e.target.value)} hint="Biaya per bibit dan asumsi keberhasilan hidup mengikuti program yang dipilih.">
              <option value="">Rata-rata asumsi umum</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          )}

          {mode === 'donation' ? (
            <>
              <Input
                label="Nominal donasi"
                prefix="Rp"
                inputMode="numeric"
                value={amount ? formatNumber(amount) : ''}
                onChange={(e) => setAmount(Math.min(parseIDRInput(e.target.value), 1_000_000_000))}
                placeholder="0"
              />
              <div className="quick-amounts">
                {QUICK_AMOUNTS.map((q) => (
                  <button key={q} className={cx('chip-btn', amount === q && 'is-active')} onClick={() => setAmount(q)}>
                    {formatIDRShort(q)}
                  </button>
                ))}
              </div>
              <input
                type="range"
                className="range"
                min={10_000}
                max={5_000_000}
                step={5_000}
                value={Math.min(amount, 5_000_000)}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label="Geser nominal donasi"
              />
            </>
          ) : (
            <>
              <Input
                label="Target serapan CO₂"
                suffix={<span className="input__suffix">ton</span>}
                inputMode="decimal"
                value={String(targetTon).replace('.', ',')}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''));
                  setTargetTon(Number.isFinite(v) ? Math.min(v, 100_000) : 0);
                }}
                hint={`Akumulasi selama ${period} tahun.`}
              />
              <input
                type="range"
                className="range"
                min={0.1}
                max={50}
                step={0.1}
                value={Math.min(targetTon, 50)}
                onChange={(e) => setTargetTon(Number(e.target.value))}
                aria-label="Geser target CO₂"
              />
            </>
          )}

          <dl className="calc__assume">
            <div>
              <dt>Biaya per bibit (all-in)</dt>
              <dd className="num">{formatIDR(ctx.costPerSeedling)}</dd>
            </div>
            <div>
              <dt>Asumsi keberhasilan hidup</dt>
              <dd className="num">{Math.round(ctx.survivalRate * 100)}%</dd>
            </div>
            <div>
              <dt>Serapan / pohon dewasa</dt>
              <dd className="num">{IMPACT_ASSUMPTIONS.co2KgPerTreePerYearAtPlateau} kg/th</dd>
            </div>
          </dl>

          <div className="calc__note-box">
            <strong>Model pertumbuhan logistik sigmoidal</strong>
            <p>
              Laju serapan tahunan mengikuti kurva sigmoidal f(t) = 1 / (1 + e^(−0,65 × (t − 5,5))): fase adaptasi tahun 1–3, pertumbuhan cepat tahun 4–9, lalu mendekati laju stabil {IMPACT_ASSUMPTIONS.co2KgPerTreePerYearAtPlateau} kg CO₂/pohon/tahun pada tahun 10–15.
            </p>
          </div>
        </div>

        {/* ── Outputs ────────────────────────────── */}
        <div className="calc__out">
          <div className="calc__out-head">
            <h3>{mode === 'donation' ? 'Estimasi dampak' : 'Estimasi kebutuhan dana'}</h3>
            <Illustrative label="Simulasi ilustratif" />
          </div>

          {mode === 'donation' ? (
            <div className="metrics">
              <Metric icon="sprout" label="Bibit didukung" value={a.seedlings >= 10 ? formatNumber(a.seedlings) : formatNumber1(a.seedlings)} unit="bibit" />
              <Metric icon="cloud" label={`CO₂ terserap · ${period} th`} value={co2.value} unit={co2.unit} accent />
              <Metric icon="wind" label={`O₂ dihasilkan · ${period} th`} value={o2.value} unit={o2.unit} />
            </div>
          ) : (
            <div className="metrics">
              <Metric icon="wallet" label="Dana diperlukan" value={formatIDRShort(b.fundsNeeded)} accent />
              <Metric icon="sprout" label="Bibit ditanam" value={formatNumber(Math.ceil(b.seedlingsNeeded))} unit="bibit" />
              <Metric icon="clock" label="Periode pencapaian" value={String(period)} unit="tahun" />
            </div>
          )}

          <div className="calc__chart">
            <div className="calc__chart-head">
              <span>Akumulasi CO₂ &amp; produksi O₂ per tahun</span>
              <span className="muted">tahun ke-1 s/d {period}</span>
            </div>
            <DualAreaChart
              ariaLabel="Grafik akumulasi serapan CO2 dan produksi O2 ilustratif"
              co2Values={co2Series}
              o2Values={o2Series}
              labels={series.map((s) => `Th ${s.year}`)}
              format={(v) => {
                const m = formatMass(v);
                return `${m.value} ${m.unit}`;
              }}
              height={180}
            />
          </div>

          {mode === 'donation' ? (
            <div className="calc__compare">
              <span className="calc__compare-title">Perbandingan periode untuk {formatIDR(amount)}</span>
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th className="r">Serapan CO₂</th>
                    <th className="r">Produksi O₂</th>
                  </tr>
                </thead>
                <tbody>
                  {compareA.map((c) => {
                    const mc = formatMass(c.co2Kg);
                    const mo = formatMass(c.o2Kg);
                    return (
                      <tr key={c.periodYears} className={cx(c.periodYears === period && 'is-hl')}>
                        <td>{c.periodYears} tahun</td>
                        <td className="r num">
                          {mc.value} {mc.unit}
                        </td>
                        <td className="r num">
                          {mo.value} {mo.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="calc__compare">
              <span className="calc__compare-title">Perbandingan periode untuk target {formatNumber1(targetTon)} ton CO₂</span>
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th className="r">Bibit</th>
                    <th className="r">Dana</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((c) => (
                    <tr key={c.periodYears} className={cx(c.periodYears === period && 'is-hl')}>
                      <td>{c.periodYears} tahun</td>
                      <td className="r num">{formatNumber(Math.ceil(c.seedlingsNeeded))}</td>
                      <td className="r num">{formatIDRShort(c.fundsNeeded)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="calc__cta">
            {donateTarget ? (
              <Button
                icon="sprout"
                onClick={() => donate(donateTarget.id, mode === 'donation' ? amount : Math.ceil(b.fundsNeeded / 1000) * 1000)}
                disabled={mode === 'donation' ? amount < 10_000 : b.fundsNeeded < 10_000}
              >
                {project && canDonate ? `Donasi ke ${project.short_name}` : `Donasi ke ${donateTarget.short_name}`}
              </Button>
            ) : null}
            {project && !canDonate && <span className="muted small">Program ini sudah terdanai — tombol diarahkan ke program lain yang masih terbuka.</span>}
          </div>
        </div>
      </div>

      <details className="method">
        <summary>
          <Icon name="info" size={16} /> Metodologi & asumsi perhitungan <span className="muted">(versi {IMPACT_ASSUMPTIONS.version})</span>
          <Icon name="chevron-down" size={16} className="method__chev" />
        </summary>
        <ol>
          {METHOD_NOTES.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
        <p className="method__warn">{UNCERTAINTY_NOTE}</p>
      </details>
    </section>
  );
}
