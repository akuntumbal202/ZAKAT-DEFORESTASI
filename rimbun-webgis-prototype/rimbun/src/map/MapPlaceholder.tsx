import { useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { cx } from '../lib/format';

/**
 * Empty map canvas reserved for the future interactive map.
 * The background pattern is purely decorative — it is NOT geography.
 */
function ContourArt() {
  const rings = useMemo(() => {
    const out: string[] = [];
    const centers = [
      [260, 220],
      [760, 420],
      [980, 140],
    ];
    centers.forEach(([cx0, cy0], ci) => {
      for (let k = 1; k <= 9; k++) {
        const r = 26 * k + ci * 8;
        let d = '';
        for (let a = 0; a <= 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          const wob = 1 + 0.08 * Math.sin(3 * t + k * 0.7 + ci) + 0.05 * Math.cos(5 * t + ci);
          const x = cx0 + Math.cos(t) * r * 1.35 * wob;
          const y = cy0 + Math.sin(t) * r * wob;
          d += `${a ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        }
        out.push(d + 'Z');
      }
    });
    return out;
  }, []);
  return (
    <svg className="mapph__art" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id="mapgrid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="1200" height="600" fill="url(#mapgrid)" opacity="0.35" />
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i % 3 === 0 ? 1.1 : 0.6} opacity={0.5} />
      ))}
    </svg>
  );
}

export interface LegendItem {
  label: string;
  tone: string;
}

export function MapPlaceholder({
  selectedLabel,
  legend,
  className,
  compact,
}: {
  selectedLabel?: string | null;
  legend: LegendItem[];
  className?: string;
  compact?: boolean;
}) {
  const disabledTitle = 'Tersedia setelah data spasial diintegrasikan';
  return (
    <div className={cx('mapph', compact && 'mapph--compact', className)} role="region" aria-label="Area peta (placeholder)">
      <ContourArt />

      <div className="mapph__controls" aria-label="Kontrol peta (belum aktif)">
        <div className="mapph__ctrl-group">
          <button disabled title={disabledTitle} aria-label="Perbesar (belum aktif)">
            <Icon name="plus" size={17} />
          </button>
          <button disabled title={disabledTitle} aria-label="Perkecil (belum aktif)">
            <Icon name="minus" size={17} />
          </button>
        </div>
        <div className="mapph__ctrl-group">
          <button disabled title={disabledTitle} aria-label="Lokasi saya (belum aktif)">
            <Icon name="crosshair" size={17} />
          </button>
          <button disabled title={disabledTitle} aria-label="Lapisan peta (belum aktif)">
            <Icon name="layers" size={17} />
          </button>
          <button disabled title={disabledTitle} aria-label="Layar penuh (belum aktif)">
            <Icon name="maximize" size={17} />
          </button>
        </div>
      </div>

      {!compact && (
        <div className="mapph__card">
          <span className="mapph__card-icon">
            <Icon name="map" size={22} />
          </span>
          <h3>Peta interaktif hadir di fase berikutnya</h3>
          <p>Data spasial SHP/GPKG sedang disiapkan. Polygon area deforestasi akan tampil di sini dan dapat diklik untuk membuka detail lokasi.</p>
          <ul className="mapph__spec">
            <li>
              <Icon name="file" size={13} /> GeoJSON
            </li>
            <li>
              <Icon name="globe" size={13} /> EPSG:4326
            </li>
            <li>
              <Icon name="polygon" size={13} /> join: project_id
            </li>
          </ul>
          <p className="mapph__hint">Sementara itu, pilih lokasi dari daftar untuk mencoba panel detail.</p>
        </div>
      )}

      {selectedLabel && (
        <div className="mapph__selected" role="status">
          <Icon name="polygon" size={14} /> {selectedLabel}
          {!compact && <span className="muted"> · polygon akan disorot di sini</span>}
        </div>
      )}

      <div className="mapph__legend">
        <span className="mapph__legend-title">Legenda (rencana)</span>
        <ul>
          {legend.map((l) => (
            <li key={l.label}>
              <span className={cx('swatch swatch--poly', `tone-${l.tone}`)} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      <span className="mapph__watermark">Placeholder · bukan data geografis</span>
    </div>
  );
}
