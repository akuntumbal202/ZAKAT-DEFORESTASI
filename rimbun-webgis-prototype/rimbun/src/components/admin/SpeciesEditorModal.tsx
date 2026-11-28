import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import {
  LOA_KULU_SOIL_OPTIONS,
  ROLE_FALLBACK_CO2_TON_HA_YR,
  ROLE_FALLBACK_DENSITY_HA,
  SPECIES_ROLE_LABEL,
  resolveSpeciesMetrics,
  slugifySpeciesId,
  validateSpeciesCore,
} from '../../data/speciesCatalog';
import { useStore } from '../../store/AppStore';
import type {
  SpeciesCatalogItem,
  SpeciesGrowthForm,
  SpeciesRole,
  SpeciesVerificationStatus,
} from '../../types';
import { cx } from '../../lib/format';

interface Props {
  open: boolean;
  existing?: SpeciesCatalogItem | null;
  onClose: () => void;
  onSaved?: (item: SpeciesCatalogItem) => void;
}

function parseOptionalNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SpeciesEditorModal({ open, existing, onClose, onSaved }: Props) {
  const { speciesCatalog, upsertSpecies, isSandboxDemo, toast } = useStore();

  // Data Inti (Wajib)
  const [localName, setLocalName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [role, setRole] = useState<SpeciesRole>('pionir');
  const [growthForm, setGrowthForm] = useState<SpeciesGrowthForm>('pohon');
  const [verificationStatus, setVerificationStatus] = useState<SpeciesVerificationStatus>('valid');
  const [elevMin, setElevMin] = useState('0');
  const [elevMax, setElevMax] = useState('600');
  const [slopeMax, setSlopeMax] = useState('25');
  const [rainMin, setRainMin] = useState('1800');
  const [rainMax, setRainMax] = useState('4200');
  const [selectedSoils, setSelectedSoils] = useState<string[]>(['Padsolik', 'Latosol']);
  const [extraSoils, setExtraSoils] = useState('');
  const [kelasIds, setKelasIds] = useState<(1 | 2)[]>([1, 2]);

  // Data Turunan / Opsional (boleh kosong / null tanpa menurunkan status jadi dummy)
  const [co2HaRaw, setCo2HaRaw] = useState('');
  const [densityRaw, setDensityRaw] = useState('');
  const [survivalPctRaw, setSurvivalPctRaw] = useState('');
  const [shareRaw, setShareRaw] = useState('');
  const [carbonSource, setCarbonSource] = useState('');
  const [description, setDescription] = useState('');
  const [traitsRaw, setTraitsRaw] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    if (existing) {
      setLocalName(existing.local_name);
      setScientificName(existing.scientific_name);
      setRole(existing.suitability.role);
      setGrowthForm(existing.growth_form);
      setVerificationStatus(existing.verification_status);
      setElevMin(String(existing.suitability.elev_m[0]));
      setElevMax(String(existing.suitability.elev_m[1]));
      setSlopeMax(String(existing.suitability.slope_max_deg));
      setRainMin(String(existing.suitability.rain_mm[0]));
      setRainMax(String(existing.suitability.rain_mm[1]));

      const known = new Set<string>(LOA_KULU_SOIL_OPTIONS);
      const picked = existing.suitability.soils.filter((s) => known.has(s));
      const extras = existing.suitability.soils.filter((s) => !known.has(s));
      setSelectedSoils(picked);
      setExtraSoils(extras.join(', '));
      setKelasIds(existing.suitability.kelas_ids);

      setCo2HaRaw(existing.suitability.co2_ton_per_ha_yr != null ? String(existing.suitability.co2_ton_per_ha_yr) : '');
      setDensityRaw(existing.suitability.density_per_ha != null ? String(existing.suitability.density_per_ha) : '');
      setSurvivalPctRaw(
        existing.suitability.default_survival != null ? String(Math.round(existing.suitability.default_survival * 100)) : '',
      );
      setShareRaw(existing.suitability.default_share != null ? String(existing.suitability.default_share) : '');
      setCarbonSource(existing.suitability.carbon_source ?? '');
      setDescription(existing.description);
      setTraitsRaw(existing.traits.join(', '));
    } else {
      setLocalName('');
      setScientificName('');
      setRole('pionir');
      setGrowthForm('pohon');
      setVerificationStatus('valid');
      setElevMin('0');
      setElevMax('600');
      setSlopeMax('25');
      setRainMin('1800');
      setRainMax('4200');
      setSelectedSoils(['Padsolik', 'Latosol']);
      setExtraSoils('');
      setKelasIds([1, 2]);
      setCo2HaRaw('');
      setDensityRaw('');
      setSurvivalPctRaw('');
      setShareRaw('');
      setCarbonSource('');
      setDescription('');
      setTraitsRaw('');
    }
  }, [open, existing]);

  const draftItem = useMemo<SpeciesCatalogItem>(() => {
    const soils = [
      ...selectedSoils,
      ...extraSoils
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ];
    const survPct = parseOptionalNumber(survivalPctRaw);
    const defaultSurvival = survPct != null ? Math.min(1, Math.max(0.05, survPct / 100)) : null;

    let id = existing?.id ?? slugifySpeciesId(localName || scientificName);
    if (!existing && speciesCatalog.some((s) => s.id === id)) {
      let i = 2;
      while (speciesCatalog.some((s) => s.id === `${id}-${i}`)) i++;
      id = `${id}-${i}`;
    }

    return {
      id,
      local_name: localName.trim(),
      scientific_name: scientificName.trim(),
      growth_form: growthForm,
      verification_status: verificationStatus,
      description: description.trim(),
      traits: traitsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      suitability: {
        elev_m: [Number(elevMin), Number(elevMax)],
        slope_max_deg: Number(slopeMax),
        rain_mm: [Number(rainMin), Number(rainMax)],
        soils: [...new Set(soils)],
        kelas_ids: kelasIds,
        role,
        co2_ton_per_ha_yr: parseOptionalNumber(co2HaRaw),
        density_per_ha: parseOptionalNumber(densityRaw) != null ? Math.round(parseOptionalNumber(densityRaw)!) : null,
        default_survival: defaultSurvival,
        default_share: parseOptionalNumber(shareRaw),
        carbon_source: carbonSource.trim() || null,
      },
    };
  }, [
    existing?.id,
    localName,
    scientificName,
    growthForm,
    verificationStatus,
    description,
    traitsRaw,
    elevMin,
    elevMax,
    slopeMax,
    rainMin,
    rainMax,
    selectedSoils,
    extraSoils,
    kelasIds,
    role,
    co2HaRaw,
    densityRaw,
    survivalPctRaw,
    shareRaw,
    carbonSource,
    speciesCatalog,
  ]);

  if (!open) return null;

  const preview = resolveSpeciesMetrics(draftItem);

  const toggleSoil = (soil: string) => {
    setSelectedSoils((prev) => (prev.includes(soil) ? prev.filter((s) => s !== soil) : [...prev, soil]));
  };

  const toggleKelas = (k: 1 | 2) => {
    setKelasIds((prev) => {
      const has = prev.includes(k);
      const next = has ? prev.filter((x) => x !== k) : [...prev, k].sort();
      return next as (1 | 2)[];
    });
  };

  const handleSave = async () => {
    const err = validateSpeciesCore(draftItem);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await upsertSpecies(draftItem);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Gagal menyimpan spesies ke database.');
      return;
    }
    toast(
      isSandboxDemo
        ? `${draftItem.local_name} disimpan di Mode Sandbox Demo.`
        : existing
          ? `Perubahan spesies ${draftItem.local_name} tersimpan ke database.`
          : `Spesies baru ${draftItem.local_name} ditambahkan ke database!`,
    );
    onSaved?.(draftItem);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={existing ? `Edit Spesies · ${existing.local_name}` : 'Tambah Spesies Pohon Baru'}
      subtitle="Data Inti wajib diisi untuk pemeringkatan SDSS; kolom turunan/karbon boleh dikosongkan tanpa menurunkan status Valid."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" icon="check" loading={saving} onClick={handleSave}>
            {existing ? 'Simpan Perubahan' : 'Simpan ke Database Spesies'}
          </Button>
        </>
      }
    >
      <div className="admin-form">
        {/* Section 1: Data Inti (Wajib) */}
        <div className="admin-box">
          <div className="admin-box__head">
            <div>
              <b>1. Data Inti &amp; Parameter Biofisik (Wajib)</b>
              <small className="muted">Dipakai langsung oleh sistem SDSS untuk memeringkatkan kesesuaian lahan Loa Kulu.</small>
            </div>
            <Badge tone={verificationStatus === 'valid' ? 'open' : 'funded'}>
              {verificationStatus === 'valid' ? 'Status: Valid' : 'Status: Dummy'}
            </Badge>
          </div>

          <div className="two-col two-col--tight">
            <Input
              label="Nama Lokal *"
              placeholder="mis. Johar, Sungkai, Meranti Merah"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
            />
            <Input
              label="Nama Ilmiah *"
              placeholder="mis. Senna siamea"
              value={scientificName}
              onChange={(e) => setScientificName(e.target.value)}
            />
          </div>

          <div className="three-col-tight">
            <Select label="Peran Ekologis *" value={role} onChange={(e) => setRole(e.target.value as SpeciesRole)}>
              {(Object.entries(SPECIES_ROLE_LABEL) as [SpeciesRole, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select label="Bentuk Tumbuh" value={growthForm} onChange={(e) => setGrowthForm(e.target.value as SpeciesGrowthForm)}>
              <option value="pohon">Pohon</option>
              <option value="pohon buah">Pohon buah (MPTS)</option>
              <option value="palma">Palma</option>
              <option value="bambu">Bambu</option>
            </Select>
            <Select
              label="Status Verifikasi"
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value as SpeciesVerificationStatus)}
            >
              <option value="valid">Valid (Terverifikasi)</option>
              <option value="dummy">Dummy (Sementara / Mudah Dihapus)</option>
            </Select>
          </div>

          <div className="admin-bio-grid">
            <Input label="Elevasi Min (mdpl) *" type="number" min={0} value={elevMin} onChange={(e) => setElevMin(e.target.value)} />
            <Input label="Elevasi Max (mdpl) *" type="number" min={1} value={elevMax} onChange={(e) => setElevMax(e.target.value)} />
            <Input label="Lereng Max (°) *" type="number" min={1} max={90} value={slopeMax} onChange={(e) => setSlopeMax(e.target.value)} />
            <Input label="Hujan Min (mm/th) *" type="number" min={0} value={rainMin} onChange={(e) => setRainMin(e.target.value)} />
            <Input label="Hujan Max (mm/th) *" type="number" min={100} value={rainMax} onChange={(e) => setRainMax(e.target.value)} />
          </div>

          <div>
            <span className="field__label">Jenis Tanah yang Cocok (Dataset Loa Kulu) *</span>
            <div className="chip-toggle-row">
              {LOA_KULU_SOIL_OPTIONS.map((soil) => {
                const active = selectedSoils.includes(soil);
                return (
                  <button
                    type="button"
                    key={soil}
                    className={cx('chip-btn', active && 'is-active')}
                    onClick={() => toggleSoil(soil)}
                  >
                    {active && <Icon name="check" size={13} />} {soil}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 8 }}>
              <Input
                placeholder="Jenis tanah lain (opsional, pisahkan koma)"
                value={extraSoils}
                onChange={(e) => setExtraSoils(e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className="field__label">Kelas Tutupan Lahan Target (Dynamic World) *</span>
            <div className="chip-toggle-row">
              <button
                type="button"
                className={cx('chip-btn', kelasIds.includes(1) && 'is-active')}
                onClick={() => toggleKelas(1)}
              >
                {kelasIds.includes(1) && <Icon name="check" size={13} />} Kelas 1 · Lahan Terbuka / Pascatambang
              </button>
              <button
                type="button"
                className={cx('chip-btn', kelasIds.includes(2) && 'is-active')}
                onClick={() => toggleKelas(2)}
              >
                {kelasIds.includes(2) && <Icon name="check" size={13} />} Kelas 2 · Semak / Kebun Terbuka
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Data Turunan & Karbon (Opsional) */}
        <div className="admin-box">
          <div className="admin-box__head">
            <div>
              <b>2. Parameter Karbon &amp; Turunan (Opsional — boleh dikosongkan)</b>
              <small className="muted">
                Bila kosong, status tetap <b>Valid</b> dan kalkulator memakai fallback ilmiah (Racelis 2019 &amp; Sarjono 2017).
              </small>
            </div>
          </div>

          <div className="admin-bio-grid admin-bio-grid--4">
            <Input
              label="Serapan CO₂ (t/ha/th)"
              placeholder={`Fallback ${ROLE_FALLBACK_CO2_TON_HA_YR[role]}`}
              inputMode="decimal"
              value={co2HaRaw}
              onChange={(e) => setCo2HaRaw(e.target.value)}
            />
            <Input
              label="Kerapatan (bibit/ha)"
              placeholder={`Fallback ${ROLE_FALLBACK_DENSITY_HA[role]}`}
              type="number"
              min={50}
              value={densityRaw}
              onChange={(e) => setDensityRaw(e.target.value)}
            />
            <Input
              label="Survival Rate (%)"
              placeholder="Fallback 70"
              type="number"
              min={10}
              max={100}
              value={survivalPctRaw}
              onChange={(e) => setSurvivalPctRaw(e.target.value)}
            />
            <Input
              label="Bobot Porsi Bibit"
              placeholder="Fallback 0.30"
              inputMode="decimal"
              value={shareRaw}
              onChange={(e) => setShareRaw(e.target.value)}
            />
          </div>

          <div className="sdss-preview-strip num">
            <div>
              <small>Laju serapan efektif</small>
              <b>
                {preview.co2TonPerHaYr.toFixed(2).replace('.', ',')} t CO₂/ha/th{' '}
                <span>({preview.isCarbonFallback ? 'Fallback Racelis' : 'Data Spesies'})</span>
              </b>
            </div>
            <div>
              <small>Ekuivalen per pohon hidup (dewasa)</small>
              <b>{preview.co2KgPerSurvivingTreeYr.toFixed(1).replace('.', ',')} kg CO₂/pohon/th</b>
            </div>
            <div>
              <small>Kerapatan &amp; Survival</small>
              <b>
                {preview.densityPerHa} bibit/ha · {Math.round(preview.defaultSurvival * 100)}%
              </b>
            </div>
          </div>

          <Input
            label="Sumber Referensi / Sitasi Literatur (opsional)"
            placeholder="mis. Fajariani et al. (2020) — PT MHU Loa Kulu"
            value={carbonSource}
            onChange={(e) => setCarbonSource(e.target.value)}
          />

          <Textarea
            label="Deskripsi Ekologis & Silvikultur (opsional)"
            rows={2}
            placeholder="Ringkasan peran spesies, kebutuhan naungan, atau manfaat ekonomi masyarakat..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Input
            label="Tag Karakteristik / Traits (opsional, pisahkan koma)"
            placeholder="mis. Pionir, Pengikat nitrogen, Lokal Kalimantan"
            value={traitsRaw}
            onChange={(e) => setTraitsRaw(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="field__error" role="alert" style={{ marginTop: 12 }}>
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </Modal>
  );
}
