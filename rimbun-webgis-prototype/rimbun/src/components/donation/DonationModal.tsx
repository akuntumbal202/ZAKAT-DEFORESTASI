import { useEffect, useMemo, useState } from 'react';
import { MIN_DONATION, QUICK_AMOUNTS } from '../../config/site';
import { cx, formatIDR, formatIDRShort, formatMass, formatNumber, parseIDRInput } from '../../lib/format';
import { donationToImpact } from '../../lib/impact/impactModel';
import { PAYMENT_LABEL, PAYMENT_METHODS, simulateDonation } from '../../services/donationService';
import { impactContextFor } from '../../services/projectService';
import { to, useRouter } from '../../router/router';
import { useStore } from '../../store/AppStore';
import type { PaymentMethodId } from '../../types';
import { Button } from '../ui/Button';
import { Callout, ProgressBar } from '../ui/Feedback';
import { Checkbox, Input, Textarea } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { Illustrative } from '../ui/Badge';

const STEPS = ['Nominal', 'Data donatur', 'Pembayaran', 'Ringkasan'] as const;
const PAY_ICON: Record<PaymentMethodId, string> = { qris: 'qr', 'va-bank': 'bank', ewallet: 'phone', card: 'card' };

/**
 * Simulated donation flow — mounted once at app root and opened through the store.
 * One donation = one selected restoration program.
 */
