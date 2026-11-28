import { useMemo, useState, type FormEvent } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { useStore } from '../../store/AppStore';
import { Link, to, useRouter } from '../../router/router';
import type { Donation, ProjectView } from '../../types';
import { donationToImpact, type ImpactResult } from '../../lib/impact/impactModel';
import { impactContextFor } from '../../services/projectService';
import { PAYMENT_LABEL } from '../../services/donationService';
import { PROJECTION_PERIODS, type ProjectionPeriod } from '../../config/site';
import { cx, formatDate, formatIDR, formatIDRShort, formatMass, formatNumber } from '../../lib/format';
import { StatisticsCard } from '../../components/StatisticsCard';
import { EmptyState, Callout } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Input, Select } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Tabs';
import { Illustrative, Badge } from '../../components/ui/Badge';
import { BarList, DualAreaChart, VBarChart } from '../../components/charts/Charts';
import { ProjectCard } from '../../components/project/ProjectCard';
import { IMPACT_ASSUMPTIONS, UNCERTAINTY_NOTE } from '../../lib/impact/assumptions';

/* ─── shared selectors ─────────────────────────────────── */

function useMyImpact(period: number) {
  const { myDonations, getProject, speciesById } = useStore();
  return useMemo(() => {
    const per = myDonations.map((d) => {
      const p = getProject(d.project_id);
      return { d, p, r: donationToImpact(d.amount, period, impactContextFor(p, speciesById)) };
    });
    const totals = per.reduce(
      (acc, x) => ({
        seedlings: acc.seedlings + x.r.seedlings,
        trees: acc.trees + x.r.survivingTrees,
        co2: acc.co2 + x.r.co2Kg,
        o2: acc.o2 + x.r.o2Kg,
      }),
      { seedlings: 0, trees: 0, co2: 0, o2: 0 },
    );
    const series: number[] = Array.from({ length: period }, (_, i) => per.reduce((s, x) => s + (x.r.series[i]?.cumulativeCo2Kg ?? 0), 0));
    const o2Series: number[] = series.map((v) => v * IMPACT_ASSUMPTIONS.o2PerCo2MassRatio);
    return { per, totals, series, o2Series };
  }, [myDonations, getProject, speciesById, period]);
}

function byProject(donations: Donation[], getProject: (id: string) => ProjectView | undefined) {
  const m = new Map<string, number>();
  donations.forEach((d) => m.set(d.project_id, (m.get(d.project_id) ?? 0) + d.amount));
  return [...m.entries()].map(([id, value]) => ({ id, value, project: getProject(id) })).sort((a, b) => b.value - a.value);
}

function NoDonations() {
  return (
    <EmptyState
      icon="sprout"
      title="Belum ada donasi"
      body="Pilih satu lokasi restorasi untuk memulai. Riwayat dan estimasi dampak Anda akan muncul di sini."
      action={
        <Button to={to.programs()} icon="sprout">
          Pilih program
        </Button>
      }
    />
  );
}

/* ─── Overview ─────────────────────────────────────────── */

