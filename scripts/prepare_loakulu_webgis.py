"""
Stage 1 Data Preparation Script for Rimbun WebGIS (Loa Kulu Prototype)
======================================================================
1. Converts `data/processed/deforestasi_loakulu_enriched_5ha.gpkg` (163 MultiPolygons)
   into:
   - `rimbun-webgis-prototype/rimbun/public/data/loakulu_deforestasi.geojson`
     (6-decimal precision, `lk_code` LK-001..LK-163, `rep_lon`, `rep_lat`, `bbox`)
   - `rimbun-webgis-prototype/rimbun/src/data/loakuluPolygonAttributes.ts`
     (synchronous attribute index without geometry for instant loading on non-map pages)
2. Fetches Sentinel-2 L2A 2025 Cloud Score+ (cs_cdf >= 0.60) composite tiles
   for the Loa Kulu padded bounding box (z=10..14) via Google Earth Engine,
   converts PNG tiles to lightweight WebP, and saves to:
   - `rimbun-webgis-prototype/rimbun/public/tiles/s2_2025/{z}/{x}/{y}.webp`
   - `rimbun-webgis-prototype/rimbun/public/tiles/s2_2025/metadata.json`
3. Copies the 6 editorial photographs from `frontend/public/images/` into
   `rimbun-webgis-prototype/rimbun/public/images/`.
"""

from __future__ import annotations

import json
import math
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from typing import Any

import ee
import geopandas as gpd
import requests
from PIL import Image
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
GPKG_PATH = WORKSPACE_ROOT / "data" / "processed" / "deforestasi_loakulu_enriched_5ha.gpkg"
RIMBUN_DIR = WORKSPACE_ROOT / "rimbun-webgis-prototype" / "rimbun"
GEOJSON_OUT = RIMBUN_DIR / "public" / "data" / "loakulu_deforestasi.geojson"
ATTR_TS_OUT = RIMBUN_DIR / "src" / "data" / "loakuluPolygonAttributes.ts"
TILES_DIR = RIMBUN_DIR / "public" / "tiles" / "s2_2025"
IMAGES_SRC = WORKSPACE_ROOT / "frontend" / "public" / "images"
IMAGES_DST = RIMBUN_DIR / "public" / "images"

GEE_PROJECT = "project2-503507"
BBOX = [116.55, -0.84, 117.08, -0.39]  # [min_lon, min_lat, max_lon, max_lat]
ZOOM_MIN = 10
ZOOM_MAX = 14
CS_THRESHOLD = 0.60


def round_coords(obj: Any, decimals: int = 6) -> Any:
    if isinstance(obj, float):
        return round(obj, decimals)
    if isinstance(obj, list):
        return [round_coords(x, decimals) for x in obj]
    if isinstance(obj, tuple):
        return [round_coords(x, decimals) for x in obj]
    if isinstance(obj, dict):
        return {k: round_coords(v, decimals) for k, v in obj.items()}
    return obj


