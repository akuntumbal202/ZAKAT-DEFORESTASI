import { SPECIES_CATALOG, SPECIES_CATALOG_BY_ID } from '../speciesCatalog';
import type { Species } from '../../types';

/**
 * Re-exported from the modular `src/data/speciesCatalog.ts` so existing
 * components continue working while the plant team updates `speciesCatalog.ts`.
 */
export const SPECIES: Species[] = SPECIES_CATALOG;
export const SPECIES_BY_ID: Record<string, Species> = SPECIES_CATALOG_BY_ID;