export function DashboardOverviewPage() {
  const { state, isSandboxDemo, isBackendConfigured, myDonations, getProject, savedIds } = useStore();
  const { totals } = useMyImpact(10);
  const total = myDonations.reduce((s, d) => s + d.amount, 0);
  const programs = new Set(myDonations.map((d) => d.project_id)).size;
  const co2 = formatMass(totals.co2);
  const contrib = byProject(myDonations, getProject);
  const firstName = state.user!.name.split(' ')[0];

  return (
    <DashboardLayout
      title={`Halo, ${firstName}.`}
      lead="Ringkasan kontribusi dan estimasi dampak Anda."
      actions={
        <Button to={to.programs()} icon="sprout">
          Donasi lagi
        </Button>
      }
    >
      <div className="dash-stats">
        <StatisticsCard icon="wallet" label="Total kontribusi" value={formatIDRShort(total)} note={`${myDonations.length} donasi simulasi`} />
        <StatisticsCard icon="polygon" label="Program didukung" value={programs} note={`${savedIds.length} tersimpan`} />
        <StatisticsCard icon="sprout" label="Bibit didukung" value={formatNumber(totals.seedlings)} illustrative tone="ochre" />
        <StatisticsCard icon="cloud" label="CO₂ · proyeksi 10 th" value={co2.value} unit={co2.unit} illustrative tone="forest" />
      </div>

      {myDonations.length === 0 ? (
        <NoDonations />
      ) : (
        <div className="dash-grid">
          <section className="panel panel--pad">
            <div className="h-row">
              <h2 className="h-sub">Aktivitas terbaru</h2>
              <Link to={to.dashboard('history')} className="text-link">
                Semua riwayat <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            <ul className="activity">
              {myDonations.slice(0, 5).map((d) => {
                const p = getProject(d.project_id);
                return (
                  <li key={d.id}>
                    <span className="activity__dot">
                      <Icon name="sprout" size={15} />
                    </span>
                    <div>
                      <b>
                        Donasi ke <Link to={to.program(d.project_id)}>{p?.name ?? d.project_id}</Link>
                      </b>
                      <small>
                        {formatDate(d.created_at)} · {PAYMENT_LABEL[d.payment_method]}
                        {d.anonymous && ' · anonim'}
                      </small>
                    </div>
                    <span className="num activity__amt">{formatIDRShort(d.amount)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="panel panel--pad">
            <h2 className="h-sub">Kontribusi per program</h2>
            <BarList items={contrib.map((c) => ({ label: c.project?.short_name ?? c.id, value: c.value, sub: c.project ? `${Math.floor(c.project.funding_percentage)}% program terdanai` : undefined }))} format={formatIDRShort} />
          </section>
        </div>
      )}

      <Callout tone="sim" title="Catatan simulasi">
        {isSandboxDemo
          ? 'Anda sedang berada di Mode Sandbox Demo. Seluruh transaksi di sesi ini hanya bersifat sementara dan otomatis ter-reset saat keluar.'
          : isBackendConfigured
            ? 'Riwayat donasi simulasi ini tersimpan pada akun Anda di database prototipe (tanpa transaksi uang asli). Estimasi dampak karbon bersifat ilustratif.'
            : 'Seluruh donasi di dashboard ini adalah transaksi simulasi lokal. Estimasi dampak karbon bersifat ilustratif.'}
      </Callout>
    </DashboardLayout>
  );
}

/* ─── History ──────────────────────────────────────────── */

export function DashboardHistoryPage() {
  const { myDonations, getProject } = useStore();
  const { navigate } = useRouter();
  const [project, setProject] = useState('all');
  const list = myDonations.filter((d) => project === 'all' || d.project_id === project);
  const ids = [...new Set(myDonations.map((d) => d.project_id))];

  return (
    <DashboardLayout title="Riwayat donasi" lead="Klik salah satu baris untuk melihat bukti kontribusi digital (simulasi).">
      {myDonations.length === 0 ? (
        <NoDonations />
      ) : (
        <>
          <div className="dash-toolbar">
            <Select aria-label="Filter program" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="all">Semua program</option>
              {ids.map((id) => (
                <option key={id} value={id}>
                  {getProject(id)?.name ?? id}
                </option>
              ))}
            </Select>
            <span className="muted small">
              {list.length} transaksi · total <b className="num">{formatIDR(list.reduce((s, d) => s + d.amount, 0))}</b>
            </span>
          </div>
          <div className="table-wrap">
            <table className="table history">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Tanggal</th>
                  <th>Metode</th>
                  <th>Status</th>
                  <th className="r">Nominal</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const p = getProject(d.project_id);
                  return (
                    <tr key={d.id} className="is-clickable" onClick={() => navigate(to.donationSuccess(d.id))}>
                      <td>
                        <b>{p?.name ?? d.project_id}</b>
                        <small className="muted num history__id">{d.id}</small>
                      </td>
                      <td>{formatDate(d.created_at)}</td>
                      <td>{PAYMENT_LABEL[d.payment_method]}</td>
                      <td>
                        <Badge tone="open">
                          <Icon name="check" size={12} strokeWidth={2.5} /> Simulasi berhasil
                        </Badge>
                      </td>
                      <td className="r num">
                        <b>{formatIDR(d.amount)}</b>
                      </td>
                      <td className="r">
                        <Link
                          to={to.donationSuccess(d.id)}
                          className="icon-btn"
                          title="Lihat & cetak bukti kontribusi"
                          aria-label={`Lihat dan cetak bukti ${d.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon name="printer" size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

/* ─── Impact ───────────────────────────────────────────── */

export function DashboardImpactPage() {
  const { myDonations } = useStore();
  const [period, setPeriod] = useState<ProjectionPeriod>(10);
  const { per, totals, series, o2Series } = useMyImpact(period);
  const all3 = useMyImpact(3).totals;
  const all10 = useMyImpact(10).totals;
  const all15 = useMyImpact(15).totals;
  const byPeriod: Record<number, { co2: number; o2: number }> = { 3: all3, 10: all10, 15: all15 };
  const co2 = formatMass(totals.co2);
  const o2 = formatMass(totals.o2);
  const fmtMass = (v: number) => {
    const m = formatMass(v);
    return `${m.value} ${m.unit}`;
  };

  // Group per program for breakdown.
  const grouped = new Map<string, { name: string; r: Pick<ImpactResult, 'co2Kg' | 'seedlings'> }>();
  per.forEach(({ d, p, r }) => {
    const g = grouped.get(d.project_id) ?? { name: p?.short_name ?? d.project_id, r: { co2Kg: 0, seedlings: 0 } };
    g.r.co2Kg += r.co2Kg;
    g.r.seedlings += r.seedlings;
    grouped.set(d.project_id, g);
  });

  return (
    <DashboardLayout
      title="Dampak saya"
      lead="Akumulasi estimasi dampak ekologis dari seluruh kontribusi Anda."
      actions={<Segmented label="Periode proyeksi" value={period} onChange={(v) => setPeriod(v as ProjectionPeriod)} options={PROJECTION_PERIODS.map((p) => ({ value: p, label: `${p} tahun` }))} />}
    >
      {myDonations.length === 0 ? (
        <NoDonations />
      ) : (
        <>
          <div className="dash-stats">
            <StatisticsCard icon="sprout" label="Bibit didukung" value={formatNumber(totals.seedlings)} note={`≈ ${formatNumber(totals.trees)} pohon hidup (asumsi)`} />
            <StatisticsCard icon="cloud" label={`CO₂ terserap · ${period} th`} value={co2.value} unit={co2.unit} tone="forest" illustrative />
            <StatisticsCard icon="wind" label={`O₂ dihasilkan · ${period} th`} value={o2.value} unit={o2.unit} tone="ochre" illustrative />
          </div>
          <div className="dash-grid">
            <section className="panel panel--pad">
              <div className="h-row">
                <h2 className="h-sub">Akumulasi CO₂ &amp; produksi O₂ per tahun</h2>
                <Illustrative />
              </div>
              <DualAreaChart
                ariaLabel="Akumulasi CO2 dan O2 ilustratif per tahun"
                co2Values={series}
                o2Values={o2Series}
                labels={series.map((_, i) => `Th ${i + 1}`)}
                format={fmtMass}
                height={210}
              />
            </section>
            <section className="panel panel--pad">
              <h2 className="h-sub">Perbandingan periode</h2>
              <VBarChart
                ariaLabel="Perbandingan CO2 per periode"
                items={PROJECTION_PERIODS.map((p) => ({ label: `${p} tahun`, value: byPeriod[p].co2, highlight: p === period }))}
                format={(v) => fmtMass(v)}
              />
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th className="r">CO₂ terserap</th>
                    <th className="r">O₂ dihasilkan</th>
                  </tr>
                </thead>
                <tbody>
                  {PROJECTION_PERIODS.map((p) => (
                    <tr key={p} className={cx(p === period && 'is-hl')}>
                      <td>{p} tahun</td>
                      <td className="r num">{fmtMass(byPeriod[p].co2)}</td>
                      <td className="r num">{fmtMass(byPeriod[p].o2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <section className="panel panel--pad">
            <h2 className="h-sub">Per program</h2>
            <BarList items={[...grouped.values()].map((g) => ({ label: g.name, value: g.r.co2Kg, sub: `${formatNumber(g.r.seedlings)} bibit didukung` }))} format={fmtMass} />
          </section>
          <Callout tone="sim" title="Tentang angka ini">
            {UNCERTAINTY_NOTE}
          </Callout>
        </>
      )}
    </DashboardLayout>
  );
}

/* ─── Saved ────────────────────────────────────────────── */

export function DashboardSavedPage() {
  const { savedIds, getProject } = useStore();
  const saved = savedIds.map((id) => getProject(id)).filter((p): p is ProjectView => !!p);
  return (
    <DashboardLayout title="Program tersimpan" lead="Akses cepat ke lokasi yang Anda tandai. Ketuk ikon hati untuk menghapus.">
      {saved.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Belum ada program tersimpan"
          body="Tandai program dengan ikon hati agar mudah ditemukan kembali."
          action={
            <Button to={to.programs()} variant="secondary">
              Jelajahi program
            </Button>
          }
        />
      ) : (
        <div className="pgrid pgrid--dash">
          {saved.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

/* ─── Profile ──────────────────────────────────────────── */

export function DashboardProfilePage() {
  const { state, isSandboxDemo, isBackendConfigured, updateUserProfile, logout, toast, resetDemo } = useStore();
  const { navigate } = useRouter();
  const user = state.user!;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [city, setCity] = useState(user.city);
  const [saving, setSaving] = useState(false);
  const dirty = name !== user.name || phone !== user.phone || city !== user.city;
  const nameErr = name.trim().length < 2 ? 'Nama minimal 2 karakter.' : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (nameErr) return;
    setSaving(true);
    const ok = await updateUserProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() });
    setSaving(false);
    if (ok) {
      toast(isSandboxDemo ? 'Profil diperbarui di Mode Sandbox Demo.' : 'Profil berhasil disimpan.');
    }
  };

  return (
    <DashboardLayout
      title="Profil"
      lead={
        isSandboxDemo
          ? 'Mode Sandbox Demo: perubahan profil hanya berlaku di sesi ini dan reset saat keluar.'
          : isBackendConfigured
            ? 'Informasi akun tersinkron ke profil Supabase Anda.'
            : 'Informasi akun disimpan di peramban ini.'
      }
    >
      <div className="dash-grid dash-grid--profile">
        <form className="panel panel--pad profile-form" onSubmit={save} noValidate>
          <h2 className="h-sub">Informasi pengguna</h2>
          <Input label="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} error={nameErr} />
          <Input label="Email" value={user.email} readOnly disabled hint="Email tidak dapat diubah di prototipe." />
          <div className="two-col two-col--tight">
            <Input label="Nomor telepon" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" />
            <Input label="Kota" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kota domisili" />
          </div>
          <div className="profile-form__actions">
            <Button type="submit" loading={saving} disabled={!dirty || !!nameErr}>
              Simpan perubahan
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setName(user.name);
                  setPhone(user.phone);
                  setCity(user.city);
                }}
              >
                Batalkan
              </Button>
            )}
          </div>
        </form>
        <div className="stack">
          <div className="panel panel--pad">
            <h2 className="h-sub">Akun</h2>
            <dl className="kv">
              <div>
                <dt>Tipe</dt>
                <dd>{user.is_demo ? 'Akun demo' : 'Donatur (simulasi)'}</dd>
              </div>
              <div>
                <dt>Bergabung</dt>
                <dd>{formatDate(user.joined_at)}</dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              icon="logout"
              block
              className={cx('mt-16')}
              onClick={() => {
                void logout().then(() => navigate(to.home()));
              }}
            >
              {isSandboxDemo ? 'Keluar & Reset Sandbox' : 'Keluar'}
            </Button>
          </div>
          <div className="panel panel--pad">
            <h2 className="h-sub">{isSandboxDemo ? 'Sesi Sandbox Demo' : isBackendConfigured ? 'Sinkronisasi data' : 'Data simulasi lokal'}</h2>
            <p className="small muted">
              {isSandboxDemo
                ? 'Kembalikan seluruh perubahan di sesi sandbox ke data asli server.'
                : isBackendConfigured
                  ? 'Muat ulang daftar program, riwayat donasi, dan bookmark terbaru dari server.'
                  : 'Hapus seluruh data simulasi lokal dari peramban ini.'}
            </p>
            <Button
              variant={isBackendConfigured && !isSandboxDemo ? 'secondary' : 'danger'}
              icon="refresh"
              block
              className="mt-16"
              onClick={() => {
                resetDemo();
                if (!isBackendConfigured || isSandboxDemo) navigate(to.home());
              }}
            >
              {isSandboxDemo ? 'Reset sesi sandbox' : isBackendConfigured ? 'Sinkronkan ulang data' : 'Reset data lokal'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