def export_loakulu_geojson_and_index() -> list[dict[str, Any]]:
    if not GPKG_PATH.exists():
        raise FileNotFoundError(f"GPKG tidak ditemukan: {GPKG_PATH}")

    gdf = gpd.read_file(GPKG_PATH)
    if gdf.crs is None or gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    gdf = gdf.sort_values("id").reset_index(drop=True)
    gdf["lk_code"] = [f"LK-{i + 1:03d}" for i in range(len(gdf))]

    rep_pts = gdf.geometry.representative_point()
    bounds_df = gdf.geometry.bounds

    gdf["rep_lon"] = rep_pts.x.round(5)
    gdf["rep_lat"] = rep_pts.y.round(5)

    # Verify expected deterministic mappings
    expected = {
        "LK-002": "+432618-2481",
        "LK-017": "+432953-2599",
        "LK-023": "+433022-2519",
        "LK-053": "+433274-2710",
        "LK-095": "+433448-1842",
        "LK-124": "+433532-2464",
        "LK-151": "+433757-2224",
    }
    lookup = dict(zip(gdf["lk_code"], gdf["id"]))
    for code, gee_id in expected.items():
        actual = lookup.get(code)
        if actual != gee_id:
            raise AssertionError(f"Mapping mismatch for {code}: expected {gee_id}, got {actual}")

    raw_fc = json.loads(gdf.to_json())
    attr_rows: list[dict[str, Any]] = []

    for idx, feat in enumerate(raw_fc["features"]):
        b = bounds_df.iloc[idx]
        bbox = [
            round(float(b["minx"]), 5),
            round(float(b["miny"]), 5),
            round(float(b["maxx"]), 5),
            round(float(b["maxy"]), 5),
        ]
        props = feat["properties"]
        props["bbox"] = bbox
        props["topo_heterogen"] = bool(props["topo_heterogen"])
        props["kelas_id"] = int(props["kelas_id"])
        props["count"] = int(props["count"])
        props["tanah_n_kelas"] = int(props["tanah_n_kelas"])
        feat["geometry"] = round_coords(feat["geometry"], decimals=6)
        attr_rows.append(props)

    GEOJSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    GEOJSON_OUT.write_text(
        json.dumps(raw_fc, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    ATTR_TS_OUT.parent.mkdir(parents=True, exist_ok=True)
    ts_content = (
        "import type { LoaKuluPolygonProps } from '../types';\n\n"
        "/**\n"
        " * Synchronous attribute index of all 163 Loa Kulu deforestation polygons\n"
        " * extracted from data/processed/deforestasi_loakulu_enriched_5ha.gpkg.\n"
        " * Geometry stays in /data/loakulu_deforestasi.geojson for lazy map loading.\n"
        " */\n"
        f"export const LOAKULU_POLYGON_ATTRIBUTES: LoaKuluPolygonProps[] = {json.dumps(attr_rows, ensure_ascii=False, indent=2)};\n\n"
        "export const LOAKULU_ATTR_BY_CODE: Record<string, LoaKuluPolygonProps> = Object.fromEntries(\n"
        "  LOAKULU_POLYGON_ATTRIBUTES.map((p) => [p.lk_code, p]),\n"
        ");\n"
    )
    ATTR_TS_OUT.write_text(ts_content, encoding="utf-8")

    print(
        f"[GeoJSON] Saved {len(attr_rows)} polygons -> {GEOJSON_OUT} "
        f"({GEOJSON_OUT.stat().st_size / 1024:.1f} KB)"
    )
    print(f"[IndexTS] Saved synchronous attribute table -> {ATTR_TS_OUT}")
    return attr_rows


def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat_deg)
    n = 2.0**zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def tiles_for_bbox(bbox: list[float], zmin: int, zmax: int) -> list[tuple[int, int, int]]:
    min_lon, min_lat, max_lon, max_lat = bbox
    coords: list[tuple[int, int, int]] = []
    for z in range(zmin, zmax + 1):
        x0, y1 = deg2num(min_lat, min_lon, z)
        x1, y0 = deg2num(max_lat, max_lon, z)
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                coords.append((z, x, y))
    return coords


def build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=0.6,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def fetch_sentinel2_tiles() -> None:
    ee.Initialize(project=GEE_PROJECT)
    aoi = ee.Geometry.Rectangle(BBOX)

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate("2025-01-01", "2025-12-31")
    )
    cs_plus = (
        ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
        .filterBounds(aoi)
        .filterDate("2025-01-01", "2025-12-31")
    )

    def mask_and_scale(img: ee.Image) -> ee.Image:
        clear = img.select("cs_cdf").gte(CS_THRESHOLD)
        return img.select(["B4", "B3", "B2"]).multiply(0.0001).updateMask(clear)

    comp = s2.linkCollection(cs_plus, ["cs_cdf"]).map(mask_and_scale).median().clip(aoi)
    vis_img = comp.visualize(bands=["B4", "B3", "B2"], min=0.02, max=0.25, gamma=1.2)
    map_id = vis_img.getMapId()
    url_template = map_id["tile_fetcher"].url_format

    tile_list = tiles_for_bbox(BBOX, ZOOM_MIN, ZOOM_MAX)
    print(f"[GEE S2 2025] Preparing {len(tile_list)} tiles across z={ZOOM_MIN}..{ZOOM_MAX} ...")
    TILES_DIR.mkdir(parents=True, exist_ok=True)

    session = build_session()

    def download_one(zxy: tuple[int, int, int]) -> tuple[int, int, int, int]:
        z, x, y = zxy
        out_path = TILES_DIR / str(z) / str(x) / f"{y}.webp"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if out_path.exists() and out_path.stat().st_size > 100:
            return z, x, y, out_path.stat().st_size

        url = url_template.format(z=z, x=x, y=y)
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        with Image.open(BytesIO(resp.content)) as im:
            im.convert("RGBA").save(out_path, format="WEBP", quality=82, method=4)
        return z, x, y, out_path.stat().st_size

    t0 = time.perf_counter()
    total_bytes = 0
    done = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(download_one, zxy) for zxy in tile_list]
        for fut in as_completed(futures):
            _, _, _, sz = fut.result()
            total_bytes += sz
            done += 1
            if done % 150 == 0 or done == len(tile_list):
                print(f"  [Tiles] {done}/{len(tile_list)} tiles ready ({total_bytes / (1024 * 1024):.2f} MB)")

    meta = {
        "source": "COPERNICUS/S2_SR_HARMONIZED + GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
        "date_range": "2025-01-01 to 2025-12-31",
        "cs_cdf_threshold": CS_THRESHOLD,
        "bands": ["B4", "B3", "B2"],
        "vis": {"min": 0.02, "max": 0.25, "gamma": 1.2},
        "zoom_min": ZOOM_MIN,
        "zoom_max": ZOOM_MAX,
        "bbox": BBOX,
        "tile_count": len(tile_list),
        "total_size_mb": round(total_bytes / (1024 * 1024), 2),
        "format": "webp",
    }
    (TILES_DIR / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[GEE S2 2025] Completed in {time.perf_counter() - t0:.1f}s -> {meta['total_size_mb']} MB")


def copy_editorial_images() -> None:
    IMAGES_DST.mkdir(parents=True, exist_ok=True)
    copied = []
    for name in [
        "hero-canopy.jpg",
        "site-watershed.jpg",
        "site-peatland.jpg",
        "site-corridor.jpg",
        "site-agroforestry.jpg",
        "planting-docs.jpg",
    ]:
        src = IMAGES_SRC / name
        dst = IMAGES_DST / name
        if not src.exists():
            raise FileNotFoundError(f"Image asset missing: {src}")
        shutil.copy2(src, dst)
        copied.append(name)
    print(f"[Images] Copied {len(copied)} files -> {IMAGES_DST}")


if __name__ == "__main__":
    export_loakulu_geojson_and_index()
    copy_editorial_images()
    fetch_sentinel2_tiles()
