import { PublicLayout } from '../layouts/PublicLayout';
import { EmptyState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { to } from '../router/router';

export function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="container section">
        <EmptyState
          icon="map"
          title="Halaman tidak ditemukan"
          body="Tautan ini tidak mengarah ke halaman mana pun. Kembali ke beranda atau jelajahi peta."
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button to={to.home()} variant="secondary">
                Beranda
              </Button>
              <Button to={to.explore()} icon="map">
                Explore Map
              </Button>
            </div>
          }
        />
      </div>
    </PublicLayout>
  );
}
