import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SITE } from '../config/site';
import { Link, to, useRouter, type RouteName } from '../router/router';
import { useStore } from '../store/AppStore';
import { cx } from '../lib/format';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

const NAV: { label: string; to: string; match: RouteName[] }[] = [
  { label: 'Explore Map', to: to.explore(), match: ['explore'] },
  { label: 'Program', to: to.programs(), match: ['programs', 'program'] },
  { label: 'Kalkulator Dampak', to: to.calculator(), match: ['calculator'] },
  { label: 'Transparansi', to: to.transparency(), match: ['transparency'] },
  { label: 'Tentang', to: to.about(), match: ['about'] },
];

export function Logo({ inverse }: { inverse?: boolean }) {
  return (
    <Link to={to.home()} className={cx('logo', inverse && 'logo--inverse')} aria-label={`${SITE.name} — beranda`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="currentColor" className="logo__bg" />
        <path d="M16 6c-4.5 3.4-7 7.2-7 11.2A7 7 0 0 0 16 24a7 7 0 0 0 7-6.8C23 13.2 20.5 9.4 16 6Z" className="logo__leaf" />
        <path d="M16 11v15M16 17l3.2-2.6M16 20.5l-3.4-2.7" className="logo__vein" />
      </svg>
      <span>{SITE.name}</span>
    </Link>
  );
}

function UserMenu() {
  const { state, isSandboxDemo, logout } = useStore();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!state.user) return null;
  const isAdmin = state.user.role === 'admin';
  const initials = state.user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="usermenu__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className={cx('avatar', isAdmin && 'avatar--admin')}>{initials}</span>
        <span className="usermenu__name">{state.user.name.split(' ')[0]}</span>
        {isAdmin && <span className="usermenu__role">{isSandboxDemo ? 'Demo Admin' : 'Admin'}</span>}
        {!isAdmin && isSandboxDemo && <span className="usermenu__role usermenu__role--demo">Demo</span>}
        <Icon name="chevron-down" size={15} />
      </button>
      {open && (
        <div className="usermenu__pop" role="menu">
          {isAdmin && (
            <Link to={to.admin()} role="menuitem" onClick={() => setOpen(false)}>
              <Icon name="shield" size={16} /> Panel Kurasi Admin
            </Link>
          )}
          <Link to={to.dashboard()} role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="home" size={16} /> Dashboard Saya
          </Link>
          <Link to={to.dashboard('history')} role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="history" size={16} /> Riwayat donasi
          </Link>
          <Link to={to.dashboard('saved')} role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="heart" size={16} /> Tersimpan
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout().then(() => navigate(to.home()));
            }}
          >
            <Icon name="logout" size={16} /> {isSandboxDemo ? 'Keluar & Reset Sandbox' : 'Keluar'}
          </button>
        </div>
      )}
    </div>
  );
}

export function SandboxBanner() {
  const { state, isSandboxDemo, logout } = useStore();
  const { navigate } = useRouter();
  if (!isSandboxDemo || !state.user) return null;
  const label = state.user.role === 'admin' ? 'Admin Kurator' : 'Donatur';
  return (
    <div className="sandbox-bar" role="status">
      <div className="container sandbox-bar__inner">
        <span>
          <Icon name="info" size={15} />{' '}
          <b>Mode Sandbox Demo ({label})</b> — Perubahan hanya berlaku di sesi ini, tidak mengubah database asli, dan otomatis reset saat keluar.
        </span>
        <button
          type="button"
          className="sandbox-bar__btn"
          onClick={() => void logout().then(() => navigate(to.home()))}
        >
          Keluar &amp; Reset
        </button>
      </div>
    </div>
  );
}

