import type { ReactNode } from 'react';
import { Link, to, useRouter, type RouteName } from '../router/router';
import { useStore } from '../store/AppStore';
import { cx } from '../lib/format';
import { Icon, type IconName } from '../components/ui/Icon';
import { Navbar, SandboxBanner } from './PublicLayout';
import { Badge } from '../components/ui/Badge';

const ITEMS: { label: string; to: string; name: RouteName; icon: IconName }[] = [
  { label: 'Ringkasan', to: to.dashboard(), name: 'dashboard', icon: 'home' },
  { label: 'Riwayat donasi', to: to.dashboard('history'), name: 'dashboard-history', icon: 'history' },
  { label: 'Dampak saya', to: to.dashboard('impact'), name: 'dashboard-impact', icon: 'chart' },
  { label: 'Tersimpan', to: to.dashboard('saved'), name: 'dashboard-saved', icon: 'heart' },
  { label: 'Profil', to: to.dashboard('profile'), name: 'dashboard-profile', icon: 'user' },
];

/** Logged-in area: same tokens as public pages, but a working-tool layout with side navigation. */
export function DashboardLayout({ title, lead, actions, children }: { title: string; lead?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { route } = useRouter();
  const { state, savedIds } = useStore();
  const user = state.user!;
  return (
    <div className="shell shell--dash">
      <Navbar wide />
      <SandboxBanner />
      <div className="dash container container--wide">
        <aside className="dash__side" aria-label="Navigasi dashboard">
          <div className="dash__who">
            <span className="avatar avatar--lg">{user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
            <div>
              <b>{user.name}</b>
              <small>{user.is_demo ? 'Akun demo' : 'Donatur'}</small>
            </div>
          </div>
          <nav className="dash__nav">
            {ITEMS.map((it) => (
              <Link key={it.name} to={it.to} className={cx('dash__link', route.name === it.name && 'is-active')} aria-current={route.name === it.name ? 'page' : undefined}>
                <Icon name={it.icon} size={18} />
                <span>{it.label}</span>
                {it.name === 'dashboard-saved' && savedIds.length > 0 && <Badge tone="count">{savedIds.length}</Badge>}
              </Link>
            ))}
          </nav>
          <div className="dash__sim">
            <Icon name="shield" size={16} />
            <span>Semua transaksi di akun ini adalah simulasi.</span>
          </div>
        </aside>
        <main id="main" className="dash__main" tabIndex={-1}>
          <header className="dash__head">
            <div>
              <h1>{title}</h1>
              {lead && <p>{lead}</p>}
            </div>
            {actions && <div className="dash__actions">{actions}</div>}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
