"""
Pipeline Enrichment Parameter Fisik Lingkungan — Deforestasi Kutai Kartanegara
===============================================================================
Memperkaya tabel atribut poligon deforestasi Kutai Kartanegara (2020-2025) dengan:
  1. Elevasi FABDEM 30 m      : elev_med, elev_rng
  2. Slope FABDEM 30 m        : slope_med, slope_std, slope_p90, topo_heterogen
  3. Curah Hujan ERA5-Land    : rain_mean (dengan fallback representative_point)
  4. Jenis Tanah (vektor)     : tanah_dom, tanah_dom_pct, tanah_n_kelas
                                (overlay Equal-Area EPSG:6933 + fallback sjoin_nearest)

Fokus hanya pada ekstraksi & validasi parameter fisik lingkungan (belum termasuk
rekomendasi tanaman).
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.mask import mask as rio_mask
import shapely

# ---------------------------------------------------------------------------
# KONFIGURASI LOGGING & PATH
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("enrich_deforestation")

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
USER_DOWNLOADS = Path.home() / "Downloads"
OUTPUT_DIR = WORKSPACE_ROOT / "data" / "processed"

EQUAL_AREA_CRS = "EPSG:6933"
OUTPUT_CRS = "EPSG:4326"
SOIL_CLASS_FIELD = "ket_jenis"
SLOPE_HETEROGEN_THRESHOLD_DEG = 8.0


@dataclass(frozen=True)
class InputPaths:
    deforestation: Path
    fabdem_elev: Path
    fabdem_slope: Path
    era5_rain: Path
    soil: Path


def resolve_first_existing(candidates: Iterable[Path], label: str) -> Path:
    """Memilih path pertama yang tersedia dari daftar kandidat."""
    candidate_list = list(candidates)
    for path in candidate_list:
        if path.exists():
            return path
    searched = "\n  - ".join(str(p) for p in candidate_list)
    raise FileNotFoundError(f"File untuk '{label}' tidak ditemukan. Dicari di:\n  - {searched}")


def discover_input_paths(workspace_root: Path = WORKSPACE_ROOT) -> InputPaths:
    """Menentukan path eksak 5 layer terverifikasi (sesuai layer aktif QGIS)."""
    return InputPaths(
        deforestation=resolve_first_existing(
            [
                # Versi QGIS aktif memiliki kolom Luas_m2 (geometri identik 0.000 m dgn data/)
                USER_DOWNLOADS / "deforestasi_kukar_2020_2025_min5ha.geojson",
                workspace_root / "data" / "deforestasi_kukar_2020_2025_min5ha.geojson",
            ],
            label="deforestasi_kukar_2020_2025_min5ha",
        ),
        fabdem_elev=resolve_first_existing(
            [
                workspace_root / "data" / "fabdem_elev_kukar_30m.tif",
                USER_DOWNLOADS / "fabdem_elev_kukar_30m.tif",
            ],
            label="fabdem_elev_kukar_30m",
        ),
        fabdem_slope=resolve_first_existing(
            [
                workspace_root / "data" / "fabdem_slope_kukar_30m.tif",
                USER_DOWNLOADS / "fabdem_slope_kukar_30m.tif",
            ],
            label="fabdem_slope_kukar_30m",
        ),
        era5_rain=resolve_first_existing(
            [
                workspace_root
                / "era5_kukar_rain"
                / "ERA5Land_RainMean_mmYr_Kukar_buffered_0p1deg.tif",
                workspace_root / "data" / "ERA5Land_RainMean_mmYr_Kukar_buffered_0p1deg.tif",
            ],
            label="ERA5Land_RainMean_mmYr_Kukar_buffered_0p1deg",
        ),
        soil=resolve_first_existing(
            [
                workspace_root / "data" / "jenis_tanah_kukar_ikn.geojson",
                workspace_root / "data" / "jenis_tanah_kukar_ikn.shp",
            ],
            label="jenis_tanah_kukar_ikn",
        ),
    )


# ---------------------------------------------------------------------------
# HELPER RASTER WINDOWED ZONAL STATISTICS (HEMAT RAM)
# ---------------------------------------------------------------------------
def _extract_valid_pixels(
    src: rasterio.DatasetReader,
    geom: shapely.Geometry,
    all_touched: bool = False,
) -> np.ndarray:
    """
    Membaca hanya window kecil yang melingkupi satu poligon (tidak memuat seluruh
    raster ke RAM), mengisi area luar poligon dengan NaN agar aman saat
    src.nodata bernilai None (seperti pada FABDEM float32), lalu menyaring
    hanya piksel berhingga (finite) yang bukan nodata.
    """
    try:
        arr, _ = rio_mask(
            src,
            [geom],
            crop=True,
            filled=True,
            nodata=np.nan,
            all_touched=all_touched,
        )
    except ValueError:
        # Poligon tidak berpotongan dengan bounding box raster
        return np.empty(0, dtype=np.float64)

    band = arr[0].astype(np.float64, copy=False)
    valid_mask = np.isfinite(band)
    if src.nodata is not None and not np.isnan(src.nodata):
        valid_mask &= band != float(src.nodata)
    return band[valid_mask]


def _sample_representative_point(
    src: rasterio.DatasetReader,
    geom: shapely.Geometry,
) -> float:
    """
    Mengambil nilai piksel pada representative_point() (point-on-surface yang
    dijamin berada di dalam poligon, bukan centroid yang dapat jatuh di luar
    poligon cekung/berbentuk L).
    """
    pt = geom.representative_point()
    val = float(next(src.sample([(pt.x, pt.y)]))[0])
    if not np.isfinite(val):
        return np.nan
    if src.nodata is not None and not np.isnan(src.nodata) and val == float(src.nodata):
        return np.nan
    return val


def _sample_nearest_valid_pixel(
    src: rasterio.DatasetReader,
    geom: shapely.Geometry,
) -> float:
    """Fallback darurat hanya jika representative_point jatuh pada piksel NaN (mis. tepi laut)."""
    pt = geom.representative_point()
    band = src.read(1).astype(np.float64)
    valid_mask = np.isfinite(band)
    if src.nodata is not None and not np.isnan(src.nodata):
        valid_mask &= band != float(src.nodata)
    rows, cols = np.where(valid_mask)
    if rows.size == 0:
        return np.nan
    xs, ys = rasterio.transform.xy(src.transform, rows, cols, offset="center")
    dist2 = (np.asarray(xs) - pt.x) ** 2 + (np.asarray(ys) - pt.y) ** 2
    nearest_idx = int(np.argmin(dist2))
    return float(band[rows[nearest_idx], cols[nearest_idx]])


def extract_fabdem_elevation(
    gdf: gpd.GeoDataFrame,
    elev_path: Path,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Mengekstrak elev_med dan elev_rng (m, 1 desimal) dari FABDEM 30 m."""
    stats_log = {"zonal_center": 0, "fallback_all_touched": 0, "fallback_rep_point": 0}
    elev_med = np.full(len(gdf), np.nan, dtype=np.float64)
    elev_rng = np.full(len(gdf), np.nan, dtype=np.float64)

    with rasterio.open(elev_path) as src:
        geoms = gdf.geometry if gdf.crs == src.crs else gdf.to_crs(src.crs).geometry
        for i, geom in enumerate(geoms):
            vals = _extract_valid_pixels(src, geom, all_touched=False)
            if vals.size > 0:
                stats_log["zonal_center"] += 1
            else:
                vals = _extract_valid_pixels(src, geom, all_touched=True)
                if vals.size > 0:
                    stats_log["fallback_all_touched"] += 1
                else:
                    pt_val = _sample_representative_point(src, geom)
                    if np.isfinite(pt_val):
                        vals = np.array([pt_val], dtype=np.float64)
                        stats_log["fallback_rep_point"] += 1

            if vals.size > 0:
                elev_med[i] = round(float(np.median(vals)), 1)
                elev_rng[i] = round(float(np.max(vals) - np.min(vals)), 1)

    return pd.DataFrame({"elev_med": elev_med, "elev_rng": elev_rng}), stats_log


