/**
 * Minimal GeoJSON typings for the future map layer (no dependency on @types/geojson).
 * Expected input: a FeatureCollection in EPSG:4326 converted from SHP/GPKG
 * (e.g. `ogr2ogr -f GeoJSON -t_srs EPSG:4326 out.geojson in.gpkg`).
 */
export type Position = [number, number] | [number, number, number];

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}

/** Every feature MUST carry `project_id` — the join key to RestorationProject.id. */
export interface RestorationFeatureProperties {
  project_id: string;
  [attribute: string]: unknown;
}

export interface RestorationFeature {
  type: 'Feature';
  id?: string | number;
  geometry: PolygonGeometry | MultiPolygonGeometry;
  properties: RestorationFeatureProperties;
}

export interface RestorationFeatureCollection {
  type: 'FeatureCollection';
  features: RestorationFeature[];
}

/** Name of the attribute used to join polygons to programs. Change here if the dataset uses another field. */
export const FEATURE_JOIN_KEY = 'project_id' as const;

/**
 * Contract any map engine adapter must satisfy (MapLibre GL JS or Leaflet).
 * Not implemented in Phase 1 by design — see src/map/README.md.
 */
export interface MapEngineAdapter {
  mount(container: HTMLElement): void;
  setData(fc: RestorationFeatureCollection): void;
  setSelected(projectId: string | null): void;
  setFilter(visibleProjectIds: string[] | null): void;
  onFeatureClick(cb: (projectId: string) => void): void;
  fitToFeature(projectId: string): void;
  destroy(): void;
}
