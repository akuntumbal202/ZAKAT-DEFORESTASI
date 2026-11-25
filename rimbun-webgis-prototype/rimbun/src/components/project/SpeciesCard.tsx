import type { SpeciesRecommendation } from '../../types';
import { SPECIES_BY_ID } from '../../data/mock/species';
import { formatNumber, formatPercent } from '../../lib/format';
import { Icon } from '../ui/Icon';

const FORM_GLYPH: Record<string, string> = { pohon: 'trees', 'pohon buah': 'leaf', mangrove: 'droplet', palma: 'sprout' };

/** Species recommendation card. Image slot shows a neutral placeholder until real photos are supplied. */
export function SpeciesCard({ rec, share }: { rec: SpeciesRecommendation; share: number }) {
  const sp = SPECIES_BY_ID[rec.species_id];
  if (!sp) return null;
  return (
    <article className="species">
      <div className="species__img" aria-hidden>
        <Icon name={FORM_GLYPH[sp.growth_form] ?? 'leaf'} size={28} />
        <span>Foto spesies menyusul</span>
      </div>
      <div className="species__body">
        <header className="species__head">
          <div>
            <h4 className="species__name">{sp.local_name}</h4>
            <p className="species__sci">{sp.scientific_name}</p>
          </div>
          <div className="species__count">
            <span className="num">{formatNumber(rec.seedlings)}</span>
            <small>bibit · {formatPercent(share * 100)}</small>
          </div>
        </header>
        <p className="species__desc">{sp.description}</p>
        <div className="species__why">
          <span className="species__why-label">Alasan kesesuaian</span>
          <p>{rec.suitability_reason.replace(/^Placeholder:\s*/i, '')}</p>
        </div>
        <footer className="species__foot">
          <ul className="chips">
            {sp.traits.map((t) => (
              <li key={t} className="chip">
                {t}
              </li>
            ))}
          </ul>
          {rec.survival_estimate != null && (
            <span className="species__surv" title="Asumsi ilustratif, bukan hasil pengukuran">
              Asumsi hidup <b className="num">{formatPercent(rec.survival_estimate * 100)}</b>
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}