def extract_fabdem_slope(
    gdf: gpd.GeoDataFrame,
    slope_path: Path,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """
    Mengekstrak slope_med, slope_std (ddof=0 agar poligon 1 piksel = 0.0, bukan NaN),
    slope_p90 (derajat, 1 desimal), dan flag boolean topo_heterogen (slope_std >= 8.0).
    """
    stats_log = {
        "zonal_center": 0,
        "fallback_all_touched": 0,
        "fallback_rep_point": 0,
        "single_pixel_polygons": 0,
    }
    n = len(gdf)
    slope_med = np.full(n, np.nan, dtype=np.float64)
    slope_std = np.full(n, np.nan, dtype=np.float64)
    slope_p90 = np.full(n, np.nan, dtype=np.float64)

    with rasterio.open(slope_path) as src:
        geoms = gdf.geometry if gdf.crs == src.crs else gdf.to_crs(src.crs).geometry
        for i, geom in enumerate(geoms):
            vals = _extract_valid_pixels(src, geom, all_touched=False)
            if vals.size > 0:
                stats_log["zonal_center"] += 1
            else:
                vals = _extract_valid_pixels(src, geom, all_touched=True)
                if vals.size > 0:
                    stats_log["fallback_all_touched"] += 1
                else:
                    pt_val = _sample_representative_point(src, geom)
                    if np.isfinite(pt_val):
                        vals = np.array([pt_val], dtype=np.float64)
                        stats_log["fallback_rep_point"] += 1

            if vals.size > 0:
                if vals.size == 1:
                    stats_log["single_pixel_polygons"] += 1
                slope_med[i] = round(float(np.median(vals)), 1)
                # ddof=0 (population std across pixels inside polygon; konsisten dgn QGIS & rasterstats)
                slope_std[i] = round(float(np.std(vals, ddof=0)), 1)
                slope_p90[i] = round(float(np.percentile(vals, 90)), 1)

    topo_heterogen = (slope_std >= SLOPE_HETEROGEN_THRESHOLD_DEG).astype(bool)
    df = pd.DataFrame(
        {
            "slope_med": slope_med,
            "slope_std": slope_std,
            "slope_p90": slope_p90,
            "topo_heterogen": topo_heterogen,
        }
    )
    return df, stats_log


def extract_era5_rainfall(
    gdf: gpd.GeoDataFrame,
    rain_path: Path,
) -> tuple[pd.Series, dict[str, int]]:
    """
    Mengekstrak rain_mean (mm/thn, 1 desimal) dari raster ERA5-Land unsmoothed (0.1 deg).
    Jika poligon terlalu kecil untuk memuat pusat piksel ERA5, otomatis melakukan
    fallback sampling menggunakan representative_point() (point-on-surface).
    """
    stats_log = {
        "zonal_center": 0,
        "fallback_rep_point": 0,
        "fallback_nearest_valid": 0,
    }
    rain_mean = np.full(len(gdf), np.nan, dtype=np.float64)

    with rasterio.open(rain_path) as src:
        geoms = gdf.geometry if gdf.crs == src.crs else gdf.to_crs(src.crs).geometry
        for i, geom in enumerate(geoms):
            vals = _extract_valid_pixels(src, geom, all_touched=False)
            if vals.size > 0:
                rain_mean[i] = round(float(np.mean(vals)), 1)
                stats_log["zonal_center"] += 1
                continue

            pt_val = _sample_representative_point(src, geom)
            if np.isfinite(pt_val):
                rain_mean[i] = round(pt_val, 1)
                stats_log["fallback_rep_point"] += 1
                continue

            nearest_val = _sample_nearest_valid_pixel(src, geom)
            if np.isfinite(nearest_val):
                rain_mean[i] = round(nearest_val, 1)
                stats_log["fallback_nearest_valid"] += 1

    return pd.Series(rain_mean, name="rain_mean"), stats_log


# ---------------------------------------------------------------------------
# HELPER OVERLAY VEKTOR JENIS TANAH (LARGEST OVERLAP DI EPSG:6933)
# ---------------------------------------------------------------------------
def extract_soil_largest_overlap(
    gdf: gpd.GeoDataFrame,
    soil_path: Path,
    soil_field: str = SOIL_CLASS_FIELD,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Menghitung jenis tanah dominan berdasarkan luas irisan eksak terbesar pada
    proyeksi Equal-Area (EPSG:6933) setelah perbaikan topologi make_valid().
    Mengagregasikan luas per (_poly_idx, soil_field) agar kelas yang muncul di
    lebih dari satu fitur (mis. 'Sungai') dihitung sebagai satu kelas utuh.
    Poligon tepi tanpa irisan langsung di-fallback ke sjoin_nearest (EPSG:6933).
    """
    soil = gpd.read_file(soil_path)
    if soil_field not in soil.columns:
        raise KeyError(
            f"Kolom jenis tanah '{soil_field}' tidak ditemukan. Kolom tersedia: {list(soil.columns)}"
        )

    def_eq = gdf[["geometry"]].copy().to_crs(EQUAL_AREA_CRS)
    def_eq["geometry"] = shapely.force_2d(def_eq.geometry.make_valid())
    def_eq["_poly_idx"] = np.arange(len(def_eq), dtype=np.int64)
    def_eq["_poly_area_m2"] = def_eq.geometry.area

    soil_eq = soil[[soil_field, "geometry"]].copy().to_crs(EQUAL_AREA_CRS)
    soil_eq["geometry"] = shapely.force_2d(soil_eq.geometry.make_valid())
    soil_eq[soil_field] = soil_eq[soil_field].astype(str).str.strip()

    # Overlay intersection
    inter = gpd.overlay(
        def_eq[["_poly_idx", "_poly_area_m2", "geometry"]],
        soil_eq[[soil_field, "geometry"]],
        how="intersection",
        keep_geom_type=False,
    )
    inter["_inter_area_m2"] = inter.geometry.area
    inter = inter[inter["_inter_area_m2"] > 0].copy()

    # Agregasi per (_poly_idx, ket_jenis) supaya kelas multi-fitur tidak terpecah
    grouped = (
        inter.groupby(["_poly_idx", soil_field], as_index=False)["_inter_area_m2"]
        .sum()
        .sort_values(["_poly_idx", "_inter_area_m2"], ascending=[True, False])
    )

    n_kelas_series = grouped.groupby("_poly_idx")[soil_field].nunique()
    dom_rows = grouped.drop_duplicates(subset="_poly_idx", keep="first").set_index("_poly_idx")

    # Siapkan tabel hasil 1:1 sesuai urutan asli deforestasi
    result = pd.DataFrame(
        {
            "tanah_dom": pd.Series(index=def_eq["_poly_idx"], dtype="object"),
            "tanah_dom_pct": pd.Series(index=def_eq["_poly_idx"], dtype="float64"),
            "tanah_n_kelas": pd.Series(0, index=def_eq["_poly_idx"], dtype="int64"),
        }
    )

    area_lookup = def_eq.set_index("_poly_idx")["_poly_area_m2"]
    covered_idx = dom_rows.index
    result.loc[covered_idx, "tanah_dom"] = dom_rows[soil_field]
    pct_raw = (dom_rows["_inter_area_m2"] / area_lookup.loc[covered_idx]) * 100.0
    result.loc[covered_idx, "tanah_dom_pct"] = pct_raw.clip(0.0, 100.0).round(1)
    result.loc[n_kelas_series.index, "tanah_n_kelas"] = n_kelas_series.astype(np.int64)

    # Fallback sjoin_nearest untuk poligon tepi yang tidak beririsan sama sekali
    missing_idx = result.index[result["tanah_dom"].isna()].tolist()
    fallback_records = pd.DataFrame(
        columns=["_poly_idx", "id", "tanah_dom_nearest", "distance_m"]
    )

    if missing_idx:
        missing_gdf = def_eq.loc[missing_idx, ["_poly_idx", "geometry"]].copy()
        nearest = gpd.sjoin_nearest(
            missing_gdf,
            soil_eq[[soil_field, "geometry"]],
            how="left",
            distance_col="_dist_m",
        )
        nearest = nearest.sort_values(["_poly_idx", "_dist_m"]).drop_duplicates(
            subset="_poly_idx", keep="first"
        )

        id_col = "id" if "id" in gdf.columns else None
        records = []
        for _, row in nearest.iterrows():
            pidx = int(row["_poly_idx"])
            dom_name = str(row[soil_field])
            dist_m = round(float(row["_dist_m"]), 1)
            result.loc[pidx, "tanah_dom"] = dom_name
            result.loc[pidx, "tanah_dom_pct"] = 0.0
            result.loc[pidx, "tanah_n_kelas"] = 0
            records.append(
                {
                    "_poly_idx": pidx,
                    "id": gdf.iloc[pidx][id_col] if id_col else pidx,
                    "tanah_dom_nearest": dom_name,
                    "distance_m": dist_m,
                }
            )
        fallback_records = pd.DataFrame(records)

    return result.reset_index(drop=True), fallback_records


# ---------------------------------------------------------------------------
# LAPORAN VERIFIKASI MARKDOWN
# ---------------------------------------------------------------------------
def build_verification_markdown(
    paths: InputPaths,
    n_initial: int,
    enriched: gpd.GeoDataFrame,
    elev_log: dict[str, int],
    slope_log: dict[str, int],
    rain_log: dict[str, int],
    soil_fallback_df: pd.DataFrame,
    elapsed_sec: float,
) -> str:
    new_cols = [
        "elev_med",
        "elev_rng",
        "slope_med",
        "slope_std",
        "slope_p90",
        "topo_heterogen",
        "rain_mean",
        "tanah_dom",
        "tanah_dom_pct",
        "tanah_n_kelas",
    ]
    if "luas_ha" in enriched.columns:
        check_cols = ["luas_ha"] + new_cols
    else:
        check_cols = new_cols

    null_counts = enriched[check_cols].isna().sum()

    # Tabel frekuensi tanah_dom
    soil_summary = (
        enriched.groupby("tanah_dom", dropna=False)
        .agg(jumlah_poligon=("tanah_dom", "size"), total_luas_ha=("luas_ha", "sum"))
        .sort_values("total_luas_ha", ascending=False)
        .reset_index()
    )
    total_ha = float(enriched["luas_ha"].sum())
    soil_summary["proporsi_luas_pct"] = (soil_summary["total_luas_ha"] / total_ha * 100.0).round(2)

    # Statistik deskriptif
    desc_cols = ["elev_med", "slope_med", "slope_std", "rain_mean", "luas_ha"]
    desc = enriched[desc_cols].describe(percentiles=[0.25, 0.5, 0.75]).loc[
        ["min", "25%", "50%", "75%", "max"]
    ]

    lines = [
        "# Ringkasan Verifikasi Parameter Fisik — Deforestasi Kutai Kartanegara",
        "",
        "## 1. Sumber Data & Validasi Integritas",
        f"- **Poligon Deforestasi:** `{paths.deforestation}`",
        f"- **Elevasi FABDEM (30 m):** `{paths.fabdem_elev}`",
        f"- **Slope FABDEM (30 m):** `{paths.fabdem_slope}`",
        f"- **Curah Hujan ERA5-Land (unsmoothed 0.1°):** `{paths.era5_rain}`",
        f"- **Jenis Tanah (kolom `{SOIL_CLASS_FIELD}`):** `{paths.soil}`",
        f"- **CRS Output:** `{enriched.crs}` (overlay luas & jenis tanah diproses pada `{EQUAL_AREA_CRS}`)",
        f"- **Jumlah Poligon Awal vs Akhir:** `{n_initial:,}` → `{len(enriched):,}` (rasio 1:1 terverifikasi)",
        f"- **Total Luas Poligon Deforestasi:** `{total_ha:,.2f} ha`",
        f"- **Poligon Topografi Heterogen (`slope_std >= 8.0°`):** `{int(enriched['topo_heterogen'].sum()):,}` ({enriched['topo_heterogen'].mean() * 100:.1f}%)",
        f"- **Waktu Eksekusi Pipeline:** `{elapsed_sec:.2f} detik`",
        "",
        "### Log Ekstraksi & Fallback",
        f"- **FABDEM Elevasi:** zonal center = `{elev_log['zonal_center']:,}`, all_touched = `{elev_log['fallback_all_touched']}`, representative_point = `{elev_log['fallback_rep_point']}`",
        f"- **FABDEM Slope:** zonal center = `{slope_log['zonal_center']:,}`, poligon 1 piksel (`slope_std=0.0`, `ddof=0`) = `{slope_log['single_pixel_polygons']}`, fallback = `{slope_log['fallback_all_touched'] + slope_log['fallback_rep_point']}`",
        f"- **ERA5-Land Hujan:** zonal center = `{rain_log['zonal_center']:,}`, fallback `representative_point()` = `{rain_log['fallback_rep_point']:,}`, fallback nearest valid = `{rain_log['fallback_nearest_valid']}`",
        f"- **Jenis Tanah (`EPSG:6933`):** overlay irisan langsung = `{len(enriched) - len(soil_fallback_df):,}`, fallback `sjoin_nearest` = `{len(soil_fallback_df)}`",
        "",
    ]

    if not soil_fallback_df.empty:
        lines.append("#### Detail Poligon Fallback `sjoin_nearest` (Tepi Batas Layer Tanah)")
        lines.append("")
        lines.append("| Index | ID Poligon | `tanah_dom` (Nearest) | Jarak (m) | `tanah_dom_pct` | `tanah_n_kelas` |")
        lines.append("|---:|---|---:|---:|---:|---:|")
        for _, r in soil_fallback_df.iterrows():
            lines.append(
                f"| {int(r['_poly_idx'])} | `{r['id']}` | {r['tanah_dom_nearest']} | {r['distance_m']:.1f} | 0.0 | 0 |"
            )
        lines.append("")

    lines.extend(
        [
            "## 2. Pemeriksaan Nilai `NULL / NaN` pada Kolom Baru",
            "",
            "| Kolom | Jumlah `NULL / NaN` | Status |",
            "|---|---:|---|",
        ]
    )
    for col, cnt in null_counts.items():
        status = "OK (0 NULL)" if int(cnt) == 0 else f"PERHATIAN ({int(cnt)})"
        lines.append(f"| `{col}` | {int(cnt)} | {status} |")

    lines.extend(
        [
            "",
            "## 3. Frekuensi Nilai Unik `tanah_dom`",
            "",
            "| Jenis Tanah (`tanah_dom`) | Jumlah Poligon | Total Luas (ha) | Proporsi Luas (%) |",
            "|---|---:|---:|---:|",
        ]
    )
    for _, r in soil_summary.iterrows():
        lines.append(
            f"| {r['tanah_dom']} | {int(r['jumlah_poligon']):,} | {r['total_luas_ha']:,.2f} | {r['proporsi_luas_pct']:.2f}% |"
        )

    lines.extend(
        [
            "",
            "## 4. Statistik Deskriptif Parameter Utama",
            "",
            "| Statistik | `elev_med` (m) | `slope_med` (°) | `slope_std` (°) | `rain_mean` (mm/thn) | `luas_ha` (ha) |",
            "|---|---:|---:|---:|---:|---:|",
        ]
    )
    for stat_name in ["min", "25%", "50%", "75%", "max"]:
        row = desc.loc[stat_name]
        lines.append(
            f"| **{stat_name}** | {row['elev_med']:,.1f} | {row['slope_med']:,.1f} | "
            f"{row['slope_std']:,.1f} | {row['rain_mean']:,.1f} | {row['luas_ha']:,.2f} |"
        )

    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# EKSEKUSI UTAMA PIPELINE
# ---------------------------------------------------------------------------
def run_enrichment_pipeline(
    workspace_root: Path = WORKSPACE_ROOT,
    output_dir: Path = OUTPUT_DIR,
) -> tuple[gpd.GeoDataFrame, str]:
    t0 = time.perf_counter()
    paths = discover_input_paths(workspace_root)

    logger.info("Memuat layer deforestasi: %s", paths.deforestation)
    deforest = gpd.read_file(paths.deforestation)
    if deforest.crs is None:
        deforest = deforest.set_crs(OUTPUT_CRS)

    n_initial = len(deforest)
    logger.info(
        "Deforestasi dimuat: %d poligon | CRS=%s | Kolom=%s",
        n_initial,
        deforest.crs,
        list(deforest.columns),
    )

    # Pertahankan seluruh kolom asli; hitung luas_m2 (jika belum ada) & luas_ha pada EPSG:6933
    enriched = deforest.copy().reset_index(drop=True)
    area_m2_eq = enriched.to_crs(EQUAL_AREA_CRS).geometry.make_valid().area
    has_luas_m2 = any(col.lower() == "luas_m2" for col in enriched.columns)
    if not has_luas_m2:
        enriched["luas_m2"] = area_m2_eq.round(2)
    if "luas_ha" not in enriched.columns:
        enriched["luas_ha"] = (area_m2_eq / 10_000.0).round(2)

    # 1. Elevasi FABDEM 30 m
    logger.info("Mengekstrak elevasi FABDEM (windowed reading): %s", paths.fabdem_elev)
    elev_df, elev_log = extract_fabdem_elevation(enriched, paths.fabdem_elev)
    logger.info("Selesai elevasi FABDEM: %s", elev_log)

    # 2. Slope FABDEM 30 m
    logger.info("Mengekstrak kelerengan FABDEM (windowed reading): %s", paths.fabdem_slope)
    slope_df, slope_log = extract_fabdem_slope(enriched, paths.fabdem_slope)
    logger.info("Selesai slope FABDEM: %s", slope_log)

    # 3. Curah Hujan ERA5-Land unsmoothed 0.1 deg
    logger.info("Mengekstrak curah hujan ERA5-Land (0.1 deg + fallback): %s", paths.era5_rain)
    rain_series, rain_log = extract_era5_rainfall(enriched, paths.era5_rain)
    logger.info("Selesai curah hujan ERA5-Land: %s", rain_log)

    # 4. Jenis Tanah (Largest Overlap di EPSG:6933 + sjoin_nearest fallback)
    logger.info("Menghitung jenis tanah dominan (EPSG:6933 largest overlap): %s", paths.soil)
    soil_df, soil_fallback_df = extract_soil_largest_overlap(
        enriched, paths.soil, soil_field=SOIL_CLASS_FIELD
    )
    if not soil_fallback_df.empty:
        logger.warning(
            "%d poligon tidak beririsan langsung dengan layer tanah -> fallback sjoin_nearest:\n%s",
            len(soil_fallback_df),
            soil_fallback_df.to_string(index=False),
        )
    else:
        logger.info("Seluruh poligon beririsan langsung dengan layer tanah.")

    # Gabungkan kolom baru dengan urutan 1:1
    for col in elev_df.columns:
        enriched[col] = elev_df[col].values
    for col in slope_df.columns:
        enriched[col] = slope_df[col].values
    enriched["rain_mean"] = rain_series.values
    for col in soil_df.columns:
        enriched[col] = soil_df[col].values

    # Pastikan CRS output EPSG:4326 & validasi ketat 1:1 + 0 NaN
    enriched = enriched.to_crs(OUTPUT_CRS)

    assert len(enriched) == n_initial, (
        f"Jumlah baris berubah! Awal={n_initial}, Akhir={len(enriched)}"
    )
    if "id" in deforest.columns:
        assert (enriched["id"].values == deforest["id"].values).all(), (
            "Urutan ID poligon berubah!"
        )

    required_new_cols = [
        "luas_ha",
        "elev_med",
        "elev_rng",
        "slope_med",
        "slope_std",
        "slope_p90",
        "topo_heterogen",
        "rain_mean",
        "tanah_dom",
        "tanah_dom_pct",
        "tanah_n_kelas",
    ]
    null_summary = enriched[required_new_cols].isna().sum()
    if int(null_summary.sum()) > 0:
        raise ValueError(f"Masih ditemukan nilai NULL/NaN:\n{null_summary}")

    # Susun geometri di kolom terakhir agar rapi di QGIS / GeoJSON
    non_geom_cols = [c for c in enriched.columns if c != "geometry"]
    enriched = enriched[non_geom_cols + ["geometry"]]

    # Simpan ke GPKG, GeoJSON, dan Markdown report
    output_dir.mkdir(parents=True, exist_ok=True)
    gpkg_out = output_dir / "deforestasi_kukar_enriched.gpkg"
    geojson_out = output_dir / "deforestasi_kukar_enriched.geojson"
    report_out = output_dir / "ringkasan_parameter_sith.md"

    enriched.to_file(gpkg_out, layer="deforestasi_kukar_enriched", driver="GPKG")
    enriched.to_file(geojson_out, driver="GeoJSON")
    logger.info("Tersimpan GPKG    : %s", gpkg_out)
    logger.info("Tersimpan GeoJSON : %s", geojson_out)

    elapsed_sec = time.perf_counter() - t0
    report_md = build_verification_markdown(
        paths=paths,
        n_initial=n_initial,
        enriched=enriched,
        elev_log=elev_log,
        slope_log=slope_log,
        rain_log=rain_log,
        soil_fallback_df=soil_fallback_df,
        elapsed_sec=elapsed_sec,
    )
    report_out.write_text(report_md, encoding="utf-8")
    logger.info("Tersimpan Laporan : %s", report_out)

    return enriched, report_md


if __name__ == "__main__":
    _, report = run_enrichment_pipeline()
    print("\n" + "=" * 78)
    print(report)
    print("=" * 78)
