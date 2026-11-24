# Map integration (Phase 2 plan)

Phase 1 deliberately renders **no geometry**. `MapView` shows `MapPlaceholder` whenever
`features` is `null`, and every interaction (selecting a program) already goes through
the same `onSelect(projectId)` callback a polygon click will use later.

## Data contract

- Format: GeoJSON `FeatureCollection`, CRS **EPSG:4326** (convert from SHP/GPKG with
  `ogr2ogr -f GeoJSON -t_srs EPSG:4326 sites.geojson sites.gpkg`).
- Each feature has `properties.project_id` (see `FEATURE_JOIN_KEY` in `types.ts`).
- Site attributes (climate, soil, slope…) may live in the same properties or in a
  separate table — map them to `SiteAttributes` inside `services/siteService.ts`
  (`setSiteAttributeSource`). Program/funding data stays in `projectService`.
- Run `checkJoin(fc, programIds)` once to catch ids that don't match.

## Wiring MapLibre GL JS (suggested)

1. `npm i maplibre-gl`
2. Create `src/map/adapters/maplibreAdapter.ts` implementing `MapEngineAdapter`:
   - `addSource('sites', { type: 'geojson', data, promoteId: 'project_id' })`
   - fill + line layers; `feature-state` `{ selected: true }` for the active polygon
   - `map.on('click', 'sites-fill', e => cb(e.features[0].properties.project_id))`
3. In `MapView.tsx`, mount the adapter when `features` is non-null; keep the
   placeholder as the empty/error state.
4. Large datasets: serve as vector tiles (PMTiles / Martin from PostGIS) instead of raw GeoJSON.
