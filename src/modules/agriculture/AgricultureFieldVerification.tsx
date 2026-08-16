"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ClipboardCheck, CloudRain, Info, Leaf, ShieldAlert } from "lucide-react";
import { useCompany } from "../../../src/hooks/useCompany";
import { useLocale } from "../../../src/hooks/useLocale";
import { cn } from "../../../lib/utils";
import { createAgricultureFieldVerification, reviewAgricultureFieldVerification } from "./agriculture.client";
import { agricultureAnswerLabel, agricultureAreaQualityLabel, agricultureCopy, agricultureCropName, agricultureGapTypeLabel, agricultureHazardLabel, agricultureImportanceLabel, agricultureIrrigationLabel, agricultureMechanizationLabel, agriculturePresenceLabel, agriculturePriorityLabel, agricultureStageLabel, agricultureVerificationLevelLabel, agricultureVerificationMethodLabel, agricultureVerificationStatusLabel, localizedText } from "./agriculture.ui";
import { selectCurrentFieldVerifications, type AgricultureFieldVerificationInput, type AgricultureOverviewPayload } from "./agriculture.types";
import { weatherConditionLabel, weatherRiskShortLabel } from "../weather/weather.ui";

type Props = {
  overview: AgricultureOverviewPayload;
  selectedLocationId?: string;
  selectedCropId?: string;
  onSaved: () => void;
};

type Draft = {
  locationId: string;
  cropId: string;
  cropPresence: "YES" | "NO" | "UNKNOWN";
  importance: "MAJOR" | "SECONDARY" | "MINOR" | "UNKNOWN";
  estimatedArea: string;
  areaUnit: string;
  areaQuality: "KNOWN" | "APPROXIMATE" | "UNKNOWN";
  plantingStartMonth: string;
  plantingEndMonth: string;
  harvestStartMonth: string;
  harvestEndMonth: string;
  currentStage: string;
  irrigationType: "RAIN_FED" | "IRRIGATED" | "MIXED" | "UNKNOWN";
  mechanizationLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  commonMachines: string;
  verificationMethod: "FIELD_VISIT" | "BRANCH_REPORT" | "SALESPERSON_REPORT" | "CUSTOMER_REPORT" | "MANAGER_CONFIRMATION" | "OTHER";
  notes: string;
  verificationLevel: "V2" | "V3" | "V4";
};

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthsThai = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const priorityByTownship: Record<string, "HIGH" | "MEDIUM" | "LOW"> = {
  Tharrawaddy: "HIGH",
  "Hpa-An": "HIGH",
  Kawkareik: "HIGH",
  Myawaddy: "HIGH",
  Mawlamyine: "MEDIUM",
  Kyaikmaraw: "MEDIUM",
  Thanbyuzayat: "MEDIUM",
  Nattalin: "LOW",
  Mudon: "LOW",
};