export function Navbar({ overlay, wide }: { overlay?: boolean; wide?: boolean }) {
  const { route } = useRouter();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [route.path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
  }, [open]);

  const transparent = overlay && !scrolled && !open;
  const isAdmin = state.user?.role === 'admin';

  return (
    <>
      <header className={cx('nav', transparent && 'nav--overlay', open && 'is-open')}>
        <div className={cx('nav__inner container', wide && 'container--wide')}>
          <Logo inverse={transparent} />
          <nav className="nav__links" aria-label="Navigasi utama">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={cx('nav__link', n.match.includes(route.name) && 'is-active')} aria-current={n.match.includes(route.name) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to={to.admin()}
                className={cx('nav__link nav__link--admin', (route.name === 'admin' || route.name === 'admin-map') && 'is-active')}
                aria-current={route.name === 'admin' || route.name === 'admin-map' ? 'page' : undefined}
              >
                Panel Admin
              </Link>
            )}
          </nav>
          <div className="nav__right">
            {state.user ? (
              <UserMenu />
            ) : (
              <>
                <Link to={to.login()} className="nav__link nav__login">
                  Masuk
                </Link>
                <Button size="sm" variant={transparent ? 'light' : 'primary'} to={to.programs()} icon="sprout" className="nav__cta">
                  Dukung program
                </Button>
              </>
            )}
            <button type="button" className="nav__burger icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Tutup menu' : 'Buka menu'}>
              <Icon name={open ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
      <div id="mobile-nav" className="mnav" hidden={!open}>
        <nav aria-label="Navigasi seluler">
          <Link to={to.home()} className={cx('mnav__link', route.name === 'home' && 'is-active')}>
            <span>Beranda</span>
            <Icon name="chevron-right" size={18} />
          </Link>
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={cx('mnav__link', n.match.includes(route.name) && 'is-active')}>
              <span>{n.label}</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          ))}
          {isAdmin && (
            <Link to={to.admin()} className={cx('mnav__link', (route.name === 'admin' || route.name === 'admin-map') && 'is-active')}>
              <span>Panel Admin Kurasi</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          )}
        </nav>
        <div className="mnav__foot">
          {state.user ? (
            <>
              {isAdmin && (
                <Button block to={to.admin()} icon="shield" variant="accent">
                  Buka Panel Admin
                </Button>
              )}
              <Button block to={to.dashboard()} icon="home">
                Dashboard saya
              </Button>
            </>
          ) : (
            <>
              <Button block to={to.login()} variant="secondary">
                Masuk
              </Button>
              <Button block to={to.register()}>
                Daftar akun
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function Footer() {
  const { resetDemo } = useStore();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo inverse />
          <p>{SITE.taglineId}</p>
          <p className="footer__phase">
            <Icon name="info" size={14} /> {SITE.phase}. Data spasial poligon Loa Kulu aktual; angka pendanaan &amp; kesesuaian spesies bersifat simulasi.
          </p>
        </div>
        <div>
          <h3>Jelajahi</h3>
          <ul>
            <li><Link to={to.explore()}>Explore Map Loa Kulu</Link></li>
            <li><Link to={to.programs()}>Program restorasi</Link></li>
            <li><Link to={to.calculator()}>Kalkulator dampak</Link></li>
          </ul>
        </div>
        <div>
          <h3>Akuntabilitas</h3>
          <ul>
            <li><Link to={to.transparency()}>Transparansi &amp; laporan</Link></li>
            <li><Link to={to.about()}>Tentang &amp; kemitraan ZISWAF</Link></li>
            <li><Link to={to.about('metodologi')}>Metodologi dampak</Link></li>
          </ul>
        </div>
        <div>
          <h3>Akun &amp; Kurasi</h3>
          <ul>
            <li><Link to={to.login()}>Masuk (Donatur / Admin)</Link></li>
            <li><Link to={to.register()}>Daftar donatur</Link></li>
            <li>
              <button type="button" className="linklike" onClick={resetDemo}>
                Reset data simulasi
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© 2026 {SITE.name} · Fokus Prototipe: {SITE.regionFocus}</span>
        <span>{SITE.partnerLabel}</span>
      </div>
    </footer>
  );
}

export function PublicLayout({ children, overlayNav, noFooter, wideNav }: { children: ReactNode; overlayNav?: boolean; noFooter?: boolean; wideNav?: boolean }) {
  return (
    <div className={cx('shell', overlayNav && 'shell--overlay')}>
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Lewati ke konten
      </a>
      <Navbar overlay={overlayNav} wide={wideNav} />
      <SandboxBanner />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      {!noFooter && <Footer />}
    </div>
  );
}
