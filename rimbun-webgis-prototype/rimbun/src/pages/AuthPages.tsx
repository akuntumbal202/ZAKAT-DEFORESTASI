import { useState, type FormEvent } from 'react';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input, Checkbox } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Link, to } from '../router/router';
import { DEMO_ADMIN, DEMO_USER, useStore } from '../store/AppStore';
import { useGatedActions } from '../store/actions';
import { simulateLogin, simulateRegister, validateEmail } from '../services/authService';
import {
  resetPasswordSupabase,
  signInWithSupabase,
  signUpWithSupabase,
} from '../services/backendService';
import { DEMO_PASSWORD_HINT } from '../data/mock/users';
import { simulateLatency } from '../services/projectService';
import type { User } from '../types';

function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="form-error" role="alert">
      <Icon name="alert" size={16} /> {msg}
    </div>
  );
}

export function LoginPage() {
  const { state, isBackendConfigured, enterDemo, loginRealUser, toast } = useStore();
  const { resumeIntent } = useGatedActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'form' | 'demo-donor' | 'demo-admin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finishReal = async (user: User) => {
    await loginRealUser(user);
    toast(
      user.role === 'admin'
        ? `Masuk sebagai Admin Asli (${user.name.split(' ')[0]}) · tersinkron ke database.`
        : `Selamat datang, ${user.name.split(' ')[0]}!`,
    );
    resumeIntent(user);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading('form');
    const res = isBackendConfigured
      ? await signInWithSupabase(email, password)
      : await simulateLogin(email, password, state.accounts);
    setLoading(null);
    if (res.ok) await finishReal(res.user);
    else setError(res.error);
  };

  const loginDemo = async (which: 'donor' | 'admin') => {
    setError(null);
    setLoading(which === 'admin' ? 'demo-admin' : 'demo-donor');
    await simulateLatency(260);
    await enterDemo(which);
    setLoading(null);
    const demoUser = which === 'admin' ? DEMO_ADMIN : DEMO_USER;
    toast(
      which === 'admin'
        ? 'Mode Sandbox Demo Admin aktif — perubahan hanya di sesi ini & reset saat keluar.'
        : 'Mode Sandbox Demo Donatur aktif — perubahan hanya di sesi ini & reset saat keluar.',
      'info',
    );
    resumeIntent(demoUser);
  };

  return (
    <AuthLayout
      title="Masuk"
      lead={
        isBackendConfigured
          ? 'Masuk dengan akun terdaftar untuk menyinkronkan data ke database, atau coba Mode Sandbox Demo 1-klik.'
          : 'Pilih Akun Demo Donatur / Admin (Mode Sandbox) atau masuk dengan email untuk menguji prototipe Loa Kulu.'
      }
    >
      <div className="auth__demos">
        <button type="button" className="auth__demo" onClick={() => loginDemo('donor')} disabled={!!loading}>
          <Icon name="sprout" size={18} />
          <div>
            <b>Akun Demo Donatur (Mode Sandbox)</b>
            <code>{DEMO_USER.email} · Coba donasi &amp; dashboard (tidak ubah DB asli, reset saat keluar)</code>
          </div>
          {loading === 'demo-donor' ? <span className="spinner" /> : <Icon name="arrow-right" size={18} />}
        </button>

        <button type="button" className="auth__demo auth__demo--admin" onClick={() => loginDemo('admin')} disabled={!!loading}>
          <Icon name="shield" size={18} />
          <div>
            <b>Akun Demo Admin Kurator (Mode Sandbox)</b>
            <code>{DEMO_ADMIN.email} · Coba kurasi &amp; publish (tidak ubah DB asli, reset saat keluar)</code>
          </div>
          {loading === 'demo-admin' ? <span className="spinner" /> : <Icon name="arrow-right" size={18} />}
        </button>
      </div>

      <div className="auth__divider">
        {isBackendConfigured ? 'atau masuk dengan akun Supabase Anda' : `atau masuk dengan email (${DEMO_PASSWORD_HINT})`}
      </div>
      <form className="auth__form" onSubmit={submit} noValidate>
        <FormError msg={error} />
        <Input label="Email" type="email" icon="mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
        <Input label="Kata sandi" type="password" icon="lock" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
        <div className="auth__row">
          <span className="muted small">
            {isBackendConfigured ? 'Autentikasi tersinkron Supabase' : 'Autentikasi simulasi lokal'}
          </span>
          <Link to={to.forgot()}>Lupa kata sandi?</Link>
        </div>
        <Button type="submit" size="lg" block loading={loading === 'form'} disabled={!!loading}>
          Masuk
        </Button>
      </form>
      <p className="auth__switch">
        Belum punya akun? <Link to={to.register()}>Daftar</Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { state, isBackendConfigured, dispatch, loginRealUser, toast } = useStore();
  const { resumeIntent } = useGatedActions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    name: name.trim().length < 2 ? 'Nama minimal 2 karakter.' : null,
    email: !validateEmail(email) ? 'Masukkan email yang valid.' : null,
    password: password.length < 6 ? 'Minimal 6 karakter.' : null,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (errs.name || errs.email || errs.password) return;
    if (!agree) {
      setError('Setujui ketentuan simulasi untuk melanjutkan.');
      return;
    }
    setLoading(true);
    const res = isBackendConfigured
      ? await signUpWithSupabase({ name, email, password })
      : await simulateRegister({ name, email, password }, state.accounts);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (isBackendConfigured) {
      await loginRealUser(res.user);
      toast('Akun terdaftar di server! Selamat bergabung di Rimbun.');
    } else {
      dispatch({ type: 'register', user: res.user });
      toast('Akun simulasi dibuat. Selamat bergabung!');
    }
    resumeIntent(res.user);
  };

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

  return (
    <AuthLayout title="Buat akun donatur" lead="Akun dipakai untuk riwayat donasi simulasi, bookmark program, dan dashboard dampak.">
      <form className="auth__form" onSubmit={submit} noValidate>
        <FormError msg={error} />
        <Input label="Nama lengkap" icon="user" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={touched ? errs.name : null} />
        <Input label="Email" type="email" icon="mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={touched ? errs.email : null} />
        <div>
          <Input label="Kata sandi" type="password" icon="lock" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={touched ? errs.password : null} />
          <div className="pw-meter" data-level={strength} aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
        <Checkbox
          checked={agree}
          onChange={setAgree}
          label={
            isBackendConfigured
              ? 'Saya memahami transaksi donasi pada tahap ini masih berupa simulasi tanpa pembayaran uang asli.'
              : 'Saya memahami ini adalah prototipe lokal: akun disimpan sementara di peramban ini.'
          }
        />
        <Button type="submit" size="lg" block loading={loading}>
          Daftar
        </Button>
      </form>
      <p className="auth__switch">
        Sudah punya akun? <Link to={to.login()}>Masuk</Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { isBackendConfigured } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Masukkan email yang valid.');
      return;
    }
    setError(null);
    setLoading(true);
    if (isBackendConfigured) {
      const res = await resetPasswordSupabase(email);
      setLoading(false);
      if (!res.ok) {
        setError(res.error || 'Gagal mengirim email reset.');
        return;
      }
      setSent(true);
      return;
    }
    await simulateLatency(500);
    setLoading(false);
    setSent(true);
  };
  return (
    <AuthLayout title="Lupa kata sandi" lead="Masukkan email akun Anda untuk mendapatkan tautan pengaturan ulang kata sandi.">
      {sent ? (
        <div className="auth__sent">
          <span className="empty__icon">
            <Icon name="mail" size={22} />
          </span>
          <h2>{isBackendConfigured ? 'Periksa email Anda' : 'Periksa email Anda (simulasi)'}</h2>
          <p className="muted">
            {isBackendConfigured
              ? `Jika ${email} terdaftar, tautan pengaturan ulang kata sandi telah dikirim oleh sistem autentikasi.`
              : `Jika ${email} terdaftar, tautan pengaturan ulang akan dikirim. Pada mode lokal ini belum ada email yang benar-benar terkirim.`}
          </p>
          <Button to={to.login()} variant="secondary" icon="arrow-left">
            Kembali ke halaman masuk
          </Button>
        </div>
      ) : (
        <form className="auth__form" onSubmit={submit} noValidate>
          <Input label="Email" type="email" icon="mail" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" size="lg" block loading={loading}>
            Kirim tautan
          </Button>
          <p className="auth__switch">
            Sudah ingat kata sandi Anda? <Link to={to.login()}>Masuk</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
