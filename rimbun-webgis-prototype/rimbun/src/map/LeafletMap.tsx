import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LoaKuluPolygonProps, ProjectStatus, ProjectView } from '../types';
import {
  loadLoaKuluBoundaryGeoJSON,
  loadLoaKuluGeoJSON,
  type LoaKuluBoundaryCollection,
  type LoaKuluFeatureCollection,
  type LoaKuluGeoFeature,
} from '../services/spatialService';
import { cx, formatNumber } from '../lib/format';
import { assetUrl } from '../lib/assets';
import { Icon } from '../components/ui/Icon';

export type MapMode = 'programs' | 'all-deforestation';
export type BasemapId = 'light' | 's2-2025';

export interface LeafletMapProps {
  mode: MapMode;
  selectedCode: string | null;
  visibleCodes?: Set<string> | null;
  projectsByCode: Map<string, ProjectView>;
  includeDrafts?: boolean;
  onSelectPolygon: (lkCode: string) => void;
  compact?: boolean;
  className?: string;
  defaultBasemap?: BasemapId;
}

// Standalone GADM Loa Kulu boundary bounds + Sentinel-2 tile grid coverage
const LOA_KULU_BOUNDS: L.LatLngBoundsExpression = [
  [-0.88239, 116.5309],
  [-0.41592, 117.06873],
];

const S2_TILE_BOUNDS: L.LatLngBoundsExpression = [
  [-0.89, 116.52],
  [-0.41, 117.08],
];

const TRANSPARENT_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const STATUS_STYLE: Record<ProjectStatus, { color: string; fillColor: string }> = {
  urgent: { color: '#9c4f26', fillColor: '#c95c30' },
  open: { color: '#1b4730', fillColor: '#2f6b47' },
  funded: { color: '#8a5e14', fillColor: '#c98f2e' },
  planting: { color: '#143724', fillColor: '#285539' },
  monitoring: { color: '#244b5e', fillColor: '#48798f' },
};

function styleForFeature(
  props: LoaKuluPolygonProps,
  mode: MapMode,
  projectsByCode: Map<string, ProjectView>,
  selectedCode: string | null,
  includeDrafts: boolean,
): L.PathOptions {
  const proj = projectsByCode.get(props.lk_code);
  const isSelected = selectedCode === props.lk_code;
  const isPublished = proj?.publication_status === 'published';
  const isDraft = proj?.publication_status === 'draft';

  if (mode === 'programs') {
    if (!proj) {
      return { opacity: 0, fillOpacity: 0, interactive: false };
    }
    if (isDraft && includeDrafts) {
      return {
        color: isSelected ? '#0d1c14' : '#8a5e14',
        weight: isSelected ? 3 : 2,
        dashArray: '5 4',
        fillColor: '#d9a441',
        fillOpacity: isSelected ? 0.68 : 0.46,
      };
    }
    const base = STATUS_STYLE[proj.status] ?? STATUS_STYLE.open;
    return {
      color: isSelected ? '#0d1c14' : base.color,
      weight: isSelected ? 3.2 : 1.8,
      fillColor: base.fillColor,
      fillOpacity: isSelected ? 0.75 : 0.56,
    };
  }

  // Mode: 'all-deforestation'
  if (isPublished) {
    return {
      color: isSelected ? '#0d1c14' : '#143724',
      weight: isSelected ? 3.2 : 2.1,
      fillColor: '#2f6b47',
      fillOpacity: isSelected ? 0.78 : 0.62,
    };
  }
  if (isDraft && includeDrafts) {
    return {
      color: isSelected ? '#0d1c14' : '#8a5e14',
      weight: isSelected ? 3.2 : 2,
      dashArray: '5 4',
      fillColor: '#d9a441',
      fillOpacity: isSelected ? 0.72 : 0.5,
    };
  }
  if (props.kelas_id === 1) {
    return {
      color: isSelected ? '#0d1c14' : '#8c3f1c',
      weight: isSelected ? 3.2 : 1.25,
      fillColor: '#c95c30',
      fillOpacity: isSelected ? 0.72 : 0.44,
    };
  }
  return {
    color: isSelected ? '#0d1c14' : '#8f671e',
    weight: isSelected ? 3.2 : 1.15,
    fillColor: '#d49a3a',
    fillOpacity: isSelected ? 0.7 : 0.38,
  };
}