export function DonationModal() {
  const { state, dispatch, getProject, addDonation, speciesById } = useStore();
  const { navigate } = useRouter();
  const open = state.donateFor;
  const project = getProject(open?.projectId);
  const user = state.user;

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(50_000);
  const [custom, setCustom] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [pay, setPay] = useState<PaymentMethodId | null>(null);
  const [agree, setAgree] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  // Reset whenever the flow (re)opens.
  useEffect(() => {
    if (!open) return;
    const preset = open.amount ?? 50_000;
    setStep(0);
    setAmount(preset);
    setCustom(!QUICK_AMOUNTS.includes(preset as (typeof QUICK_AMOUNTS)[number]));
    setAnonymous(false);
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setMessage('');
    setPay(null);
    setAgree(false);
    setProcessing(false);
    setError(null);
    setEmailTouched(false);
  }, [open, user?.name, user?.email]);

  const impact = useMemo(
    () => (project ? donationToImpact(amount, 10, impactContextFor(project, speciesById)) : null),
    [amount, project, speciesById],
  );

  if (!open || !project || !user) return null;
  const close = () => !processing && dispatch({ type: 'closeDonate' });
  const remaining = project.funding_remaining;

  const amountError =
    amount < MIN_DONATION ? `Minimal donasi ${formatIDR(MIN_DONATION)}.` : amount > remaining ? `Melebihi sisa kebutuhan program (${formatIDR(remaining)}).` : null;
  const nameError = !anonymous && name.trim().length < 2 ? 'Isi nama yang akan ditampilkan.' : null;
  const emailError = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Email dipakai untuk bukti kontribusi (simulasi).' : null;

  const canNext = [!amountError, !nameError && !emailError, !!pay, agree][step];

  const next = async () => {
    if (!canNext) {
      if (step === 1) setEmailTouched(true);
      setError(step === 2 ? 'Pilih salah satu metode pembayaran simulasi.' : step === 3 ? 'Centang persetujuan simulasi untuk melanjutkan.' : null);
      return;
    }
    setError(null);
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setProcessing(true);
    try {
      const d = await simulateDonation({
        project_id: project.id,
        user_id: user.id,
        amount,
        display_name: name.trim() || user.name,
        anonymous,
        message: message.trim(),
        payment_method: pay!,
      });
      await addDonation(d);
      dispatch({ type: 'closeDonate' });
      navigate(to.donationSuccess(d.id));
    } catch {
      setError('Simulasi gagal diproses. Coba lagi.');
      setProcessing(false);
    }
  };

  const footer = (
    <>
      {step > 0 ? (
        <Button variant="ghost" icon="arrow-left" onClick={() => setStep(step - 1)} disabled={processing}>
          Kembali
        </Button>
      ) : (
        <span className="modal__foot-note">
          <Icon name="shield" size={15} /> Tidak ada uang yang ditarik
        </span>
      )}
      <Button onClick={next} loading={processing} iconRight={step < 3 ? 'arrow-right' : undefined} icon={step === 3 ? 'check' : undefined}>
        {step < 3 ? 'Lanjut' : processing ? 'Memproses simulasi…' : `Konfirmasi ${formatIDRShort(amount)}`}
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={close}
      locked={processing}
      title="Donasi untuk restorasi"
      subtitle={
        <span className="donate__proj">
          <b>{project.name}</b> · {project.id}
        </span>
      }
      footer={footer}
    >
      <div className="sim-banner">
        <Icon name="info" size={15} /> Mode simulasi — tidak terhubung ke payment gateway.
      </div>

      <ol className="stepper" aria-label="Langkah donasi">
        {STEPS.map((s, i) => (
          <li key={s} className={cx(i === step && 'is-current', i < step && 'is-done')} aria-current={i === step ? 'step' : undefined}>
            <span className="stepper__dot">{i < step ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
            <span className="stepper__label">{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="donate__step">
          <div className="amount-grid" role="radiogroup" aria-label="Pilih nominal">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                role="radio"
                aria-checked={!custom && amount === q}
                className={cx('amount-opt', !custom && amount === q && 'is-active')}
                onClick={() => {
                  setCustom(false);
                  setAmount(q);
                }}
              >
                <span className="num">{formatIDR(q)}</span>
              </button>
            ))}
            <button role="radio" aria-checked={custom} className={cx('amount-opt amount-opt--other', custom && 'is-active')} onClick={() => setCustom(true)}>
              Nominal lainnya
            </button>
          </div>
          {custom && (
            <Input
              label="Nominal custom"
              prefix="Rp"
              inputMode="numeric"
              data-autofocus
              value={amount ? formatNumber(amount) : ''}
              onChange={(e) => setAmount(Math.min(parseIDRInput(e.target.value), 10_000_000_000))}
              error={amountError}
              hint={`Minimal ${formatIDR(MIN_DONATION)}`}
            />
          )}
          {!custom && amountError && <p className="field__error">{amountError}</p>}
          {impact && !amountError && (
            <div className="donate__impact">
              <div>
                <span className="donate__impact-k">≈ {formatNumber(Math.max(0, impact.seedlings))}</span>
                <span>bibit didukung</span>
              </div>
              <div>
                <span className="donate__impact-k">
                  {formatMass(impact.co2Kg).value} {formatMass(impact.co2Kg).unit}
                </span>
                <span>CO₂ dalam 10 tahun</span>
              </div>
              <Illustrative />
            </div>
          )}
          <div className="donate__remaining">
            <span>Sisa kebutuhan program</span>
            <b className="num">{formatIDR(remaining)}</b>
            <ProgressBar value={project.funding_percentage} size="sm" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="donate__step">
          <div className="identity" role="radiogroup" aria-label="Identitas donatur">
            <button role="radio" aria-checked={!anonymous} className={cx('identity__opt', !anonymous && 'is-active')} onClick={() => setAnonymous(false)}>
              <Icon name="user" />
              <span>
                <b>Tampilkan nama</b>
                <small>Nama muncul di daftar donatur program</small>
              </span>
            </button>
            <button role="radio" aria-checked={anonymous} className={cx('identity__opt', anonymous && 'is-active')} onClick={() => setAnonymous(true)}>
              <Icon name="eye-off" />
              <span>
                <b>Donasi anonim</b>
                <small>Ditampilkan sebagai “Hamba Allah”</small>
              </span>
            </button>
          </div>
          {!anonymous && <Input label="Nama yang ditampilkan" value={name} onChange={(e) => setName(e.target.value)} error={name ? nameError : null} />}
          <Input
            label="Email untuk bukti kontribusi"
            type="email"
            icon="mail"
            value={email}
            onChange={(e) => {
              setEmailTouched(true);
              setEmail(e.target.value);
            }}
            onBlur={() => setEmailTouched(true)}
            error={emailTouched ? (email ? emailError : 'Email wajib diisi.') : null}
          />
          <Textarea label="Pesan / doa (opsional)" rows={3} maxLength={160} value={message} onChange={(e) => setMessage(e.target.value)} hint={`${message.length}/160`} />
        </div>
      )}

      {step === 2 && (
        <div className="donate__step">
          <div className="paylist" role="radiogroup" aria-label="Metode pembayaran simulasi">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id} role="radio" aria-checked={pay === m.id} className={cx('payopt', pay === m.id && 'is-active')} onClick={() => setPay(m.id)}>
                <span className="payopt__icon">
                  <Icon name={PAY_ICON[m.id]} />
                </span>
                <span className="payopt__text">
                  <b>{m.label}</b>
                  <small>{m.hint}</small>
                </span>
                <span className="payopt__radio" aria-hidden />
              </button>
            ))}
          </div>
          <Callout tone="sim">Tidak ada data rekening atau kartu yang diminta. Integrasi payment gateway dilakukan bersama mitra pada fase berikutnya.</Callout>
        </div>
      )}

      {step === 3 && (
        <div className="donate__step">
          <dl className="summary">
            <div>
              <dt>Program</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Nominal</dt>
              <dd className="num summary__amount">{formatIDR(amount)}</dd>
            </div>
            <div>
              <dt>Ditampilkan sebagai</dt>
              <dd>{anonymous ? 'Hamba Allah (anonim)' : name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Metode</dt>
              <dd>{pay ? PAYMENT_LABEL[pay] : '—'} (simulasi)</dd>
            </div>
            {message && (
              <div>
                <dt>Pesan</dt>
                <dd>“{message}”</dd>
              </div>
            )}
            <div>
              <dt>Alokasi</dt>
              <dd>100% ke program {project.id} (simulasi)</dd>
            </div>
          </dl>
          <Checkbox checked={agree} onChange={setAgree} label="Saya memahami ini adalah transaksi simulasi untuk prototipe dan tidak ada dana sungguhan yang berpindah." />
        </div>
      )}

      {error && (
        <p className="field__error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </Modal>
  );
}
