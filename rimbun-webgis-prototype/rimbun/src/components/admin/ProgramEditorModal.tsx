import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { SITE_IMAGES } from '../../config/site';
import { SPECIES_CATALOG, SPECIES_CATALOG_META } from '../../data/speciesCatalog';
import { buildCostBreakdown, suggestProgramDefaults } from '../../lib/suitability/matchSpecies';
import { CATEGORY_LABEL } from '../../services/projectService';
import { useStore } from '../../store/AppStore';
import type {
  CostItem,
  LoaKuluPolygonProps,
  ProjectCategory,
  ProjectStatus,
  ProjectView,
  PublicationStatus,
  RestorationProject,
  SpeciesRecommendation,
} from '../../types';
import { cx, formatIDR, formatNumber, parseIDRInput } from '../../lib/format';
import { assetUrl } from '../../lib/assets';

interface Props {
  open: boolean;
  polygon: LoaKuluPolygonProps | null;
  existing?: ProjectView;
  onClose: () => void;
  onSaved?: (project: RestorationProject) => void;
}

export function ProgramEditorModal({ open, polygon, existing, onClose, onSaved }: Props) {
  const { upsertProject, toast } = useStore();

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('agroforestri');
  const [status, setStatus] = useState<ProjectStatus>('open');
  const [imageUrl, setImageUrl] = useState<string>(SITE_IMAGES[0].url);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [conditionSummary, setConditionSummary] = useState('');
  const [rehabNeeds, setRehabNeeds] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [species, setSpecies] = useState<SpeciesRecommendation[]>([]);
  const [fundingTarget, setFundingTarget] = useState(150_000_000);
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const applyAutoFill = (poly: LoaKuluPolygonProps) => {
    const sug = suggestProgramDefaults(poly);
    setName(sug.name);
    setShortName(sug.short_name);
    setCategory(sug.category);
    setStatus(sug.status);
    setImageUrl(sug.image_url);
    setSummary(sug.summary);
    setDescription(sug.description);
    setConditionSummary(sug.condition_summary);
    setRehabNeeds(sug.rehab_needs);
    setTagsRaw(sug.tags.join(', '));
    setSpecies(sug.recommended_species);
    setFundingTarget(sug.funding_target);
    setCosts(sug.cost_breakdown);
    setError(null);
  };

  useEffect(() => {
    if (!open || !polygon) return;
    if (existing) {
      setName(existing.name);
      setShortName(existing.short_name);
      setCategory(existing.category);
      setStatus(existing.status);
      setImageUrl(existing.image_url || SITE_IMAGES[0].url);
      setSummary(existing.summary);
      setDescription(existing.description);
      setConditionSummary(existing.condition_summary);
      setRehabNeeds(existing.rehab_needs);
      setTagsRaw(existing.tags.join(', '));
      setSpecies(existing.recommended_species);
      setFundingTarget(existing.funding_target);
      setCosts(existing.cost_breakdown);
      setError(null);
    } else {
      applyAutoFill(polygon);
    }
  }, [open, polygon, existing]);

  if (!open || !polygon) return null;

  const totalSeedlings = species.reduce((s, r) => s + (Number(r.seedlings) || 0), 0);
  const costSum = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const costDiff = fundingTarget - costSum;

  const rebalanceCosts = (targetAmt = fundingTarget) => {
    setCosts(buildCostBreakdown(Math.max(100_000, targetAmt), totalSeedlings, category));
  };

  const addSpeciesRow = () => {
    const unused = SPECIES_CATALOG.find((s) => !species.some((r) => r.species_id === s.id)) ?? SPECIES_CATALOG[0];
    setSpecies([
      ...species,
      {
        species_id: unused.id,
        seedlings: 1000,
        suitability_reason: 'Dipilih manual oleh kurator Admin.',
        survival_estimate: unused.suitability.default_survival,
      },
    ]);
  };

  const save = (pubStatus: PublicationStatus) => {
    if (name.trim().length < 4) {
      setError('Nama program minimal 4 karakter.');
      return;
    }
    if (fundingTarget < 1_000_000) {
      setError('Target pendanaan minimal Rp1.000.000.');
      return;
    }
    if (species.length === 0 || totalSeedlings <= 0) {
      setError('Minimal harus ada 1 spesies dengan jumlah bibit > 0.');
      return;
    }

    const finalCosts =
      costDiff === 0
        ? costs
        : buildCostBreakdown(fundingTarget, totalSeedlings, category);

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const record: RestorationProject = {
      id: polygon.lk_code,
      polygon_code: polygon.lk_code,
      publication_status: pubStatus,
      name: name.trim(),
      short_name: shortName.trim() || `Loa Kulu ${polygon.lk_code}`,
      summary: summary.trim() || `${polygon.luas_ha.toFixed(1)} ha di Kecamatan Loa Kulu.`,
      description: description.trim() || summary.trim(),
      status,
      category,
      condition_summary: conditionSummary.trim(),
      rehab_needs: rehabNeeds.trim(),
      recommended_species: species,
      cost_breakdown: finalCosts,
      funding_target: fundingTarget,
      funding_collected_base: existing?.funding_collected_base ?? 0,
      donor_count_base: existing?.donor_count_base ?? 0,
      started_at: existing?.started_at ?? new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString().slice(0, 10),
      updates:
        existing?.updates?.length
          ? existing.updates
          : [
              {
                date: new Date().toISOString().slice(0, 10),
                title: pubStatus === 'published' ? 'Program dipublikasikan' : 'Disimpan sebagai draft',
                body: 'Kurasi parameter fisik poligon dan penyusunan target pendanaan selesai.',
              },
            ],
      visual_seed: existing?.visual_seed ?? Number(polygon.lk_code.replace(/\D/g, '') || 10),
      image_url: imageUrl,
      tags: tags.length ? tags : ['Loa Kulu'],
    };

    upsertProject(record);
    toast(
      pubStatus === 'published'
        ? `${polygon.lk_code} dipublikasikan ke sisi Publik!`
        : `${polygon.lk_code} disimpan sebagai Draft Admin.`,
    );
    onSaved?.(record);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={existing ? `Edit Program · ${polygon.lk_code}` : `Kurasi Poligon Baru · ${polygon.lk_code}`}
      subtitle={`ID GEE: ${polygon.id} · Luas ${formatNumber(polygon.luas_ha)} ha · Kec. Loa Kulu`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <div className="admin-editor__foot-btns">
            <Button variant="secondary" icon="file" onClick={() => save('draft')}>
              Simpan Draft
            </Button>
            <Button variant="primary" icon="check" onClick={() => save('published')}>
              {existing?.publication_status === 'published' ? 'Simpan Perubahan' : 'Publish ke Publik'}
            </Button>
          </div>
        </>
      }
    >
      {/* Physical Parameter Reference Strip */}
      <div className="admin-ref">
        <div className="admin-ref__head">
          <span className="eyebrow">Parameter fisik poligon (baca-saja)</span>
          <Button
            size="sm"
            variant="secondary"
            icon="sparkles"
            onClick={() => {
              applyAutoFill(polygon);
              toast('Saran bibit, target biaya, & spesies diisi otomatis.', 'info');
            }}
          >
            Isi Otomatis
          </Button>
        </div>
        <div className="admin-ref__grid num">
          <div>
            <small>Luas</small>
            <b>{formatNumber(polygon.luas_ha)} ha</b>
          </div>
          <div>
            <small>Kelas</small>
            <b>{polygon.kelas_id === 1 ? '1 · Terbuka' : '2 · Semak'}</b>
          </div>
          <div>
            <small>Elevasi</small>
            <b>{polygon.elev_med.toFixed(1)} m</b>
          </div>
          <div>
            <small>Lereng</small>
            <b>{polygon.slope_med.toFixed(1)}°</b>
          </div>
          <div>
            <small>Hujan</small>
            <b>{Math.round(polygon.rain_mean)} mm</b>
          </div>
          <div>
            <small>Tanah</small>
            <b>{polygon.tanah_dom.split(',')[0]}</b>
          </div>
        </div>
      </div>

      {/* Program Metadata */}
      <div className="admin-form">
        <div className="two-col two-col--tight">
          <Input label="Nama Program" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Nama Singkat" value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </div>

        <div className="two-col two-col--tight">
          <Select label="Kategori Ekosistem" value={category} onChange={(e) => setCategory(e.target.value as ProjectCategory)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select label="Status Program" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            <option value="urgent">Mendesak (Butuh Dana Cepat)</option>
            <option value="open">Menggalang Dana</option>
            <option value="planting">Tahap Penanaman</option>
            <option value="monitoring">Monitoring</option>
          </Select>
        </div>

        <div>
          <span className="field__label">Foto Ilustrasi Lokasi</span>
          <div className="img-picker">
            {SITE_IMAGES.map((im) => (
              <button
                type="button"
                key={im.url}
                className={cx('img-picker__item', imageUrl === im.url && 'is-active')}
                onClick={() => setImageUrl(im.url)}
                title={im.label}
              >
                <img src={assetUrl(im.url)} alt={im.label} />
                <span>{im.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Input label="Ringkasan Singkat (Kartu & Sidebar)" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <Textarea label="Deskripsi Lengkap Lokasi" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="two-col two-col--tight">
          <Textarea label="Kondisi Deforestasi" rows={2} value={conditionSummary} onChange={(e) => setConditionSummary(e.target.value)} />
          <Textarea label="Kebutuhan Rehabilitasi" rows={2} value={rehabNeeds} onChange={(e) => setRehabNeeds(e.target.value)} />
        </div>

        <Input label="Tag (pisahkan koma)" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} />

        {/* Species Composer */}
        <div className="admin-box">
          <div className="admin-box__head">
            <div>
              <b>Komposisi Spesies Tanaman</b>
              <small className="muted">
                Total <span className="num">{formatNumber(totalSeedlings)}</span> bibit ({Math.round(totalSeedlings / Math.max(1, polygon.luas_ha))} bibit/ha) · {SPECIES_CATALOG_META.status}
              </small>
            </div>
            <Button size="sm" variant="secondary" icon="plus" onClick={addSpeciesRow}>
              Tambah Spesies
            </Button>
          </div>
          <div className="admin-species-list">
            {species.map((rec, idx) => (
              <div key={`${rec.species_id}-${idx}`} className="admin-species-row">
                <Select
                  aria-label="Spesies"
                  value={rec.species_id}
                  onChange={(e) => {
                    const next = [...species];
                    const catItem = SPECIES_CATALOG.find((s) => s.id === e.target.value);
                    next[idx] = {
                      ...rec,
                      species_id: e.target.value,
                      survival_estimate: catItem?.suitability.default_survival ?? rec.survival_estimate,
                    };
                    setSpecies(next);
                  }}
                >
                  {SPECIES_CATALOG.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.local_name} ({sp.scientific_name})
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Jumlah bibit"
                  type="number"
                  min={100}
                  step={100}
                  value={rec.seedlings}
                  onChange={(e) => {
                    const next = [...species];
                    next[idx] = { ...rec, seedlings: Math.max(0, Number(e.target.value) || 0) };
                    setSpecies(next);
                  }}
                />
                <Input
                  aria-label="Alasan kesesuaian"
                  value={rec.suitability_reason}
                  onChange={(e) => {
                    const next = [...species];
                    next[idx] = { ...rec, suitability_reason: e.target.value };
                    setSpecies(next);
                  }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Hapus spesies"
                  disabled={species.length <= 1}
                  onClick={() => setSpecies(species.filter((_, i) => i !== idx))}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Target Funding & Cost Breakdown */}
        <div className="admin-box">
          <div className="admin-box__head">
            <div>
              <b>Target Pendanaan &amp; Rincian Biaya</b>
              <small className="muted">
                All-in estimasi: <span className="num">{formatIDR(totalSeedlings > 0 ? fundingTarget / totalSeedlings : 0)}</span> / bibit
              </small>
            </div>
            <Button size="sm" variant="secondary" icon="refresh" onClick={() => rebalanceCosts(fundingTarget)}>
              Sesuaikan Proporsi
            </Button>
          </div>
          <Input
            label="Total Target Pendanaan (Rp)"
            prefix="Rp"
            inputMode="numeric"
            value={fundingTarget ? formatNumber(fundingTarget) : ''}
            onChange={(e) => {
              const val = Math.min(parseIDRInput(e.target.value), 50_000_000_000);
              setFundingTarget(val);
            }}
          />
          <div className="admin-costs">
            {costs.map((c, idx) => (
              <div key={c.label} className="admin-cost-row">
                <span>{c.label}</span>
                <Input
                  aria-label={`Biaya ${c.label}`}
                  prefix="Rp"
                  inputMode="numeric"
                  value={c.amount ? formatNumber(c.amount) : ''}
                  onChange={(e) => {
                    const val = parseIDRInput(e.target.value);
                    const next = [...costs];
                    next[idx] = { ...c, amount: val };
                    setCosts(next);
                  }}
                />
              </div>
            ))}
          </div>
          {costDiff !== 0 && (
            <div className="admin-cost-warn">
              <Badge tone="funded">Selisih rincian vs target: {formatIDR(costDiff)}</Badge>
              <small>Saat disimpan, rincian otomatis diselaraskan dengan Total Target (atau tekan Sesuaikan Proporsi).</small>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="field__error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </Modal>
  );
}
