/**
 * Domain types — Rimbun WebGIS Loa Kulu Prototype
 *
 * Architecture:
 *  1. LoaKuluPolygonProps / SiteAttributes -> actual enriched spatial attributes (163 polygons).
 *  2. RestorationProject -> curated program metadata, funding, species plan, and status.
 *  Linked 1:1 via `polygon_code` (lk_code e.g. 'LK-124') and GEE `geometry_reference`.
 */

export type ProjectStatus = 'open' | 'urgent' | 'funded' | 'planting' | 'monitoring';
export type PublicationStatus = 'published' | 'draft';
export type ProjectCategory = 'pascatambang' | 'hutan-lahan-kering' | 'agroforestri' | 'riparian';
export type DataProvenance = 'mock' | 'dataset';
export type UserRole = 'donor' | 'admin';

export interface LoaKuluPolygonProps {
  lk_code: string;
  id: string;
  count: number;
  kelas_id: 1 | 2;
  Luas_m2: number;
  luas_ha: number;
  elev_med: number;
  elev_rng: number;
  slope_med: number;
  slope_std: number;
  slope_p90: number;
  topo_heterogen: boolean;
  rain_mean: number;
  tanah_dom: string;
  tanah_dom_pct: number;
  tanah_n_kelas: number;
  rep_lon: number;
  rep_lat: number;
  bbox: [number, number, number, number];
}

export interface SiteAttributes {
  project_id: string;
  lk_code?: string;
  geometry_reference: string | null;
  area_ha: number;
  region_label: string;
  kelas_id?: 1 | 2;
  climate: {
    type: string;
    rainfall_mm_year: string;
    temperature_c: string;
  };
  soil: {
    type: string;
    ph: string;
    drainage: string;
    dominance_pct?: number;
    class_count?: number;
  };
  slope: {
    class: string;
    range_pct: string;
    median_deg?: number;
    p90_deg?: number;
    topo_heterogen?: boolean;
  };
  elevation_m: string;
  land_cover_before: string;
  land_cover_now: string;
  disturbance: string;
  other_notes: string[];
  provenance: DataProvenance;
}

export interface Species {
  id: string;
  local_name: string;
  scientific_name: string;
  growth_form: 'pohon' | 'pohon buah' | 'palma' | 'bambu';
  description: string;
  traits: string[];
}

export interface SpeciesRecommendation {
  species_id: string;
  seedlings: number;
  suitability_reason: string;
  /** Illustrative survival-rate placeholder, 0–1. */
  survival_estimate: number | null;
}

export interface CostItem {
  label: string;
  amount: number;
  note?: string;
}

export interface ProjectUpdate {
  date: string;
  title: string;
  body: string;
}

export interface RestorationProject {
  id: string;
  polygon_code: string;
  publication_status: PublicationStatus;
  name: string;
  short_name: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  category: ProjectCategory;
  condition_summary: string;
  rehab_needs: string;
  recommended_species: SpeciesRecommendation[];
  cost_breakdown: CostItem[];
  funding_target: number;
  funding_collected_base: number;
  donor_count_base: number;
  started_at: string;
  updated_at?: string;
  updates?: ProjectUpdate[];
  visual_seed: number;
  image_url: string;
  tags: string[];
}

export interface ProjectView extends RestorationProject {
  updates: ProjectUpdate[];
  funding_collected: number;
  funding_percentage: number;
  funding_remaining: number;
  donor_count: number;
  restoration_cost: number;
  total_seedlings: number;
  cost_per_seedling: number;
  site: SiteAttributes | null;
}

export type PaymentMethodId = 'va-bank' | 'qris' | 'ewallet' | 'card';

export interface Donation {
  id: string;
  project_id: string;
  user_id: string;
  amount: number;
  display_name: string;
  anonymous: boolean;
  message: string;
  payment_method: PaymentMethodId;
  created_at: string;
  status: 'simulasi-berhasil';
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_at: string;
  is_demo: boolean;
  role: UserRole;
}

export interface AuthIntent {
  kind: 'donate' | 'save' | 'dashboard' | 'admin';
  project_id?: string;
  amount?: number;
  return_to: string;
}