export function AgricultureFieldVerification({ overview, selectedLocationId, selectedCropId, onSaved }: Props) {
  const { selectedCompany } = useCompany();
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  const canEdit = Boolean(selectedCompany && selectedCompany.role !== "viewer");
  const townships = useMemo(() => overview.locations.filter((location) => location.geographyLevel === "TOWNSHIP"), [overview.locations]);
  const initialLocationId = selectedLocationId && townships.some((location) => location.locationId === selectedLocationId) ? selectedLocationId : townships[0]?.locationId ?? "";
  const initialCropId = selectedCropId && overview.crops.some((crop) => crop.cropId === selectedCropId) ? selectedCropId : overview.crops[0]?.cropId ?? "";
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(initialLocationId, initialCropId));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentRows = useMemo(() => selectCurrentFieldVerifications(overview.fieldVerifications), [overview.fieldVerifications]);
  const activeLocationId = selectedLocationId && townships.some((location) => location.locationId === selectedLocationId) ? selectedLocationId : draft.locationId || initialLocationId;
  const activeCropId = selectedCropId && overview.crops.some((crop) => crop.cropId === selectedCropId) ? selectedCropId : draft.cropId || initialCropId;
  const selectedLocation = townships.find((location) => location.locationId === activeLocationId) ?? null;
  const selectedCrop = overview.crops.find((crop) => crop.cropId === activeCropId) ?? null;
  const selectedPublicPresence = overview.cropPresence.find((row) => row.locationId === activeLocationId && row.cropId === activeCropId) ?? null;
  const selectedCurrent = currentRows.find((row) => row.locationId === activeLocationId && row.cropId === activeCropId) ?? null;
  const selectedStageOptions = overview.cropStages.filter((stage) => stage.cropId === activeCropId);
  const selectedWeather = selectedLocation?.weatherLocationId ? overview.weather.locations.find((weather) => weather.id === selectedLocation.weatherLocationId) ?? null : null;
  const stateBaseline = selectedLocation?.stateRegionName ? overview.locations.find((location) => location.geographyLevel === "STATE_REGION" && location.canonicalName.toLowerCase().includes(selectedLocation.stateRegionName?.toLowerCase() ?? "")) : null;
  const stateRows = overview.statistics.filter((row) => row.locationId === stateBaseline?.locationId && row.cropId === activeCropId && row.sourceGeography === "STATE_REGION").sort((left, right) => (right.cropYear ?? 0) - (left.cropYear ?? 0));
  const regionalCalendar = overview.calendar.filter((row) => row.cropId === activeCropId && row.sourceGeography === "REGIONAL" && !row.inheritedFromLocationId).slice(0, 3);
  const nationalYield = overview.officialUnionYield.filter((row) => row.cropId === activeCropId).sort((left, right) => right.cropYear - left.cropYear)[0] ?? null;
  const hazards = overview.historicalHazards.filter((row) => row.locationId === activeLocationId);
  const lastSourceYear = latestYear([
    selectedPublicPresence?.evidenceYear ?? null,
    ...overview.statistics.filter((row) => row.locationId === activeLocationId && row.cropId === activeCropId).map((row) => row.sourceYear),
    ...overview.calendar.filter((row) => row.locationId === activeLocationId && row.cropId === activeCropId).map((row) => row.validToYear ?? row.cropYear),
    nationalYield?.cropYear ?? null,
  ]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(input: AgricultureFieldVerificationInput) {
    if (!canEdit) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await createAgricultureFieldVerification(selectedCompany?.id, input);
      setMessage(language === "th"
        ? `บันทึกเป็นรายงานจากพื้นที่ระดับ ${agricultureVerificationLevelLabel(result.verificationLevel, language)} แล้ว${result.closedGapTypes.length ? ` ปิดประเด็นข้อมูล: ${result.closedGapTypes.map((gap) => agricultureGapTypeLabel(gap, language)).join(", ")}` : " ไม่มีประเด็นข้อมูลที่ตรงกันให้ปิด"}`
        : `Saved as ${result.verificationLevel} local report. ${result.closedGapTypes.length ? `Closed: ${result.closedGapTypes.join(", ")}.` : "No matching gap was closed."}`);
      onSaved();
    } catch (saveError) {
      setError(language === "th" ? "ไม่สามารถบันทึกข้อมูลยืนยันจากพื้นที่ได้" : saveError instanceof Error ? saveError.message : "Unable to save local verification.");
    } finally {
      setSaving(false);
    }
  }

  function quickVerify(cropId: string, answer: "YES" | "NO" | "UNKNOWN") {
    const locationId = activeLocationId;
    if (!locationId || !cropId) return;
    void save({
      locationId,
      cropId,
      cropYear: 2026,
      seasonCode: null,
      cropPresence: answer,
      importance: "UNKNOWN",
      estimatedArea: null,
      areaUnit: null,
      areaQuality: "UNKNOWN",
      plantingStartMonth: null,
      plantingEndMonth: null,
      harvestStartMonth: null,
      harvestEndMonth: null,
      currentStage: null,
      irrigationType: "UNKNOWN",
      mechanizationLevel: "UNKNOWN",
      commonMachines: [],
      notes: localizedText(language, "รายงานจากพื้นที่แบบรวดเร็ว; รายละเอียดที่ยังไม่มีข้อมูลต้องติดตามเพิ่มเติม", "Quick Verify local report; details require follow-up where unknown."),
      verificationMethod: "BRANCH_REPORT",
      verificationLevel: "V2",
      confidenceScore: 50,
      evidence: localizedText(language, "รายงานจากพื้นที่แบบรวดเร็ว", "Quick Verify local report"),
      verifiedBy: selectedCompany?.id ?? "local-user",
      verifiedRole: selectedCompany?.role ?? "viewer",
    });
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save({
      locationId: activeLocationId,
      cropId: activeCropId,
      cropYear: 2026,
      seasonCode: null,
      cropPresence: draft.cropPresence,
      importance: draft.importance,
      estimatedArea: draft.estimatedArea.trim() ? Number(draft.estimatedArea) : null,
      areaUnit: draft.areaUnit.trim() || null,
      areaQuality: draft.areaQuality,
      plantingStartMonth: monthValue(draft.plantingStartMonth),
      plantingEndMonth: monthValue(draft.plantingEndMonth),
      harvestStartMonth: monthValue(draft.harvestStartMonth),
      harvestEndMonth: monthValue(draft.harvestEndMonth),
      currentStage: draft.currentStage || null,
      irrigationType: draft.irrigationType,
      mechanizationLevel: draft.mechanizationLevel,
      commonMachines: draft.commonMachines.split(",").map((machine) => machine.trim()).filter(Boolean),
      notes: draft.notes.trim() || null,
      verificationMethod: draft.verificationMethod,
      verificationLevel: draft.verificationLevel,
      confidenceScore: null,
      evidence: draft.notes.trim() || localizedText(language, "รายงานการยืนยันข้อมูลจากพื้นที่", "Local field verification submission"),
      verifiedBy: selectedCompany?.id ?? "local-user",
      verifiedRole: selectedCompany?.role ?? "viewer",
    });
  }

  async function approve(row: AgricultureOverviewPayload["fieldVerifications"][number]) {
    if (!canEdit || !selectedCompany || row.status !== "PENDING") return;
    setSaving(true);
    setError("");
    try {
      await reviewAgricultureFieldVerification(selectedCompany.id, { verificationId: row.verificationId, status: "APPROVED", verificationLevel: row.verificationLevel, reviewedBy: selectedCompany.id });
      setMessage(language === "th" ? `อนุมัติรายการ ${row.verificationId} ที่ระดับ ${agricultureVerificationLevelLabel(row.verificationLevel, language)} แล้ว ระบบจะไม่เลื่อนระดับอัตโนมัติ` : `Approved ${row.verificationId} at ${row.verificationLevel}; level was not auto-promoted.`);
      onSaved();
    } catch (reviewError) {
      setError(language === "th" ? "ไม่สามารถตรวจสอบรายการยืนยันข้อมูลได้" : reviewError instanceof Error ? reviewError.message : "Unable to review verification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 space-y-5" data-local-field-verification>
      <header className="rounded-[var(--radius-card)] border border-[#ead9ce] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#fff2e7] text-[var(--brand-600)]"><ClipboardCheck size={16} /></span><h2 className="text-[20px] font-semibold">{copy.verification.title}</h2><span className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-[#496a9a]">{copy.verification.appendOnly}</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{copy.verification.help}</p></div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Metric label={copy.verification.verifiedTownships} value={overview.verificationCoverage.verifiedTownships} /><Metric label={copy.verification.verifiedCrops} value={overview.verificationCoverage.verifiedCrops} /><Metric label={copy.verification.openHighGaps} value={overview.verificationCoverage.openHighPriorityGaps} /><Metric label={copy.verification.v4v2} value={`${overview.verificationCoverage.currentVerifiedCount} / ${overview.verificationCoverage.localReportedCount}`} /></div>
        </div>
        {!canEdit && <p className="mt-4 rounded-lg border border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning)]">{copy.verification.viewerReadOnly}</p>}
      </header>

      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="quick-verify-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 id="quick-verify-title" className="text-[18px] font-semibold">{copy.verification.quickVerify}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.verification.quickHelp}</p></div><label className="text-xs font-semibold text-[var(--text-secondary)]">{copy.verification.township}<select value={draft.locationId} onChange={(event) => updateDraft("locationId", event.target.value)} className="mt-1 block min-h-10 min-w-[220px] rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs"><option value="">{copy.verification.selectTownship}</option>{townships.map((location) => <option key={location.locationId} value={location.locationId}>{location.canonicalName} · {agriculturePriorityLabel(priorityByTownship[location.canonicalName] ?? "LOW", language)}</option>)}</select></label></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.crops.map((crop) => { const baseline = overview.cropPresence.find((row) => row.locationId === draft.locationId && row.cropId === crop.cropId); return <article key={crop.cropId} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{agricultureCropName(crop.cropName, crop.cropCode, language)}</h4><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{copy.verification.publicBaseline}: {agriculturePresenceLabel(baseline?.presenceStatus, language)} · {baseline?.sourceName ?? copy.common.sourceNA} · {baseline?.evidenceYear ?? copy.common.yearNA}</p></div><Leaf size={16} className="text-[#47763d]" /></div><div className="mt-4 grid grid-cols-3 gap-2"><QuickButton label={agricultureAnswerLabel("YES", language)} onClick={() => quickVerify(crop.cropId, "YES")} disabled={!canEdit || saving || !draft.locationId} /><QuickButton label={agricultureAnswerLabel("NO", language)} onClick={() => quickVerify(crop.cropId, "NO")} disabled={!canEdit || saving || !draft.locationId} /><QuickButton label={agricultureAnswerLabel("UNKNOWN", language)} onClick={() => quickVerify(crop.cropId, "UNKNOWN")} disabled={!canEdit || saving || !draft.locationId} /></div><button type="button" className="mt-3 text-xs font-semibold text-[var(--brand-600)] underline-offset-2 hover:underline" onClick={() => { updateDraft("cropId", crop.cropId); setDetailsOpen(true); }}>{copy.verification.addDetails}</button></article>; })}</div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="baseline-evidence-title">
        <div className="flex items-start gap-3"><Info size={17} className="mt-0.5 shrink-0 text-[#496a9a]" /><div><h3 id="baseline-evidence-title" className="text-[18px] font-semibold">{copy.verification.baselineEvidence}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{copy.verification.selected}: {selectedLocation?.canonicalName ?? copy.verification.noTownship} · {selectedLocation?.countryName ?? copy.overview.countryNA} · {selectedCrop ? agricultureCropName(selectedCrop.cropName, selectedCrop.cropCode, language) : copy.verification.noCrop}. {copy.verification.latestPublicSourceYear}: {lastSourceYear ?? copy.common.notAvailable}.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Evidence title={copy.verification.currentLocalTruth} icon={<ClipboardCheck size={14} />} value={selectedCurrent ? `${agricultureAnswerLabel(selectedCurrent.cropPresence, language)} · ${agricultureVerificationLevelLabel(selectedCurrent.verificationLevel, language)} · ${agricultureStageLabel(selectedCurrent.currentStage, language)}` : copy.verification.noLocalReport} detail={selectedCurrent ? `${selectedCurrent.verifiedAt} · ${agricultureVerificationMethodLabel(selectedCurrent.verificationMethod, language)}` : copy.common.needsVerification} /><Evidence title={copy.verification.publicTownshipBaseline} icon={<Leaf size={14} />} value={agriculturePresenceLabel(selectedPublicPresence?.presenceStatus, language)} detail={selectedPublicPresence ? `${selectedPublicPresence.sourceName ?? selectedPublicPresence.sourceId ?? copy.common.sourceNA} · ${selectedPublicPresence.evidenceYear ?? copy.common.yearNA}` : copy.common.needsVerification} /><Evidence title={copy.verification.stateRegionActual} icon={<Info size={14} />} value={stateRows[0] ? `${stateRows[0].sownArea ?? copy.common.notAvailable} ${stateRows[0].sownAreaUnit ?? ""}` : copy.common.noData} detail={stateRows[0] ? `${stateRows[0].locationName} · ${stateRows[0].sourceName ?? stateRows[0].sourceId} · ${stateRows[0].sourceYear ?? copy.common.yearNA}` : copy.common.needsVerification} /><Evidence title={copy.verification.regionalCalendar} icon={<Info size={14} />} value={regionalCalendar.length ? regionalCalendar.map((row) => `${agricultureStageLabel(row.stageCode, language)} ${monthWindow(row.windowStartMonth, row.windowEndMonth, language)}`).join(" · ") : copy.common.noData} detail={regionalCalendar[0] ? `${regionalCalendar[0].sourceName ?? regionalCalendar[0].sourceId ?? copy.common.sourceNA} · ${regionalCalendar[0].validToYear ?? regionalCalendar[0].cropYear ?? copy.common.yearNA}` : copy.common.needsVerification} /><Evidence title={copy.verification.nationalYieldBaseline} icon={<Info size={14} />} value={nationalYield ? `${nationalYield.yieldValue} ${nationalYield.yieldUnit}` : copy.common.noData} detail={nationalYield ? `${agricultureCropName(nationalYield.cropName, nationalYield.cropCode, language)} · ${nationalYield.sourceName ?? nationalYield.sourceId} · ${nationalYield.cropYear}` : copy.common.needsVerification} /><Evidence title={copy.verification.weatherContext} icon={<CloudRain size={14} />} value={selectedWeather ? `${selectedWeather.temperature}°C · ${weatherRiskShortLabel(selectedWeather.riskLevel, language)}` : copy.overview.noCurrentWeather} detail={selectedWeather ? `${overview.weather.source ?? copy.common.sourceNA} · ${weatherConditionLabel(selectedWeather.condition, language)}` : copy.common.needsVerification} /><Evidence title={copy.verification.historicalHazards} icon={<ShieldAlert size={14} />} value={hazards.length ? hazards.map((row) => `${agricultureHazardLabel(row.hazardType, language)} ${row.eventYear ?? copy.common.yearNA}`).join(" · ") : copy.common.noData} detail={hazards[0]?.sourceName ?? copy.verification.historicalOnly} /></div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-[18px] font-semibold">{copy.verification.detailedVerification}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.verification.fieldsUnknown}</p></div><button type="button" onClick={() => setDetailsOpen((open) => !open)} className="min-h-10 rounded-lg border border-[var(--border-default)] px-3 text-xs font-semibold">{detailsOpen ? copy.verification.hideForm : copy.verification.openForm}</button></div>
        {detailsOpen && <form className="mt-5 space-y-5" onSubmit={(event) => void submitDetails(event)}><div className="grid gap-3 sm:grid-cols-2"><Field label={copy.verification.township}><select value={draft.locationId} onChange={(event) => updateDraft("locationId", event.target.value)} className={inputClass}><option value="">{copy.verification.selectTownship}</option>{townships.map((location) => <option key={location.locationId} value={location.locationId}>{location.canonicalName}</option>)}</select></Field><Field label={copy.verification.crop}><select value={draft.cropId} onChange={(event) => updateDraft("cropId", event.target.value)} className={inputClass}><option value="">{localizedText(language, "เลือกชนิดพืช", "Select crop")}</option>{overview.crops.map((crop) => <option key={crop.cropId} value={crop.cropId}>{agricultureCropName(crop.cropName, crop.cropCode, language)}</option>)}</select></Field></div><div className="grid gap-3 sm:grid-cols-3"><Field label={copy.verification.cropPresence}><select value={draft.cropPresence} onChange={(event) => updateDraft("cropPresence", event.target.value as Draft["cropPresence"])} className={inputClass}><option value="YES">{agricultureAnswerLabel("YES", language)}</option><option value="NO">{agricultureAnswerLabel("NO", language)}</option><option value="UNKNOWN">{agricultureAnswerLabel("UNKNOWN", language)}</option></select></Field><Field label={copy.verification.importance}><select value={draft.importance} onChange={(event) => updateDraft("importance", event.target.value as Draft["importance"])} className={inputClass}><option value="MAJOR">{agricultureImportanceLabel("MAJOR", language)}</option><option value="SECONDARY">{agricultureImportanceLabel("SECONDARY", language)}</option><option value="MINOR">{agricultureImportanceLabel("MINOR", language)}</option><option value="UNKNOWN">{agricultureImportanceLabel("UNKNOWN", language)}</option></select></Field><Field label={copy.verification.verificationLevel}><select value={draft.verificationLevel} onChange={(event) => updateDraft("verificationLevel", event.target.value as Draft["verificationLevel"])} className={inputClass}><option value="V2">{agricultureVerificationLevelLabel("V2", language)}</option><option value="V3">{agricultureVerificationLevelLabel("V3", language)}</option><option value="V4">{agricultureVerificationLevelLabel("V4", language)}</option></select></Field></div><div className="grid gap-3 sm:grid-cols-3"><Field label={copy.verification.estimatedArea}><input type="number" min="0" step="any" value={draft.estimatedArea} onChange={(event) => updateDraft("estimatedArea", event.target.value)} className={inputClass} placeholder={copy.common.unknown} /></Field><Field label={copy.verification.areaUnit}><input value={draft.areaUnit} onChange={(event) => updateDraft("areaUnit", event.target.value)} className={inputClass} placeholder={localizedText(language, "Acre / hectare / ยังไม่มีข้อมูลยืนยัน", "Acre / hectare / Unknown")} /></Field><Field label={copy.verification.areaQuality}><select value={draft.areaQuality} onChange={(event) => updateDraft("areaQuality", event.target.value as Draft["areaQuality"])} className={inputClass}><option value="KNOWN">{agricultureAreaQualityLabel("KNOWN", language)}</option><option value="APPROXIMATE">{agricultureAreaQualityLabel("APPROXIMATE", language)}</option><option value="UNKNOWN">{agricultureAreaQualityLabel("UNKNOWN", language)}</option></select></Field></div><div className="grid gap-3 sm:grid-cols-2"><MonthField label={copy.verification.plantingStart} value={draft.plantingStartMonth} onChange={(value) => updateDraft("plantingStartMonth", value)} language={language} /><MonthField label={copy.verification.plantingEnd} value={draft.plantingEndMonth} onChange={(value) => updateDraft("plantingEndMonth", value)} language={language} /><MonthField label={copy.verification.harvestStart} value={draft.harvestStartMonth} onChange={(value) => updateDraft("harvestStartMonth", value)} language={language} /><MonthField label={copy.verification.harvestEnd} value={draft.harvestEndMonth} onChange={(value) => updateDraft("harvestEndMonth", value)} language={language} /></div><Field label={copy.overview.currentStage}><select value={draft.currentStage} onChange={(event) => updateDraft("currentStage", event.target.value)} className={inputClass}><option value="">{agricultureStageLabel("UNKNOWN", language)}</option>{selectedStageOptions.map((stage) => <option key={stage.stageCode} value={stage.stageCode}>{agricultureStageLabel(stage.stageCode, language, stage.stageName)} · {stage.stageCode}</option>)}</select><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{copy.verification.canonicalStageHelp}</p></Field><div className="grid gap-3 sm:grid-cols-2"><Field label={copy.verification.irrigation}><select value={draft.irrigationType} onChange={(event) => updateDraft("irrigationType", event.target.value as Draft["irrigationType"])} className={inputClass}><option value="RAIN_FED">{agricultureIrrigationLabel("RAIN_FED", language)}</option><option value="IRRIGATED">{agricultureIrrigationLabel("IRRIGATED", language)}</option><option value="MIXED">{agricultureIrrigationLabel("MIXED", language)}</option><option value="UNKNOWN">{agricultureIrrigationLabel("UNKNOWN", language)}</option></select></Field><Field label={copy.verification.mechanization}><select value={draft.mechanizationLevel} onChange={(event) => updateDraft("mechanizationLevel", event.target.value as Draft["mechanizationLevel"])} className={inputClass}><option value="LOW">{agricultureMechanizationLabel("LOW", language)}</option><option value="MEDIUM">{agricultureMechanizationLabel("MEDIUM", language)}</option><option value="HIGH">{agricultureMechanizationLabel("HIGH", language)}</option><option value="UNKNOWN">{agricultureMechanizationLabel("UNKNOWN", language)}</option></select></Field></div><Field label={copy.verification.commonMachines}><input value={draft.commonMachines} onChange={(event) => updateDraft("commonMachines", event.target.value)} className={inputClass} placeholder={copy.verification.machinesPlaceholder} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label={copy.verification.verificationMethod}><select value={draft.verificationMethod} onChange={(event) => updateDraft("verificationMethod", event.target.value as Draft["verificationMethod"])} className={inputClass}><option value="FIELD_VISIT">{agricultureVerificationMethodLabel("FIELD_VISIT", language)}</option><option value="BRANCH_REPORT">{agricultureVerificationMethodLabel("BRANCH_REPORT", language)}</option><option value="SALESPERSON_REPORT">{agricultureVerificationMethodLabel("SALESPERSON_REPORT", language)}</option><option value="CUSTOMER_REPORT">{agricultureVerificationMethodLabel("CUSTOMER_REPORT", language)}</option><option value="MANAGER_CONFIRMATION">{agricultureVerificationMethodLabel("MANAGER_CONFIRMATION", language)}</option><option value="OTHER">{agricultureVerificationMethodLabel("OTHER", language)}</option></select></Field><Field label={copy.verification.notes}><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} className={cn(inputClass, "min-h-20 py-2")} placeholder={copy.verification.notesPlaceholder} /></Field></div><button type="submit" disabled={!canEdit || saving || !draft.locationId || !draft.cropId} className="min-h-11 rounded-lg bg-[var(--brand-500)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? copy.common.saving : copy.common.save}</button></form>}
      </section>

      {(message || error) && <p role="status" className={cn("rounded-lg p-3 text-xs", error ? "border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "border border-[var(--status-success-bg)] bg-[var(--status-success-bg)] text-[var(--status-success)]")}>{error || message}</p>}

      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-[18px] font-semibold">{copy.verification.history}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.verification.historyHelp}</p></div><span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">{overview.fieldVerifications.length || copy.common.noData}</span></div>{overview.fieldVerifications.length ? <div className="mt-4 space-y-2">{overview.fieldVerifications.slice(0, 30).map((row) => { const publicRow = overview.cropPresence.find((presence) => presence.locationId === row.locationId && presence.cropId === row.cropId); const conflict = publicRow && ((row.cropPresence === "YES" && publicRow.presenceStatus === "CONFIRMED_ABSENT") || (row.cropPresence === "NO" && ["CONFIRMED_PRESENT", "PROBABLE"].includes(publicRow.presenceStatus))); return <article key={row.verificationId} className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 text-xs"><div className="flex flex-wrap items-center gap-2"><strong>{row.locationName} · {row.cropName ? agricultureCropName(row.cropName, row.cropCode, language) : copy.common.cropNA}</strong><span className="rounded-full bg-[#eef4fb] px-2 py-1 text-[10px] font-bold text-[#496a9a]">{agricultureVerificationLevelLabel(row.verificationLevel, language)}</span><span className="rounded-full bg-[var(--surface-default)] px-2 py-1 text-[10px]">{agricultureVerificationStatusLabel(row.status, language)}</span>{conflict && <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--status-warning)]">{copy.verification.conflictPublicPreserved}</span>}</div><p className="mt-2 text-[var(--text-secondary)]">{copy.verification.cropPresence}: {agricultureAnswerLabel(row.cropPresence, language)} · {copy.overview.currentStage}: {agricultureStageLabel(row.currentStage, language)} · {agricultureVerificationMethodLabel(row.verificationMethod, language)} · {row.verifiedAt}</p>{row.notes && <p className="mt-1 text-[var(--text-tertiary)]">{row.notes}</p>}{canEdit && row.status === "PENDING" && <button type="button" onClick={() => void approve(row)} disabled={saving} className="mt-2 rounded-md border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-[10px] font-semibold">{copy.verification.approveAt} {agricultureVerificationLevelLabel(row.verificationLevel, language)}</button>}</article>; })}</div> : <p className="mt-4 rounded-lg border border-dashed border-[var(--border-default)] p-4 text-xs text-[var(--text-tertiary)]">{copy.verification.noLocalReports}</p>}</section>
    </section>
  );
}

function emptyDraft(locationId: string, cropId: string): Draft {
  return { locationId, cropId, cropPresence: "UNKNOWN", importance: "UNKNOWN", estimatedArea: "", areaUnit: "", areaQuality: "UNKNOWN", plantingStartMonth: "", plantingEndMonth: "", harvestStartMonth: "", harvestEndMonth: "", currentStage: "", irrigationType: "UNKNOWN", mechanizationLevel: "UNKNOWN", commonMachines: "", verificationMethod: "BRANCH_REPORT", verificationLevel: "V2", notes: "" };
}

function monthValue(value: string) {
  return value ? Number(value) : null;
}

function latestYear(values: Array<number | null>) {
  const years = values.filter((value): value is number => typeof value === "number" && Number.isInteger(value));
  return years.length ? Math.max(...years) : null;
}

function monthWindow(start: number | null, end: number | null, language: import("../../../src/locales").Language) {
  if (!start && !end) return localizedText(language, "ไม่ระบุช่วงเดือน", "window N/A");
  const monthNames = language === "th" ? monthsThai : months;
  return `${monthNames[(start ?? end ?? 1) - 1]}–${monthNames[(end ?? start ?? 1) - 1]}`;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  return <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2"><p className="text-[10px] text-[var(--text-tertiary)]">{label}</p><p className="mt-1 text-sm font-semibold">{value || copy.common.noData}</p></div>;
}

function Evidence({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3"><div className="flex items-center gap-2 text-[var(--text-tertiary)]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.08em]">{title}</span></div><p className="mt-2 text-xs font-semibold">{value}</p><p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">{detail}</p></article>;
}

function QuickButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="min-h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-[10px] font-bold text-[var(--text-secondary)] hover:border-[var(--brand-400)] disabled:cursor-not-allowed disabled:opacity-50">{label}</button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-[var(--text-secondary)]">{label}{children}</label>;
}

function MonthField({ label, value, onChange, language }: { label: string; value: string; onChange: (value: string) => void; language: import("../../../src/locales").Language }) {
  const copy = agricultureCopy(language);
  const monthNames = language === "th" ? monthsThai : months;
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">{copy.common.unknown}</option>{monthNames.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}</select></Field>;
}

const inputClass = "mt-1 min-h-10 w-full rounded-lg border border-[var(--border-default)] bg-white px-3 text-xs font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";
