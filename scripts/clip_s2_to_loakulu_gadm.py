"""
Regenerates local Sentinel-2 L2A 2025 Cloud Score+ WebP tiles (z=10..14)
clipped pixel-perfectly to the standalone GADM Kecamatan Loa Kulu polygon
(`data/processed/batas_loakulu_kecamatan.geojson`), with alpha=0 transparency
outside the administrative boundary so Esri World Gray Canvas shows cleanly around it.
"""

from __future__ import annotations

import json
import math
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

import ee
import geopandas as gpd
import requests
from PIL import Image
from requests.adapters import HTTPAdapter
from shapely.geometry import box
from urllib3.util.retry import Retry

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
GADM_KEC_PATH = WORKSPACE_ROOT / "data" / "processed" / "batas_loakulu_kecamatan.geojson"
TILES_DIR = WORKSPACE_ROOT / "rimbun-webgis-prototype" / "rimbun" / "public" / "tiles" / "s2_2025"

GEE_PROJECT = "project2-503507"
ZOOM_MIN = 10
ZOOM_MAX = 14
CS_THRESHOLD = 0.60


def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat_deg)
    n = 2.0**zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def tile_bounds_lonlat(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2.0**z
    lon_w = x / n * 360.0 - 180.0
    lon_e = (x + 1) / n * 360.0 - 180.0
    lat_n = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_s = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lon_w, lat_s, lon_e, lat_n


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


def main() -> None:
    if not GADM_KEC_PATH.exists():
        raise FileNotFoundError(f"GADM Loa Kulu boundary tidak ditemukan: {GADM_KEC_PATH}")

    gdf = gpd.read_file(GADM_KEC_PATH).to_crs("EPSG:4326")
    # Simplify ~15 m for fast GEE clip geometry while matching web boundary GeoJSON
    gdf_m = gdf.to_crs("EPSG:3857")
    gdf_m["geometry"] = gdf_m.geometry.simplify(15, preserve_topology=True)
    gdf_s = gdf_m.to_crs("EPSG:4326")
    poly = gdf_s.geometry.union_all()
    min_lon, min_lat, max_lon, max_lat = [round(v, 5) for v in poly.bounds]
    geom_dict = json.loads(gpd.GeoSeries([poly]).to_json())["features"][0]["geometry"]

    ee.Initialize(project=GEE_PROJECT)
    ee_geom = ee.Geometry(geom_dict)

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(ee_geom)
        .filterDate("2025-01-01", "2025-12-31")
    )
    cs_plus = (
        ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
        .filterBounds(ee_geom)
        .filterDate("2025-01-01", "2025-12-31")
    )

    def mask_and_scale(img: ee.Image) -> ee.Image:
        clear = img.select("cs_cdf").gte(CS_THRESHOLD)
        return img.select(["B4", "B3", "B2"]).multiply(0.0001).updateMask(clear)

    # Clip strictly to the GADM Kecamatan Loa Kulu polygon -> transparent outside!
    comp = s2.linkCollection(cs_plus, ["cs_cdf"]).map(mask_and_scale).median().clip(ee_geom)
    vis_img = comp.visualize(bands=["B4", "B3", "B2"], min=0.02, max=0.25, gamma=1.2)
    map_id = vis_img.getMapId()
    url_template = map_id["tile_fetcher"].url_format

    # Only fetch tiles that actually intersect the Loa Kulu administrative polygon
    tile_list: list[tuple[int, int, int]] = []
    for z in range(ZOOM_MIN, ZOOM_MAX + 1):
        x0, y1 = deg2num(min_lat, min_lon, z)
        x1, y0 = deg2num(max_lat, max_lon, z)
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                tb = box(*tile_bounds_lonlat(z, x, y))
                if tb.intersects(poly):
                    tile_list.append((z, x, y))

    print(
        f"[GEE S2 Clipped] Kecamatan Loa Kulu bounds={[min_lon, min_lat, max_lon, max_lat]} "
        f"-> {len(tile_list)} intersecting tiles across z={ZOOM_MIN}..{ZOOM_MAX}"
    )

    # Stage into temp dir first, then swap cleanly so interrupted runs never break existing tiles
    tmp_dir = TILES_DIR.parent / "s2_2025_clipped_tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    session = build_session()

    def download_one(zxy: tuple[int, int, int]) -> tuple[int, int, int, int]:
        z, x, y = zxy
        out_path = tmp_dir / str(z) / str(x) / f"{y}.webp"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        url = url_template.format(z=z, x=x, y=y)
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        with Image.open(BytesIO(resp.content)) as im:
            # Preserve exact RGBA alpha channel from GEE clip!
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
            if done % 100 == 0 or done == len(tile_list):
                print(f"  [Tiles] {done}/{len(tile_list)} ({total_bytes / (1024 * 1024):.2f} MB)")

    meta = {
        "source": "COPERNICUS/S2_SR_HARMONIZED + GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
        "clipped_to": "GADM ADM_3 Kecamatan Loa Kulu (batas_loakulu_kecamatan.geojson)",
        "date_range": "2025-01-01 to 2025-12-31",
        "cs_cdf_threshold": CS_THRESHOLD,
        "bands": ["B4", "B3", "B2"],
        "vis": {"min": 0.02, "max": 0.25, "gamma": 1.2},
        "zoom_min": ZOOM_MIN,
        "zoom_max": ZOOM_MAX,
        "bbox": [min_lon, min_lat, max_lon, max_lat],
        "tile_count": len(tile_list),
        "total_size_mb": round(total_bytes / (1024 * 1024), 2),
        "format": "webp-rgba",
    }
    (tmp_dir / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    if TILES_DIR.exists():
        shutil.rmtree(TILES_DIR)
    tmp_dir.rename(TILES_DIR)
    print(f"[DONE] Clipped Sentinel-2 2025 tiles ready in {time.perf_counter() - t0:.1f}s -> {meta['total_size_mb']} MB")


if __name__ == "__main__":
    main()