export function LeafletMap({
  mode,
  selectedCode,
  visibleCodes,
  projectsByCode,
  includeDrafts = false,
  onSelectPolygon,
  compact = false,
  className,
  defaultBasemap = 'light',
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const refLabelLayerRef = useRef<L.TileLayer | null>(null);
  const s2LayerRef = useRef<L.TileLayer | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const layersByCodeRef = useRef<Map<string, L.Layer>>(new Map());
  const onSelectRef = useRef(onSelectPolygon);
  onSelectRef.current = onSelectPolygon;

  const [basemap, setBasemap] = useState<BasemapId>(defaultBasemap);
  const [geojson, setGeojson] = useState<LoaKuluFeatureCollection | null>(null);
  const [boundaryGeojson, setBoundaryGeojson] = useState<LoaKuluBoundaryCollection | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Load 163 Loa Kulu polygons + standalone GADM boundary
  useEffect(() => {
    let alive = true;
    Promise.all([loadLoaKuluGeoJSON(), loadLoaKuluBoundaryGeoJSON().catch(() => null)])
      .then(([fc, bfc]) => {
        if (!alive) return;
        setGeojson(fc);
        if (bfc) setBoundaryGeojson(bfc);
      })
      .catch((err) => {
        if (alive) setLoadErr(err instanceof Error ? err.message : 'Gagal memuat peta Loa Kulu');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Initialize Leaflet Canvas Map + Esri World Gray Canvas + ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: true,
      minZoom: 9,
      maxZoom: 18,
    });

    // Dedicated pane beneath polygons so administrative boundary never intercepts clicks
    const bPane = map.createPane('boundaryPane');
    bPane.style.zIndex = '360';
    bPane.style.pointerEvents = 'none';

    map.fitBounds(LOA_KULU_BOUNDS, { padding: compact ? [12, 12] : [26, 26] });

    // Always mount Esri Light Gray Base underneath so Sentinel-2 surrounding context stays crisp
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 16,
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri &mdash; World Light Gray',
      },
    ).addTo(map);

    const refLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 16,
        maxZoom: 18,
        opacity: 0.88,
      },
    ).addTo(map);

    const s2 = L.tileLayer(assetUrl('/tiles/s2_2025/{z}/{x}/{y}.webp'), {
      minZoom: 10,
      maxNativeZoom: 14,
      maxZoom: 18,
      bounds: S2_TILE_BOUNDS,
      errorTileUrl: TRANSPARENT_TILE,
      opacity: 0.98,
      attribution: 'Sentinel-2 L2A 2025 · Clipped GADM Loa Kulu',
    });

    mapRef.current = map;
    refLabelLayerRef.current = refLabels;
    s2LayerRef.current = s2;

    let rafId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      refLabelLayerRef.current = null;
      s2LayerRef.current = null;
      boundaryLayerRef.current = null;
      geoLayerRef.current = null;
      layersByCodeRef.current.clear();
    };
  }, [compact]);

  // Basemap switching
  useEffect(() => {
    const map = mapRef.current;
    const s2 = s2LayerRef.current;
    const refs = refLabelLayerRef.current;
    if (!map || !s2 || !refs) return;
    if (basemap === 's2-2025') {
      if (!map.hasLayer(s2)) s2.addTo(map);
      if (map.hasLayer(refs)) map.removeLayer(refs);
    } else {
      if (map.hasLayer(s2)) map.removeLayer(s2);
      if (!map.hasLayer(refs)) refs.addTo(map);
    }
  }, [basemap]);

  // Render standalone GADM Loa Kulu Kecamatan & Desa boundaries
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundaryGeojson) return;

    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    const isSat = basemap === 's2-2025';
    const bLayer = L.geoJSON(boundaryGeojson as unknown as GeoJSON.GeoJsonObject, {
      pane: 'boundaryPane',
      interactive: false,
      style: (feat) => {
        const lvl = feat?.properties?.level;
        if (lvl === 'kecamatan') {
          return {
            color: isSat ? '#f6ead0' : '#1a3324',
            weight: 2.5,
            opacity: 0.92,
            dashArray: '7 5',
            fillOpacity: 0,
          };
        }
        return {
          color: isSat ? 'rgba(246, 234, 208, 0.55)' : 'rgba(40, 85, 57, 0.35)',
          weight: 0.9,
          dashArray: '2 4',
          fillOpacity: 0,
        };
      },
    }).addTo(map);

    boundaryLayerRef.current = bLayer;
  }, [boundaryGeojson, basemap]);

  // Render/update GeoJSON deforestation layer whenever mode, filter, or curation changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }
    layersByCodeRef.current.clear();

    const filteredFeatures = geojson.features.filter((f) => {
      const code = f.properties.lk_code;
      if (visibleCodes && !visibleCodes.has(code)) return false;
      if (mode === 'programs') {
        const p = projectsByCode.get(code);
        if (!p) return false;
        if (!includeDrafts && p.publication_status !== 'published') return false;
      }
      return true;
    });

    const filteredFC: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredFeatures as unknown as GeoJSON.Feature[],
    };

    const gl = L.geoJSON(filteredFC, {
      style: (feat) => {
        const props = (feat as unknown as LoaKuluGeoFeature).properties;
        return styleForFeature(props, mode, projectsByCode, selectedCode, includeDrafts);
      },
      onEachFeature: (feat, layer) => {
        const props = (feat as unknown as LoaKuluGeoFeature).properties;
        const proj = projectsByCode.get(props.lk_code);
        layersByCodeRef.current.set(props.lk_code, layer);

        if (!compact) {
          const title = proj ? `${proj.name}` : `Poligon ${props.lk_code} (${props.id})`;
          const badge = proj
            ? proj.publication_status === 'draft'
              ? 'Draft Admin'
              : 'Program Restorasi'
            : props.kelas_id === 1
              ? 'Lahan Terbuka · Non-program'
              : 'Semak / Kebun · Non-program';

          layer.bindTooltip(
            `<div class="lmap__tip"><strong>${props.lk_code}</strong> · ${badge}<br/><span>${title}</span><br/><small>${formatNumber(props.luas_ha)} ha · Lereng ${props.slope_med.toFixed(1)}°</small></div>`,
            { sticky: true, direction: 'top', className: 'rimbun-tooltip' },
          );
        }

        layer.on('click', () => onSelectRef.current(props.lk_code));
        layer.on('mouseover', () => {
          (layer as L.Path).setStyle({ weight: 3, fillOpacity: 0.78 });
        });
        layer.on('mouseout', () => {
          (layer as L.Path).setStyle(styleForFeature(props, mode, projectsByCode, selectedCode, includeDrafts));
        });
      },
    }).addTo(map);

    geoLayerRef.current = gl;

    if (compact && selectedCode) {
      const selLayer = layersByCodeRef.current.get(selectedCode) as L.Polygon | undefined;
      if (selLayer && typeof selLayer.getBounds === 'function') {
        map.fitBounds(selLayer.getBounds(), { padding: [24, 24], maxZoom: 15 });
      }
    }
  }, [geojson, mode, visibleCodes, projectsByCode, selectedCode, includeDrafts, compact]);

  // Smooth flyTo selected polygon when clicked in list/map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCode) return;
    const layer = layersByCodeRef.current.get(selectedCode) as L.Polygon | undefined;
    if (layer && typeof layer.getBounds === 'function' && layer.getBounds().isValid()) {
      map.flyToBounds(layer.getBounds(), {
        padding: compact ? [24, 24] : [60, 60],
        maxZoom: 15,
        duration: 0.55,
      });
    }
  }, [selectedCode, compact, geojson, mode]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const bl = boundaryLayerRef.current;
    if (bl && bl.getBounds().isValid()) {
      map.flyToBounds(bl.getBounds(), { padding: [24, 24], maxZoom: 13, duration: 0.5 });
      return;
    }
    map.flyToBounds(LOA_KULU_BOUNDS, { padding: [24, 24], duration: 0.5 });
  };

  return (
    <div className={cx('lmap', compact && 'lmap--compact', className)}>
      <div ref={containerRef} className="lmap__canvas" />

      {!geojson && !loadErr && (
        <div className="lmap__status">
          <span className="spinner" /> Memuat 163 poligon Loa Kulu…
        </div>
      )}
      {loadErr && (
        <div className="lmap__status lmap__status--err">
          <Icon name="alert" size={15} /> {loadErr}
        </div>
      )}

      {/* Basemap Switcher */}
      {!compact && (
        <div className="lmap__basemap" role="group" aria-label="Pilih peta dasar">
          <button
            type="button"
            className={cx('lmap__bopt', basemap === 'light' && 'is-active')}
            onClick={() => setBasemap('light')}
          >
            Esri Gray
          </button>
          <button
            type="button"
            className={cx('lmap__bopt', basemap === 's2-2025' && 'is-active')}
            onClick={() => setBasemap('s2-2025')}
          >
            Sentinel-2 2025
          </button>
        </div>
      )}

      {/* Map Year / Source Pill when Satellite Active */}
      {basemap === 's2-2025' && !compact && (
        <div className="lmap__satbadge">
          Sentinel-2 L2A · Komposit 2025 (10 m)
        </div>
      )}

      {/* Zoom & Fit Controls */}
      {!compact && (
        <div className="lmap__ctrls">
          <button type="button" onClick={zoomIn} aria-label="Perbesar peta" title="Perbesar">
            <Icon name="plus" size={16} />
          </button>
          <button type="button" onClick={zoomOut} aria-label="Perkecil peta" title="Perkecil">
            <Icon name="minus" size={16} />
          </button>
          <button type="button" onClick={fitAll} aria-label="Fokus batas Kecamatan Loa Kulu" title="Fokus Kecamatan Loa Kulu">
            <Icon name="maximize" size={15} />
          </button>
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="lmap__legend">
          <span><i className="swatch swatch--boundary" /> Batas Kec. Loa Kulu</span>
          {mode === 'programs' ? (
            <>
              <span><i className="swatch tone-clay" /> Mendesak</span>
              <span><i className="swatch tone-forest" /> Menggalang dana</span>
              <span><i className="swatch tone-ochre" /> Terdanai</span>
              <span><i className="swatch tone-slate" /> Monitoring</span>
              {includeDrafts && (
                <span><i className="swatch swatch--draft" /> Draft Admin</span>
              )}
            </>
          ) : (
            <>
              <span><i className="swatch swatch--prog" /> Sudah Jadi Program</span>
              <span><i className="swatch tone-clay" /> Kelas 1 · Lahan Terbuka</span>
              <span><i className="swatch tone-ochre" /> Kelas 2 · Semak / Kebun</span>
              {includeDrafts && (
                <span><i className="swatch swatch--draft" /> Draft Admin</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
