import { useState } from 'react';
import type { LoaKuluPolygonProps } from '../../types';
import { cx, formatNumber } from '../../lib/format';
import { useStore } from '../../store/AppStore';
import { to, useRouter } from '../../router/router';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Callout } from '../ui/Feedback';

/**
 * Inspector sidebar for non-program deforestation polygons in Loa Kulu.
 * Displays extracted GIS environmental parameters and lets public visitors
 * nominate the polygon ("Usulkan Jadi Program") for Admin prioritization.
 */
export function RawPolygonSidebar({
  polygon,
  onClose,
}: {
  polygon: LoaKuluPolygonProps;
  onClose: () => void;
}) {
  const { state, nominations, hasNominated, toggleNominate } = useStore();
  const { navigate } = useRouter();
  const [expanded, setExpanded] = useState(false);

  const count = nominations[polygon.lk_code] ?? 0;
  const voted = hasNominated(polygon.lk_code);
  const isAdmin = state.user?.role === 'admin';

  return (
    <aside
      className={cx('psidebar', expanded && 'is-expanded')}
      aria-label={`Data lahan terdeforestasi ${polygon.lk_code}`}
    >
      <button
        type="button"
        className="psidebar__grab"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Perkecil panel' : 'Perbesar panel'}
      >
        <span />
      </button>

      <header className="psidebar__head">
        <div className="psidebar__head-top">
          <span className="psidebar__id num">
            <Icon name="polygon" size={14} /> {polygon.lk_code}
          </span>
          <div className="psidebar__head-actions">
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup panel">
              <Icon name="x" />
            </button>
          </div>
        </div>
        <h2 className="psidebar__title">Lahan Terdeforestasi · {polygon.lk_code}</h2>
        <div className="psidebar__meta">
          <Badge tone={polygon.kelas_id === 1 ? 'urgent' : 'funded'}>
            <span className="badge__dot" aria-hidden />
            {polygon.kelas_id === 1 ? 'Kelas 1 · Lahan Terbuka' : 'Kelas 2 · Semak / Kebun'}
          </Badge>
          <Badge tone="muted">Belum Jadi Program</Badge>
        </div>
      </header>

      <div className="psidebar__scroll">
        <div className="raw-summary">
          <div className="raw-summary__kpis">
            <div>
              <span>Luas poligon</span>
              <b className="num">{formatNumber(polygon.luas_ha)} ha</b>
            </div>
            <div>
              <span>Usulan publik</span>
              <b className="num">{count} dukungan</b>
            </div>
          </div>

          <dl className="kv kv--grid">
            <div>
              <dt><Icon name="mountain" size={14} /> Elevasi (FABDEM)</dt>
              <dd className="num">{polygon.elev_med.toFixed(1)} m <small className="muted">(Δ {polygon.elev_rng.toFixed(1)} m)</small></dd>
            </div>
            <div>
              <dt><Icon name="trend" size={14} /> Kelerengan</dt>
              <dd className="num">
                {polygon.slope_med.toFixed(1)}° med · P90 {polygon.slope_p90.toFixed(1)}°
              </dd>
            </div>
            <div>
              <dt><Icon name="rain" size={14} /> Hujan (ERA5-Land)</dt>
              <dd className="num">{Math.round(polygon.rain_mean).toLocaleString('id-ID')} mm/th</dd>
            </div>
            <div>
              <dt><Icon name="layers" size={14} /> Tanah Dominan</dt>
              <dd>{polygon.tanah_dom}</dd>
            </div>
          </dl>

          <dl className="kv">
            <div>
              <dt>Kode Poligon Sumber</dt>
              <dd className="num">{polygon.id}</dd>
            </div>
            <div>
              <dt>Transisi Tutupan</dt>
              <dd>Hutan (2020) → {polygon.kelas_id === 1 ? 'Lahan Terbuka' : 'Semak / Kebun'} (2025)</dd>
            </div>
            <div>
              <dt>Cakupan Tanah</dt>
              <dd className="num">{polygon.tanah_dom_pct.toFixed(1)}% ({polygon.tanah_n_kelas} kelas)</dd>
            </div>
            <div>
              <dt>Variasi Lereng</dt>
              <dd>
                σ = {polygon.slope_std.toFixed(1)}°{' '}
                {polygon.topo_heterogen ? '· Topografi heterogen' : '· Relatif seragam'}
              </dd>
            </div>
          </dl>

          <Callout tone="info" title="Status belum menjadi program">
            Lokasi ini berasal dari pemetaan deforestasi Loa Kulu (2020–2025), namun belum dikurasi menjadi program penggalangan dana. Rencana spesies dan anggaran akan tersedia setelah dipublikasikan oleh pengelola.
          </Callout>
        </div>
      </div>

      <footer className="psidebar__foot">
        <Button
          variant={voted ? 'secondary' : 'primary'}
          icon={voted ? 'check' : 'flag'}
          onClick={() => toggleNominate(polygon.lk_code)}
          className="psidebar__fullbtn"
        >
          {voted ? `Diusulkan (${count})` : `Usulkan Program (${count})`}
        </Button>
        {isAdmin && (
          <Button
            variant="accent"
            icon="edit"
            onClick={() => navigate(to.adminMap(polygon.lk_code))}
          >
            Kurasi
          </Button>
        )}
      </footer>
    </aside>
  );
}
