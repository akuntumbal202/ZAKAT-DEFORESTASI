import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../../store/AppStore';
import {
  SPECIES_ROLE_LABEL,
  resolveSpeciesMetrics,
  slugifySpeciesId,
  validateSpeciesCore,
} from '../../data/speciesCatalog';
import type {
  SpeciesCatalogItem,
  SpeciesGrowthForm,
  SpeciesRole,
  SpeciesVerificationStatus,
} from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { Input, Select } from '../ui/Field';
import { Callout, EmptyState } from '../ui/Feedback';
import { SpeciesEditorModal } from './SpeciesEditorModal';

type VerifyFilter = 'all' | 'valid' | 'dummy';
type RoleFilter = 'all' | SpeciesRole;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function toNullableNum(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.trim().replace(',', '.');
  if (!cleaned || cleaned.toLowerCase() === 'nan' || cleaned === '-' || cleaned.toLowerCase() === 'null') {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function SpeciesManagerPanel() {
  const {
    speciesCatalog,
    allProjects,
    isBackendConfigured,
    speciesTableReady,
    isSandboxDemo,
    upsertSpecies,
    upsertSpeciesBatch,
    deleteSpecies,
    purgeUnusedDummySpecies,
    toast,
  } = useStore();

  const [q, setQ] = useState('');
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SpeciesCatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const usageBySpecies = useMemo(() => {
    const m = new Map<string, string[]>();
    allProjects.forEach((p) => {
      p.recommended_species.forEach((r) => {
        const list = m.get(r.species_id) ?? [];
        list.push(p.polygon_code || p.id);
        m.set(r.species_id, list);
      });
    });
    return m;
  }, [allProjects]);

  const counts = useMemo(() => {
    const valid = speciesCatalog.filter((s) => s.verification_status === 'valid').length;
    const dummy = speciesCatalog.filter((s) => s.verification_status === 'dummy').length;
    const unusedDummy = speciesCatalog.filter(
      (s) => s.verification_status === 'dummy' && !usageBySpecies.has(s.id),
    ).length;
    return { total: speciesCatalog.length, valid, dummy, unusedDummy, used: usageBySpecies.size };
  }, [speciesCatalog, usageBySpecies]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...speciesCatalog]
      .filter((s) => {
        if (verifyFilter !== 'all' && s.verification_status !== verifyFilter) return false;
        if (roleFilter !== 'all' && s.suitability.role !== roleFilter) return false;
        if (!term) return true;
        return [
          s.id,
          s.local_name,
          s.scientific_name,
          SPECIES_ROLE_LABEL[s.suitability.role],
          s.suitability.soils.join(' '),
          s.suitability.carbon_source ?? '',
          s.traits.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (a.verification_status !== b.verification_status) {
          return a.verification_status === 'valid' ? -1 : 1;
        }
        return a.local_name.localeCompare(b.local_name);
      });
  }, [speciesCatalog, q, verifyFilter, roleFilter]);

  const handleToggleVerify = async (item: SpeciesCatalogItem) => {
    const nextStatus: SpeciesVerificationStatus = item.verification_status === 'valid' ? 'dummy' : 'valid';
    const res = await upsertSpecies({ ...item, verification_status: nextStatus });
    if (res.ok) {
      toast(`${item.local_name} ditandai sebagai ${nextStatus === 'valid' ? 'Valid' : 'Dummy'}.`, 'info');
    }
  };

  const handleDelete = async (item: SpeciesCatalogItem) => {
    const usedIn = usageBySpecies.get(item.id);
    if (usedIn && usedIn.length > 0) {
      toast(
        `${item.local_name} masih dipakai di program ${usedIn.join(', ')}. Ganti dulu spesies di program tersebut sebelum menghapus.`,
        'warn',
      );
      return;
    }
    if (!window.confirm(`Hapus spesies "${item.local_name} (${item.scientific_name})" dari database?`)) return;
    setBusy(true);
    const res = await deleteSpecies(item.id);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? 'Gagal menghapus spesies.', 'warn');
    } else {
      toast(`${item.local_name} berhasil dihapus dari database.`, 'info');
    }
  };

  const handlePurgeDummy = async () => {
    if (counts.dummy === 0) {
      toast('Tidak ada spesies berstatus Dummy.', 'info');
      return;
    }
    const msg =
      counts.unusedDummy === 0
        ? `Seluruh ${counts.dummy} spesies Dummy saat ini masih digunakan pada program aktif sehingga tidak ada yang bisa dihapus otomatis.`
        : `Hapus ${counts.unusedDummy} spesies Dummy yang tidak dipakai di program?\n(${counts.dummy - counts.unusedDummy} spesies Dummy yang masih dipakai program akan tetap aman dipertahankan.)`;
    if (counts.unusedDummy === 0) {
      toast(msg, 'warn');
      return;
    }
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await purgeUnusedDummySpecies();
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? 'Gagal membersihkan spesies dummy.', 'warn');
      return;
    }
    const skipNote =
      res.skippedInUse.length > 0
        ? ` (${res.skippedInUse.length} dilewati karena dipakai program: ${res.skippedInUse.slice(0, 4).join(', ')}${res.skippedInUse.length > 4 ? '…' : ''})`
        : '';
    toast(`${res.deleted} spesies Dummy berhasil dihapus${skipNote}.`);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(
      {
        schema: 'rimbun-species-catalog-v1',
        exported_at: new Date().toISOString(),
        species: speciesCatalog,
      },
      null,
      2,
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rimbun-database-spesies-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Database spesies diekspor ke JSON.');
  };

  const handleExportCsv = () => {
    const header = [
      'id',
      'local_name',
      'scientific_name',
      'growth_form',
      'role',
      'verification_status',
      'elev_min_m',
      'elev_max_m',
      'slope_max_deg',
      'rain_min_mm',
      'rain_max_mm',
      'soils',
      'kelas_ids',
      'co2_ton_per_ha_yr',
      'density_per_ha',
      'default_survival',
      'default_share',
      'carbon_source',
      'description',
      'traits',
    ];
    const lines = [
      header.join(','),
      ...speciesCatalog.map((s) =>
        [
          s.id,
          s.local_name,
          s.scientific_name,
          s.growth_form,
          s.suitability.role,
          s.verification_status,
          s.suitability.elev_m[0],
          s.suitability.elev_m[1],
          s.suitability.slope_max_deg,
          s.suitability.rain_mm[0],
          s.suitability.rain_mm[1],
          s.suitability.soils.join('; '),
          s.suitability.kelas_ids.join(';'),
          s.suitability.co2_ton_per_ha_yr ?? '',
          s.suitability.density_per_ha ?? '',
          s.suitability.default_survival ?? '',
          s.suitability.default_share ?? '',
          s.suitability.carbon_source ?? '',
          s.description,
          s.traits.join('; '),
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rimbun-database-spesies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Template & database spesies diekspor ke CSV (siap buka di Excel).');
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      let imported: SpeciesCatalogItem[] = [];

      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text) as { species?: SpeciesCatalogItem[] } | SpeciesCatalogItem[];
        const arr = Array.isArray(parsed) ? parsed : parsed.species;
        if (!Array.isArray(arr)) {
          toast('Format JSON tidak dikenali: harus berupa array spesies atau objek { species: [...] }.', 'warn');
          return;
        }
        imported = arr.filter((it) => !validateSpeciesCore(it));
      } else {
        // CSV parser (supports Excel CSV; empty/NaN derived columns stay null & valid!)
        const rows = text
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (rows.length < 2) {
          toast('File CSV kosong atau hanya berisi header.', 'warn');
          return;
        }
        const headers = parseCsvLine(rows[0]).map((h) => h.toLowerCase());
        const idx = (k: string) => headers.indexOf(k);

        for (let r = 1; r < rows.length; r++) {
          const cols = parseCsvLine(rows[r]);
          const get = (k: string) => {
            const i = idx(k);
            return i >= 0 ? (cols[i] ?? '').trim() : '';
          };
          const local_name = get('local_name');
          const scientific_name = get('scientific_name');
          if (!local_name || !scientific_name) continue;

          const rawRole = get('role').toLowerCase();
          const role: SpeciesRole =
            rawRole === 'klimaks' || rawRole === 'lokal'
              ? 'klimaks'
              : rawRole === 'agroforestri' || rawRole === 'mpts'
                ? 'agroforestri'
                : rawRole === 'riparian'
                  ? 'riparian'
                  : 'pionir';
          const rawForm = get('growth_form').toLowerCase();
          const growth_form: SpeciesGrowthForm =
            rawForm === 'pohon buah' || rawForm === 'palma' || rawForm === 'bambu' ? rawForm : 'pohon';
          const rawVerify = get('verification_status').toLowerCase();
          const verification_status: SpeciesVerificationStatus = rawVerify === 'dummy' ? 'dummy' : 'valid';

          const soils = get('soils')
            .split(/[;|]/)
            .map((x) => x.trim())
            .filter(Boolean);
          const kelas = get('kelas_ids')
            .split(/[;|]/)
            .map((x) => Number(x.trim()))
            .filter((k): k is 1 | 2 => k === 1 || k === 2);

          const rawSurv = toNullableNum(get('default_survival'));
          const default_survival = rawSurv != null ? (rawSurv > 1 ? Math.min(1, rawSurv / 100) : rawSurv) : null;

          const item: SpeciesCatalogItem = {
            id: get('id') || slugifySpeciesId(local_name),
            local_name,
            scientific_name,
            growth_form,
            verification_status,
            description: get('description'),
            traits: get('traits')
              .split(/[;|]/)
              .map((x) => x.trim())
              .filter(Boolean),
            suitability: {
              elev_m: [Number(get('elev_min_m') || 0), Number(get('elev_max_m') || 600)],
              slope_max_deg: Number(get('slope_max_deg') || 25),
              rain_mm: [Number(get('rain_min_mm') || 1800), Number(get('rain_max_mm') || 4200)],
              soils: soils.length > 0 ? soils : ['Padsolik'],
              kelas_ids: kelas.length > 0 ? kelas : [1, 2],
              role,
              co2_ton_per_ha_yr: toNullableNum(get('co2_ton_per_ha_yr')),
              density_per_ha: toNullableNum(get('density_per_ha')),
              default_survival,
              default_share: toNullableNum(get('default_share')),
              carbon_source: get('carbon_source') || null,
            },
          };
          if (!validateSpeciesCore(item)) imported.push(item);
        }
      }

      if (imported.length === 0) {
        toast('Tidak ada baris dengan Data Inti yang valid ditemukan pada file.', 'warn');
        return;
      }

      setBusy(true);
      const res = await upsertSpeciesBatch(imported);
      setBusy(false);
      if (res.ok) {
        toast(`${res.count} spesies berhasil diimpor ke database!`);
      }
    } catch {
      toast('Gagal membaca file impor. Pastikan format CSV atau JSON benar.', 'warn');
    }
  };

  return (
    <div className="species-mgr">
      <div className="species-mgr__inner">
        {isBackendConfigured && !speciesTableReady && (
          <Callout tone="info" icon="database" title="Tabel public.species belum dijalankan di Supabase">
            Website saat ini memuat 16 spesies seed bawaan secara lokal. Untuk mengaktifkan penyimpanan permanen ke Supabase, buka <b>Supabase Dashboard → SQL Editor</b> lalu jalankan isi file <code>supabase/migration_species.sql</code>.
          </Callout>
        )}

        {isSandboxDemo && (
          <Callout tone="sim" icon="shield" title="Mode Sandbox Demo Admin">
            Penambahan, edit, atau penghapusan spesies di sesi demo ini hanya tersimpan sementara di memori peramban dan tidak mengubah database Supabase asli.
          </Callout>
        )}

        {/* Top Summary & Actions */}
        <div className="species-mgr__head">
          <div className="species-mgr__kpis num">
            <div>
              <small>Total Spesies</small>
              <b>{counts.total}</b>
            </div>
            <div className="is-valid">
              <small>Valid (Terverifikasi)</small>
              <b>{counts.valid}</b>
            </div>
            <div className="is-dummy">
              <small>Dummy (Sementara)</small>
              <b>{counts.dummy}</b>
            </div>
            <div>
              <small>Dipakai di Program</small>
              <b>{counts.used}</b>
            </div>
          </div>

          <div className="species-mgr__actions">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              hidden
              onChange={handleImportFile}
            />
            <Button
              size="sm"
              variant="primary"
              icon="plus"
              onClick={() => {
                setEditingItem(null);
                setEditorOpen(true);
              }}
            >
              Tambah Spesies Baru
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="trash"
              disabled={busy || counts.dummy === 0}
              onClick={handlePurgeDummy}
            >
              Hapus Dummy ({counts.unusedDummy})
            </Button>
            <Button size="sm" variant="secondary" icon="download" onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button size="sm" variant="secondary" icon="download" onClick={handleExportJson}>
              Export JSON
            </Button>
            <Button size="sm" variant="secondary" icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>
              Import CSV / JSON
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="species-mgr__filters">
          <Input
            icon="search"
            type="search"
            placeholder="Cari nama lokal, nama ilmiah, jenis tanah, atau sitasi literatur…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            aria-label="Filter status verifikasi"
            value={verifyFilter}
            onChange={(e) => setVerifyFilter(e.target.value as VerifyFilter)}
          >
            <option value="all">Semua status ({counts.total})</option>
            <option value="valid">Valid saja ({counts.valid})</option>
            <option value="dummy">Dummy saja ({counts.dummy})</option>
          </Select>
          <Select
            aria-label="Filter peran ekologis"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">Semua peran ekologis</option>
            {(Object.entries(SPECIES_ROLE_LABEL) as [SpeciesRole, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        {/* Species Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="sprout"
            title="Tidak ada spesies yang cocok"
            body="Ubah kata kunci pencarian/filter atau tambahkan spesies baru beserta parameter biofisiknya."
            action={
              <Button
                icon="plus"
                onClick={() => {
                  setEditingItem(null);
                  setEditorOpen(true);
                }}
              >
                Tambah Spesies Baru
              </Button>
            }
          />
        ) : (
          <div className="species-db-grid">
            {filtered.map((sp) => {
              const m = resolveSpeciesMetrics(sp);
              const usedIn = usageBySpecies.get(sp.id) ?? [];
              return (
                <article
                  key={sp.id}
                  className={`species-db-card ${sp.verification_status === 'dummy' ? 'is-dummy' : 'is-valid'}`}
                >
                  <header className="species-db-card__head">
                    <div>
                      <div className="species-db-card__badges">
                        <Badge tone={sp.verification_status === 'valid' ? 'open' : 'funded'}>
                          {sp.verification_status === 'valid' ? 'Valid' : 'Dummy'}
                        </Badge>
                        <Badge tone="muted">{SPECIES_ROLE_LABEL[sp.suitability.role]}</Badge>
                        {usedIn.length > 0 && (
                          <span className="species-db-card__usage" title={`Dipakai di: ${usedIn.join(', ')}`}>
                            Dipakai di {usedIn.length} program
                          </span>
                        )}
                      </div>
                      <h3>{sp.local_name}</h3>
                      <p className="species-db-card__sci">
                        <i>{sp.scientific_name}</i> · <code>{sp.id}</code>
                      </p>
                    </div>
                    <div className="species-db-card__btns">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="check-circle"
                        title={sp.verification_status === 'valid' ? 'Ubah ke Dummy' : 'Tandai Valid'}
                        onClick={() => void handleToggleVerify(sp)}
                      >
                        {sp.verification_status === 'valid' ? 'Valid' : 'Validasi'}
                      </Button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${sp.local_name}`}
                        onClick={() => {
                          setEditingItem(sp);
                          setEditorOpen(true);
                        }}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Hapus ${sp.local_name}`}
                        disabled={busy}
                        onClick={() => void handleDelete(sp)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </header>

                  <dl className="species-db-card__bio num">
                    <div>
                      <dt>Elevasi</dt>
                      <dd>
                        {sp.suitability.elev_m[0]}–{sp.suitability.elev_m[1]} m
                      </dd>
                    </div>
                    <div>
                      <dt>Lereng max</dt>
                      <dd>≤ {sp.suitability.slope_max_deg}°</dd>
                    </div>
                    <div>
                      <dt>Curah hujan</dt>
                      <dd>
                        {sp.suitability.rain_mm[0]}–{sp.suitability.rain_mm[1]} mm
                      </dd>
                    </div>
                    <div>
                      <dt>Tutupan</dt>
                      <dd>Kelas {sp.suitability.kelas_ids.join(' & ')}</dd>
                    </div>
                    <div className="species-db-card__span2">
                      <dt>Tanah cocok</dt>
                      <dd>{sp.suitability.soils.join(', ')}</dd>
                    </div>
                  </dl>

                  <div className="species-db-card__carbon num">
                    <div>
                      <small>Serapan karbon ({m.isCarbonFallback ? 'Fallback Racelis' : 'Empiris'})</small>
                      <b>
                        {m.co2TonPerHaYr.toFixed(2).replace('.', ',')} t CO₂/ha/th ·{' '}
                        {m.co2KgPerSurvivingTreeYr.toFixed(1).replace('.', ',')} kg/pohon/th
                      </b>
                    </div>
                    <div>
                      <small>Kerapatan &amp; Survival</small>
                      <b>
                        {m.densityPerHa} bibit/ha{m.isDensityFallback ? ' (default)' : ''} ·{' '}
                        {Math.round(m.defaultSurvival * 100)}%
                      </b>
                    </div>
                  </div>

                  {sp.suitability.carbon_source && (
                    <p className="species-db-card__source">
                      <Icon name="file" size={13} /> {sp.suitability.carbon_source}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <SpeciesEditorModal
        open={editorOpen}
        existing={editingItem}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}
