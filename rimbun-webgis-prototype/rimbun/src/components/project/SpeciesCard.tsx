import type { SpeciesRecommendation } from '../../types';
import { SPECIES_ROLE_LABEL, resolveSpeciesMetrics } from '../../data/speciesCatalog';
import { useStore } from '../../store/AppStore';
import { formatNumber, formatPercent } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';

const FORM_GLYPH: Record<string, string> = {
  pohon: 'trees',
  'pohon buah': 'leaf',
  mangrove: 'droplet',
  palma: 'sprout',
  bambu: 'sprout',
};

/** Species recommendation card — reads directly from live Supabase/Store species database. */
export function SpeciesCard({ rec, share }: { rec: SpeciesRecommendation; share: number }) {
  const { speciesById } = useStore();
  const sp = speciesById[rec.species_id];
  if (!sp) {
    return (
      <article className="species">
        <div className="species__img" aria-hidden>
          <Icon name="sprout" size={28} />
          <span>Spesies kustom</span>
        </div>
        <div className="species__body">
          <header className="species__head">
            <div>
              <h4 className="species__name">{rec.species_id}</h4>
              <p className="species__sci">Entri spesies belum terdaftar di katalog aktif</p>
            </div>
            <div className="species__count">
              <span className="num">{formatNumber(rec.seedlings)}</span>
              <small>bibit · {formatPercent(share * 100)}</small>
            </div>
          </header>
          <div className="species__why">
            <span className="species__why-label">Alasan kesesuaian</span>
            <p>{rec.suitability_reason.replace(/^Placeholder:\s*/i, '')}</p>
          </div>
        </div>
      </article>
    );
  }

  const metrics = resolveSpeciesMetrics(sp);

  return (
    <article className="species">
      <div className="species__img" aria-hidden>
        <Icon name={FORM_GLYPH[sp.growth_form] ?? 'leaf'} size={28} />
        <span>{SPECIES_ROLE_LABEL[sp.suitability.role]}</span>
      </div>
      <div className="species__body">
        <header className="species__head">
          <div>
            <div className="species__title-row">
              <h4 className="species__name">{sp.local_name}</h4>
              <Badge tone={sp.verification_status === 'valid' ? 'open' : 'muted'}>
                {sp.verification_status === 'valid' ? 'Data terverifikasi' : 'Referensi awal'}
              </Badge>
            </div>
            <p className="species__sci">{sp.scientific_name}</p>
          </div>
          <div className="species__count">
            <span className="num">{formatNumber(rec.seedlings)}</span>
            <small>bibit · {formatPercent(share * 100)}</small>
          </div>
        </header>
        {sp.description && <p className="species__desc">{sp.description}</p>}
        <div className="species__why">
          <span className="species__why-label">Alasan kesesuaian (SDSS)</span>
          <p>{rec.suitability_reason.replace(/^Placeholder:\s*/i, '')}</p>
        </div>
        <footer className="species__foot">
          <ul className="chips">
            <li className="chip">{SPECIES_ROLE_LABEL[sp.suitability.role]}</li>
            <li className="chip num">
              ≈ {metrics.co2TonPerHaYr.toFixed(1).replace('.', ',')} t CO₂/ha/th
            </li>
            {sp.traits.map((t) => (
              <li key={t} className="chip">
                {t}
              </li>
            ))}
          </ul>
          {rec.survival_estimate != null && (
            <span className="species__surv" title="Asumsi kelangsungan hidup berbasis literatur">
              Asumsi hidup <b className="num">{formatPercent(rec.survival_estimate * 100)}</b>
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}
