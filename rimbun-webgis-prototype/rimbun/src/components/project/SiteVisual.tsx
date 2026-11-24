import type { RestorationProject } from '../../types';
import { cx } from '../../lib/format';
import { assetUrl } from '../../lib/assets';

const FALLBACK_BY_CAT: Record<RestorationProject['category'], string> = {
  pascatambang: '/images/site-watershed.jpg',
  'hutan-lahan-kering': '/images/site-corridor.jpg',
  agroforestri: '/images/site-agroforestry.jpg',
  riparian: '/images/site-peatland.jpg',
};

/**
 * Site editorial visual using natural conservation photographs.
 * Marked cleanly as illustrative ecosystem visual for prototype clarity.
 */
export function SiteVisual({
  category,
  imageUrl,
  alt = 'Visual ilustrasi ekosistem restorasi Loa Kulu',
  className,
  label = true,
  ratio = '16/10',
}: {
  seed?: number;
  category: RestorationProject['category'];
  imageUrl?: string;
  alt?: string;
  className?: string;
  label?: boolean;
  ratio?: string;
}) {
  const src = assetUrl(imageUrl || FALLBACK_BY_CAT[category] || '/images/site-watershed.jpg');
  return (
    <div className={cx('site-visual', className)} style={{ aspectRatio: ratio }}>
      <img src={src} alt={alt} loading="lazy" />
      {label && <span className="site-visual__tag">Ilustrasi ekosistem</span>}
    </div>
  );
}
