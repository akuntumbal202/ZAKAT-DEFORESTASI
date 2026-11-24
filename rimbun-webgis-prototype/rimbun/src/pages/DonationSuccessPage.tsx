import { PublicLayout } from '../layouts/PublicLayout';
import { useStore } from '../store/AppStore';
import { to, useRouter } from '../router/router';
import { formatDate, formatIDR, formatMass, formatNumber } from '../lib/format';
import { donationToImpact } from '../lib/impact/impactModel';
import { impactContextFor } from '../services/projectService';
import { PAYMENT_LABEL } from '../services/donationService';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/Feedback';
import { Illustrative } from '../components/ui/Badge';
import { DonationProgress } from '../components/project/DonationProgress';
import { SITE } from '../config/site';

export function DonationSuccessPage() {
  const { route } = useRouter();
  const { state, getProject, toast } = useStore();
  const donation = state.donations.find((d) => d.id === route.param);
  const project = getProject(donation?.project_id);

  if (!donation || !project || donation.user_id !== state.user?.id) {
    return (
      <PublicLayout>
        <div className="container section">
          <EmptyState
            icon="file"
            title="Bukti kontribusi tidak ditemukan"
            body="Bukti ini mungkin milik akun lain, atau data simulasi sudah direset."
            action={
              <Button to={state.user ? to.dashboard('history') : to.login()} variant="secondary">
                {state.user ? 'Lihat riwayat donasi' : 'Masuk'}
              </Button>
            }
          />
        </div>
      </PublicLayout>
    );
  }

  const impact = donationToImpact(donation.amount, 10, impactContextFor(project));
  const co2 = formatMass(impact.co2Kg);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(donation.id);
      toast('ID transaksi disalin.');
    } catch {
      toast('Tidak bisa menyalin di peramban ini.', 'warn');
    }
  };

  return (
    <PublicLayout>
      <section className="success container">
        <div className="success__head page-enter">
          <span className="success__check">
            <Icon name="check" size={28} strokeWidth={2.5} />
          </span>
          <h1>Terima kasih, kontribusimu tercatat.</h1>
          <p>
            Donasi simulasi sebesar <b>{formatIDR(donation.amount)}</b> dialokasikan ke <b>{project.name}</b>. Progres pendanaan program sudah diperbarui.
          </p>
        </div>

        <div className="success__grid">
          <article className="receipt" aria-label="Bukti kontribusi digital (simulasi)">
            <div className="receipt__wm" aria-hidden>
              SIMULASI
            </div>
            <header className="receipt__head">
              <div>
                <span className="eyebrow">Bukti kontribusi digital</span>
                <h2>{SITE.name}</h2>
              </div>
              <span className="receipt__status">
                <Icon name="check-circle" size={15} /> Simulasi berhasil
              </span>
            </header>
            <dl className="receipt__rows">
              <div>
                <dt>ID transaksi</dt>
                <dd className="num">
                  {donation.id}
                  <button className="icon-btn icon-btn--sm" onClick={copyId} aria-label="Salin ID transaksi">
                    <Icon name="copy" size={15} />
                  </button>
                </dd>
              </div>
              <div>
                <dt>Tanggal</dt>
                <dd>{formatDate(donation.created_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
              </div>
              <div>
                <dt>Donatur</dt>
                <dd>{donation.anonymous ? 'Hamba Allah (anonim)' : donation.display_name}</dd>
              </div>
              <div>
                <dt>Program</dt>
                <dd>
                  {project.name} <span className="muted num">· {project.id}</span>
                </dd>
              </div>
              <div>
                <dt>Metode</dt>
                <dd>{PAYMENT_LABEL[donation.payment_method]} (simulasi)</dd>
              </div>
              {donation.message && (
                <div>
                  <dt>Pesan</dt>
                  <dd>“{donation.message}”</dd>
                </div>
              )}
            </dl>
            <div className="receipt__total">
              <span>Total kontribusi</span>
              <b className="num">{formatIDR(donation.amount)}</b>
            </div>
            <p className="receipt__foot">Dokumen ini dibuat oleh prototipe dan tidak berlaku sebagai bukti transaksi atau bukti pembayaran zakat/infak yang sah.</p>
          </article>

          <div className="success__side">
            <div className="panel panel--pad">
              <div className="h-row">
                <h3 className="h-sub">Estimasi dampak donasi ini</h3>
                <Illustrative />
              </div>
              <div className="success__impact">
                <div>
                  <span className="num">{formatNumber(impact.seedlings)}</span>
                  <small>bibit didukung</small>
                </div>
                <div>
                  <span className="num">
                    {co2.value} {co2.unit}
                  </span>
                  <small>CO₂ · 10 tahun</small>
                </div>
              </div>
            </div>
            <div className="panel panel--pad">
              <h3 className="h-sub">Progres {project.short_name} terkini</h3>
              <DonationProgress project={project} />
            </div>
            <div className="success__actions">
              <Button variant="secondary" icon="printer" onClick={() => window.print()}>
                Cetak / Simpan PDF
              </Button>
              <Button to={to.dashboard()} icon="home">
                Buka dashboard
              </Button>
              <Button to={to.program(project.id)} variant="secondary">
                Kembali ke program
              </Button>
              <Button to={to.programs()} variant="ghost" iconRight="arrow-right">
                Dukung lokasi lain
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
