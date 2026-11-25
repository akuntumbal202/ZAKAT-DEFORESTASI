import type { ReactNode } from 'react';
import { Logo } from './PublicLayout';
import { Link, to } from '../router/router';
import { useStore } from '../store/AppStore';
import { Icon } from '../components/ui/Icon';
import { SiteVisual } from '../components/project/SiteVisual';
import { formatIDRShort } from '../lib/format';

export function AuthLayout({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  const { state, getProject } = useStore();
  const pending = state.intent?.project_id ? getProject(state.intent.project_id) : undefined;
  return (
    <div className="auth">
      <div className="auth__aside">
        <Logo inverse />
        <div className="auth__quote">
          <p>“Setiap program rehabilitasi terhubung langsung ke lokasi poligon, kondisi fisik lahan, dan rincian biayanya.”</p>
          <span>Prinsip transparansi alokasi berbasis lokasi</span>
        </div>
        <SiteVisual seed={44} category="hutan-lahan-kering" imageUrl="/images/site-corridor.jpg" label={false} ratio="4/3" className="auth__art" />
      </div>
      <main className="auth__main" id="main" tabIndex={-1}>
        <Link to={to.home()} className="auth__back">
          <Icon name="arrow-left" size={16} /> Kembali ke beranda
        </Link>
        <div className="auth__card">
          <h1>{title}</h1>
          {lead && <p className="auth__lead">{lead}</p>}
          {pending && (
            <div className="auth__intent" role="status">
              <Icon name="bookmark" size={16} />
              <span>
                Setelah masuk, Anda akan melanjutkan proses {state.intent?.kind === 'donate' ? 'simulasi donasi' : 'penyimpanan program'} untuk <b>{pending.name}</b>
                {state.intent?.amount ? ` (${formatIDRShort(state.intent.amount)})` : ''}.
              </span>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
