import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox, Input, Select, Textarea } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { SITE_IMAGES } from '../../config/site';
import { SPECIES_ROLE_LABEL, resolveSpeciesMetrics } from '../../data/speciesCatalog';
import {
  buildCostBreakdown,
  buildSuitabilityReason,
  evaluateSpeciesForPolygon,
  matchSpeciesForPolygon,
  rankSpeciesForPolygon,
  suggestProgramDefaults,
  type RankedSpeciesEvaluation,
} from '../../lib/suitability/matchSpecies';
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
  SpeciesCatalogItem,
  SpeciesRecommendation,
} from '../../types';
import { cx, formatIDR, formatNumber, parseIDRInput } from '../../lib/format';
import { assetUrl } from '../../lib/assets';
import { SpeciesEditorModal } from './SpeciesEditorModal';

interface Props {
  open: boolean;
  polygon: LoaKuluPolygonProps | null;
  existing?: ProjectView;
  onClose: () => void;
  onSaved?: (project: RestorationProject) => void;
}

export function ProgramEditorModal({ open, polygon, existing, onClose, onSaved }: Props) {
  const { speciesCatalog, speciesById, upsertProject, toast } = useStore();

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
  const [validOnly, setValidOnly] = useState(false);
  const [newSpeciesModalOpen, setNewSpeciesModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyAutoFill = (poly: LoaKuluPolygonProps, onlyValid = validOnly) => {
    const sug = suggestProgramDefaults(poly, speciesCatalog, { validOnly: onlyValid });
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
    setValidOnly(false);
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
      applyAutoFill(polygon, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, polygon?.lk_code, existing?.id]);

  // Evaluate EVERY species in the live database against this polygon
  const allRanked = useMemo<RankedSpeciesEvaluation[]>(() => {
    if (!polygon) return [];
    return rankSpeciesForPolygon(polygon, speciesCatalog, {
      validOnly: false,
      prioritizeValid: true,
    });
  }, [polygon, speciesCatalog]);

  const evalById = useMemo<Record<string, RankedSpeciesEvaluation>>(
    () => Object.fromEntries(allRanked.map((ev) => [ev.item.id, ev])),
    [allRanked],
  );

  const visibleRanked = useMemo(
    () => (validOnly ? allRanked.filter((ev) => ev.item.verification_status === 'valid') : allRanked),
    [allRanked, validOnly],
  );

  if (!open || !polygon) return null;

  const totalSeedlings = species.reduce((s, r) => s + (Number(r.seedlings) || 0), 0);
  const costSum = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const costDiff = fundingTarget - costSum;

  // Weighted stand carbon rate preview for this composition
  const weightedCo2Ha =
    totalSeedlings > 0
      ? species.reduce((sum, r) => {
          const sp = speciesById[r.species_id];
          const rate = sp ? resolveSpeciesMetrics(sp).co2TonPerHaYr : 18.55;
          return sum + rate * (Number(r.seedlings) || 0);
        }, 0) / totalSeedlings
      : 18.55;

  const rebalanceCosts = (targetAmt = fundingTarget) => {
    setCosts(buildCostBreakdown(Math.max(100_000, targetAmt), totalSeedlings, category));
  };

  const pickRankedSpecies = (ev: RankedSpeciesEvaluation) => {
    if (species.some((r) => r.species_id === ev.item.id)) {
      toast(`${ev.item.local_name} sudah ada di komposisi program.`, 'info');
      return;
    }
    const m = resolveSpeciesMetrics(ev.item);
    setSpecies([
      ...species,
      {
        species_id: ev.item.id,
        seedlings: 1000,
        suitability_reason: buildSuitabilityReason(ev, polygon),
        survival_estimate: m.defaultSurvival,
      },
    ]);
  };

  const addSpeciesRow = () => {
    const pool = visibleRanked.length > 0 ? visibleRanked : allRanked;
    const unused = pool.find((ev) => !species.some((r) => r.species_id === ev.item.id)) ?? pool[0];
    if (!unused) return;
    pickRankedSpecies(unused);
  };

  const refillTopRecommended = () => {
    const recs = matchSpeciesForPolygon(polygon, speciesCatalog, { validOnly });
    if (recs.length === 0) {
      toast('Tidak ada spesies yang tersedia pada filter aktif.', 'warn');
      return;
    }
    setSpecies(recs);
    toast(`Komposisi diisi ulang dengan Top ${recs.length} spesies peringkat SDSS tertinggi.`, 'info');
  };

  const handleNewSpeciesCreated = (created: SpeciesCatalogItem) => {
    const ev = evaluateSpeciesForPolygon(created, polygon);
    const m = resolveSpeciesMetrics(created);
    setSpecies((prev) => [
      ...prev,
      {
        species_id: created.id,
        seedlings: 1000,
        suitability_reason: buildSuitabilityReason(ev, polygon),
        survival_estimate: m.defaultSurvival,
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
      costDiff === 0 ? costs : buildCostBreakdown(fundingTarget, totalSeedlings, category);

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
    <>
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
            <span className="eyebrow">Parameter biofisik poligon (dasar peringkat SDSS)</span>
            <Button
              size="sm"
              variant="secondary"
              icon="sparkles"
              onClick={() => {
                applyAutoFill(polygon, validOnly);
                toast('Draft spesies peringkat teratas, kerapatan bibit, & biaya diisi otomatis.', 'info');
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

          {/* SDSS Species Composer */}
          <div className="admin-box">
            <div className="admin-box__head">
              <div>
                <b>Komposisi Spesies Tanaman (Peringkat SDSS)</b>
                <small className="muted">
                  Total <span className="num">{formatNumber(totalSeedlings)}</span> bibit ({Math.round(totalSeedlings / Math.max(1, polygon.luas_ha))} bibit/ha) · Laju rata-rata{' '}
                  <span className="num">{weightedCo2Ha.toFixed(1).replace('.', ',')} t CO₂/ha/th</span>
                </small>
              </div>
              <div className="admin-box__actions">
                <Button size="sm" variant="ghost" icon="sparkles" onClick={refillTopRecommended}>
                  Isi Top 3 SDSS
                </Button>
                <Button size="sm" variant="secondary" icon="plus-circle" onClick={() => setNewSpeciesModalOpen(true)}>
                  + Spesies Baru
                </Button>
                <Button size="sm" variant="secondary" icon="plus" onClick={addSpeciesRow}>
                  Tambah Baris
                </Button>
              </div>
            </div>

            {/* Filter & Top Ranked Quick-Pick Chips */}
            <div className="sdss-bar">
              <Checkbox
                checked={validOnly}
                onChange={setValidOnly}
                label={`Tampilkan hanya spesies Valid (${allRanked.filter((x) => x.item.verification_status === 'valid').length}/${allRanked.length})`}
              />
            </div>

            <div className="sdss-top-strip">
              <span className="sdss-top-strip__label">Rekomendasi teratas untuk {polygon.lk_code} (klik untuk tambah):</span>
              <div className="sdss-top-chips">
                {visibleRanked.slice(0, 6).map((ev) => {
                  const picked = species.some((r) => r.species_id === ev.item.id);
                  return (
                    <button
                      type="button"
                      key={ev.item.id}
                      className={cx('sdss-chip', picked && 'is-picked')}
                      onClick={() => pickRankedSpecies(ev)}
                      title={`${ev.tier} (${ev.matchedCount}/5 cocok) · ${SPECIES_ROLE_LABEL[ev.item.suitability.role]}`}
                    >
                      <span className="sdss-chip__score num">{ev.score}%</span>
                      <span className="sdss-chip__name">{ev.item.local_name}</span>
                      <span className={cx('sdss-chip__tag', ev.item.verification_status === 'valid' ? 'is-valid' : 'is-dummy')}>
                        {ev.item.verification_status === 'valid' ? 'Valid' : 'Dummy'}
                      </span>
                      {picked && <Icon name="check" size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Species Rows */}
            <div className="admin-species-list">
              {species.map((rec, idx) => {
                const ev = evalById[rec.species_id];
                const sp = speciesById[rec.species_id];
                const metrics = sp ? resolveSpeciesMetrics(sp) : null;
                // Ensure currently selected species always appears in dropdown even if filtered out by validOnly
                const optionsList =
                  ev && !visibleRanked.some((x) => x.item.id === ev.item.id)
                    ? [ev, ...visibleRanked]
                    : visibleRanked;

                return (
                  <div key={`${rec.species_id}-${idx}`} className="admin-species-card">
                    <div className="admin-species-row admin-species-row--sdss">
                      <Select
                        aria-label="Spesies (urut peringkat SDSS)"
                        value={rec.species_id}
                        onChange={(e) => {
                          const next = [...species];
                          const chosenEv = evalById[e.target.value];
                          const catItem = speciesById[e.target.value];
                          const m = catItem ? resolveSpeciesMetrics(catItem) : null;
                          next[idx] = {
                            ...rec,
                            species_id: e.target.value,
                            survival_estimate: m?.defaultSurvival ?? rec.survival_estimate,
                            suitability_reason: chosenEv
                              ? buildSuitabilityReason(chosenEv, polygon)
                              : rec.suitability_reason,
                          };
                          setSpecies(next);
                        }}
                      >
                        {optionsList.map((cand) => (
                          <option key={cand.item.id} value={cand.item.id}>
                            [{cand.score}% · {cand.item.verification_status === 'valid' ? 'Valid' : 'Dummy'}] {cand.item.local_name} ({cand.item.scientific_name}) · {SPECIES_ROLE_LABEL[cand.item.suitability.role]}
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

                    {ev && (
                      <div className="sdss-checks">
                        <span className={cx('sdss-score-pill num', ev.score >= 85 ? 'is-high' : ev.score >= 70 ? 'is-mid' : 'is-low')}>
                          SDSS {ev.score}% · {ev.tier}
                        </span>
                        {ev.checks.map((c) => (
                          <span key={c.key} className={cx('sdss-check', c.ok ? 'is-ok' : 'is-miss')} title={c.detail}>
                            {c.label} {c.ok ? '✓' : '✕'}
                          </span>
                        ))}
                        {metrics && (
                          <span className="sdss-check is-meta num">
                            {metrics.co2TonPerHaYr.toFixed(1).replace('.', ',')} t CO₂/ha/th
                            {metrics.isCarbonFallback ? ' (fallback)' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    <Input
                      aria-label="Alasan kesesuaian"
                      value={rec.suitability_reason}
                      onChange={(e) => {
                        const next = [...species];
                        next[idx] = { ...rec, suitability_reason: e.target.value };
                        setSpecies(next);
                      }}
                    />
                  </div>
                );
              })}
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

      <SpeciesEditorModal
        open={newSpeciesModalOpen}
        onClose={() => setNewSpeciesModalOpen(false)}
        onSaved={handleNewSpeciesCreated}
      />
    </>
  );
}
