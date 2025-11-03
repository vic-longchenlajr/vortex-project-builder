// src/core/calc/engineered/index.ts
import {
  Project,
  System,
  Zone,
  Enclosure,
  StatusInput,
  EngineeredEstimates,
} from "@/state/app-model";
import { emitterConfigMap } from "@/core/catalog/emitter.catalog";

import {
  selectWaterTankStrict,
  maxCapacityForCert,
  prettyCert,
  WaterTankCert,
} from "@/core/catalog/water_tanks.catalog";

type Num = number;

const T_STD_K = 294.4;
const SAFETY_FACTOR = 1.2;
const FT3_PER_M3 = 35.3147;

const FLOODING_FACTOR: Record<Enclosure["method"], Num> = {
  "NFPA 770 Class A/C": 0.375,
  "NFPA 770 Class B": 0.375,
  "FM Data Centers": 0.375,
  "FM Turbines": 0.375,
  "FM Machine Spaces": 0.375,
};

export const ACF_BY_ELEVATION: Record<string, Num> = {
  "-3000FT/-0.92KM": 1.11,
  "-2000FT/-0.61KM": 1.07,
  "-1000FT/-0.30KM": 1.04,
  "0FT/0KM": 1.0,
  "1000FT/0.30KM": 0.96,
  "2000FT/0.61KM": 0.93,
  "3000FT/0.91KM": 0.89,
  "4000FT/1.22KM": 0.86,
  "5000FT/1.52KM": 0.82,
  "6000FT/1.83KM": 0.78,
  "7000FT/2.13KM": 0.75,
  "8000FT/2.45KM": 0.72,
  "9000FT/2.74KM": 0.69,
  "10000FT/3.05KM": 0.66,
};
export const CYL_CAP_DEFAULT: Record<string, { usable: Num; total: Num }> = {
  "3000 PSI/206.8 BAR": { usable: 498, total: 549 },
  "2900 PSI/199.9 BAR": { usable: 479, total: 530 },
  "2800 PSI/193.1 BAR": { usable: 468, total: 519 },
  "2700 PSI/186.2 BAR": { usable: 450, total: 501 },
  "2640 PSI/182.0 BAR": { usable: 439, total: 490 },
  "2600 PSI/179.3 BAR": { usable: 423, total: 474 },
  "2500 PSI/172.4 BAR": { usable: 413, total: 464 },
  "2400 PSI/165.5 BAR": { usable: 400, total: 451 },
  "2300 PSI/158.6 BAR": { usable: 381, total: 432 },
  "2200 PSI/151.7 BAR": { usable: 367, total: 418 },
  "2100 PSI/144.8 BAR": { usable: 348, total: 399 },
};

export const CYL_CAP_FMTMS: Record<string, { usable: Num; total: Num }> = {
  "3000 PSI/206.8 BAR": { usable: 534, total: 549 },
  "2900 PSI/199.9 BAR": { usable: 515, total: 530 },
  "2800 PSI/193.1 BAR": { usable: 504, total: 519 },
  "2700 PSI/186.2 BAR": { usable: 486, total: 501 },
  "2640 PSI/182.0 BAR": { usable: 475, total: 490 },
  "2600 PSI/179.3 BAR": { usable: 459, total: 474 },
  "2500 PSI/172.4 BAR": { usable: 449, total: 464 },
  "2400 PSI/165.5 BAR": { usable: 436, total: 451 },
  "2300 PSI/158.6 BAR": { usable: 418, total: 432 },
  "2200 PSI/151.7 BAR": { usable: 403, total: 418 },
  "2100 PSI/144.8 BAR": { usable: 384, total: 399 },
};

const GAL_PER_LITER = 0.264172;
function pipeVolumeToGallons(
  project: Project,
  v: number | undefined | null
): number {
  const n = Number(v) || 0;
  return project.units === "metric" ? n * GAL_PER_LITER : n; // assume UI shows L in metric, gal in US
}

const clampInt = (n: any, min = 0) =>
  Math.max(min, Math.floor(Number.isFinite(+n) ? +n : 0));

const hasCustomEmitters = (e: Enclosure) =>
  !!(e as any)._editEmitters && (e as any).customMinEmitters != null;

const getCustomEmitters = (e: Enclosure) =>
  clampInt((e as any).customMinEmitters, 0);

const hasCustomCyl = (z: Zone) =>
  !!(z as any)._editCylinders && (z as any).customMinTotalCylinders != null;

const getCustomCyl = (z: Zone) =>
  clampInt((z as any).customMinTotalCylinders, 0);

export function calculateEngineered(p: Project): {
  project: Project;
  messages: StatusInput[];
} {
  const messages: StatusInput[] = [];
  const systems = p.systems.map((sys) =>
    sys.type === "engineered" ? calcSystem(p, sys, messages) : sys
  );
  return { project: { ...p, systems }, messages };
}

function calcSystem(
  project: Project,
  sys: System,
  messages: StatusInput[]
): System {
  // 1) Calculate zones first (so we can aggregate panel qty & cylinders)
  const zones = sys.zones.map((z) => calcZone(project, sys, z, messages));

  // ── WATER TANK SELECTION (system-level) ─────────────────────
  const zoneNeeds = zones
    .map((z) => Number((z as any).waterTankMin_gal) || 0)
    .filter((g) => g > 0);

  const maxReqGal = zoneNeeds.length ? Math.max(...zoneNeeds) : 0;

  // Read exact certification from System Options (fall back by currency)
  const optsAny = { ...(sys.options as any) };
  const defaultCert: WaterTankCert =
    project.currency === "USD" ? "US_ASME_FM" : "CE_SS316L";
  const cert: WaterTankCert = optsAny.waterTankCertification ?? defaultCert;

  let pickCodes: [string, string] | null = null;
  let pickDesc: string | null = null;

  if (maxReqGal > 0) {
    const chosen = selectWaterTankStrict(cert, maxReqGal);
    if (chosen) {
      pickCodes = chosen.codes;
      pickDesc = chosen.description;
    } else {
      const maxAvail = maxCapacityForCert(cert);
      messages.push({
        severity: "warn",
        code: "SYS.TANK_CAPACITY",
        text:
          `Required water tank capacity (${Math.ceil(
            maxReqGal
          )} gal) exceeds the ` +
          `maximum available for "${prettyCert(cert)}" (${Math.ceil(
            maxAvail
          )} gal). ` +
          `Please supply a water tank rated for at least ${Math.ceil(
            maxReqGal
          )} gallons.`,
        systemId: sys.id,
      });
    }
  }

  // Persist strict selection / requirement for BOM
  optsAny.waterTankRequired_gal = maxReqGal;
  optsAny.waterTankCertification = cert;
  optsAny.waterTankPick = pickCodes
    ? { codes: pickCodes, description: pickDesc, cert }
    : null;

  // ── NEW: ENGINEERED ESTIMATES (system-level) ─────────────────
  // Based on cylinders and total panel quantity (summed across zones)

  // Max cylinders across zones — already used for ordering
  const maxCylAcrossZones = Math.max(
    0,
    ...zones.map((z) => Number(z.minTotalCylinders || 0))
  );
  // Bulk Tubes eligibility: expose only if max cylinders > 40
  const bulkEligible = true;

  // Persist a UI flag (not user-editable) so the panel can show/hide the checkbox
  optsAny.bulkTubesEligible = bulkEligible;

  // If selected, we must:
  // - set system cylinder count to 0 (reflect via zone fields)
  // - set primaries / double-stacked / adjacent hoses to 0
  const bulkSelected = !!optsAny.bulkTubes;
  const zonesForOutput = bulkSelected
    ? zones.map((z) => ({ ...z, minTotalCylinders: 0 }))
    : zones;

  // Use zonesForOutput from now on
  const zonesUsed = zonesForOutput;

  // Recompute totals that depend on zones
  const totalPanelQty = zonesUsed.reduce((s, z) => {
    const ps = (z as any).panelSizing as { qty: number } | undefined;
    return s + (ps?.qty ?? 0);
  }, 0);

  const style: "ar" | "dc" = (
    (sys.options as any).panelStyle === "dc" ? "dc" : "ar"
  ) as "ar" | "dc";

  // Base computed values (before bulk override)
  const primaryReleaseAssembliesComputed =
    estimatePrimaryReleaseAssembliesFromZones(
      zonesUsed,
      bulkSelected ? 0 : maxCylAcrossZones
    );
  const adjacentRackHoseComputed = estimateAdjacentRackHosesFromZones(
    bulkSelected ? 0 : maxCylAcrossZones
  );
  const doubleStackedRackHoseComputed = estimateDoubleStackedRackHoseFromZones(
    bulkSelected ? 0 : maxCylAcrossZones
  );
  const batteryBackupsComputed = Math.ceil((totalPanelQty || 0) / 2);

  // Points (rules already consider panelStyle + bulk where needed)
  // ── FACP points (component-driven) ──────────────────────────
  const facp = estimateFacpTotalsFromDesign({ ...sys, zones: zonesUsed });
  const releasePointsComputed = facp.releasing;
  const monitorPointsComputed = facp.supervisory + facp.alarm;

  // Respect editValues (same helper you already added)
  const editValues = !!optsAny.editValues;
  const prevEst = (optsAny.estimates ?? {}) as Partial<EngineeredEstimates>;

  // Apply bulk-selected overrides
  const primariesCalc = bulkSelected ? 0 : primaryReleaseAssembliesComputed;
  const adjHoseCalc = bulkSelected ? 0 : adjacentRackHoseComputed;
  const dblHoseCalc = bulkSelected ? 0 : doubleStackedRackHoseComputed;

  const primaryReleaseAssemblies = persistEditable(
    prevEst.primaryReleaseAssemblies,
    primariesCalc,
    editValues
  );
  const adjacentRackHose = persistEditable(
    prevEst.adjacentRackHose,
    adjHoseCalc,
    editValues
  );
  const doubleStackedRackHose = persistEditable(
    prevEst.doubleStackedRackHose,
    dblHoseCalc,
    editValues
  );
  const batteryBackups = persistEditable(
    prevEst.batteryBackups,
    batteryBackupsComputed,
    editValues
  );
  const releasePoints = persistEditable(
    prevEst.releasePoints,
    releasePointsComputed,
    editValues
  );
  const monitorPoints = persistEditable(
    prevEst.monitorPoints,
    monitorPointsComputed,
    editValues
  );

  optsAny.estimates = {
    primaryReleaseAssemblies,
    adjacentRackHose,
    doubleStackedRackHose,
    batteryBackups,
    releasePoints,
    monitorPoints,
  };

  // Return with zonesUsed (so cylinder count shows 0 when bulk selected)
  return { ...sys, zones: zonesUsed, options: optsAny as any };
}

function calcZone(
  project: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const encs = zone.enclosures ?? [];
  if (encs.length === 0) return zone;

  const acf = ACF_BY_ELEVATION[project.elevation] ?? 1.0;

  type RowOut = {
    enc: Enclosure;
    Vreq_scf: number;
    emitters: number;
    qNoz: number; // nitrogen SCFM / nozzle
    qWaterNoz: number; // WATER: GPM / nozzle
    qTotal: number; // nitrogen SCFM / enclosure
    qWaterTotal: number; // WATER: GPM / enclosure
    T_K: number;
    V_ft3: number;
  };

  const rows: RowOut[] = encs.map((e) => {
    const method = e.method;
    const T_K = round3(tempToKelvin(project, Number(e.tempF) || 70));
    const tCorr = round3(T_STD_K / T_K);
    const V_ft3 = volToFt3(project, Number(e.volume) || 0);

    let emitters = 0;
    let qNoz = getNozzleFlowSCFM(e); // N2 / nozzle
    let qWaterNoz = getNozzleWaterGPM(e); // WATER / nozzle
    let Vreq_scf = 0;

    if (method === "FM Turbines" || method === "FM Machine Spaces") {
      if (!qNoz) qNoz = 150; // conservative default if catalog absent
      if (!qWaterNoz) qWaterNoz = 1.06;

      emitters = Math.max(0, estimateFMTMSEmitters(project, e));
      const t_design =
        method === "FM Turbines"
          ? 10 + ((sys.options as any).rundownTimeMin || 0)
          : 10;

      Vreq_scf = emitters * qNoz * t_design;
    } else {
      const ff = FLOODING_FACTOR[method] ?? 0.375;
      Vreq_scf = V_ft3 * tCorr * acf * ff * SAFETY_FACTOR;
      emitters = 0;
    }

    return {
      enc: e,
      Vreq_scf,
      emitters,
      qNoz,
      qWaterNoz,
      qTotal: 0,
      qWaterTotal: 0,
      T_K,
      V_ft3,
    };
  });

  const anyMethod = encs[0].method;
  const caps = getCylinderCaps(anyMethod, (sys.options as any).fillPressure);
  const W_zone_req = rows.reduce((s, r) => s + r.Vreq_scf, 0);
  const minCylBase = Math.max(0, Math.ceil(W_zone_req / caps.total));
  const minCylEff = hasCustomCyl(zone) ? getCustomCyl(zone) : minCylBase;

  // Warn if user override is used
  if (hasCustomCyl(zone)) {
    messages.push({
      severity: "warn",
      code: "ZONE.CUSTOM_CYLINDERS",
      text: `Custom cylinder count modified from ${minCylEff} (recommended: ${minCylBase}).`,
      systemId: sys.id,
      zoneId: zone.id,
    });
  }

  const t_design_zone =
    anyMethod === "FM Turbines"
      ? 10 + ((sys.options as any).rundownTimeMin || 0)
      : anyMethod === "FM Machine Spaces"
        ? 10
        : anyMethod === "FM Data Centers"
          ? 3.5
          : (sys.options as any).rundownTimeMin &&
              (sys.options as any).rundownTimeMin > 0
            ? (sys.options as any).rundownTimeMin
            : 3;

  const totalVolFt3 = encs.reduce(
    (s, e) => s + volToFt3(project, Number(e.volume) || 0),
    0
  );

  const rowsSized = rows.map((r) => {
    // Start with the computed emitters from earlier logic
    let emittersComputed = r.emitters;

    // If this enclosure is not FM-Turbines/MachineSpaces (where we estimated emitters directly),
    // we calculated emitters from Q_req later; preserve that behavior BUT allow a user override.
    const isFM_TMS =
      r.enc.method === "FM Turbines" || r.enc.method === "FM Machine Spaces";

    let emittersFinal: number;

    if (hasCustomEmitters(r.enc)) {
      emittersFinal = getCustomEmitters(r.enc);
      // One warning per edited enclosure
      messages.push({
        severity: "warn",
        code: "ENC.CUSTOM_EMITTERS",
        text: `Custom emitters used for "${r.enc.name || "Enclosure"}": ${emittersFinal}${
          emittersComputed ? ` (calc: ${emittersComputed})` : ""
        }.`,
        systemId: sys.id,
        zoneId: zone.id,
        enclosureId: r.enc.id,
      });
    } else if (isFM_TMS) {
      // We already computed emitters for FM T/MS above
      emittersFinal = clampInt(emittersComputed, 0);
    } else {
      // Flow balancing path (non-FM-T/MS): compute emitters from Q_req
      const EF = totalVolFt3 > 0 ? r.V_ft3 / totalVolFt3 : 0;
      const Q_req = ((minCylEff * caps.usable) / (t_design_zone || 1)) * EF; // zoneFlowCapacitySCFM * EF

      const isFMDC = r.enc.method === "FM Data Centers";
      const emittersRaw = r.qNoz > 0 ? Q_req / r.qNoz : 0;
      emittersFinal = isFMDC ? Math.floor(emittersRaw) : Math.ceil(emittersRaw);
      emittersFinal = clampInt(emittersFinal, 0);
    }

    const qTotal = emittersFinal * (r.qNoz || 0);
    const qWaterTotal = emittersFinal * (r.qWaterNoz || 0);

    return { ...r, emitters: emittersFinal, qTotal, qWaterTotal };
  });

  // Sum of enclosure flow rates (nozzles × per-nozzle q_n2) — this drives panel sizing
  const zoneTotalFlowSCFM = rowsSized.reduce((s, r) => s + r.qTotal, 0);
  const t_actual =
    zoneTotalFlowSCFM > 0 ? (minCylEff * caps.usable) / zoneTotalFlowSCFM : 0;
  const zoneTotalNitrogenSCF_Total = minCylEff * caps.total;

  if (anyMethod === "FM Data Centers" && t_actual > 0 && t_actual < 3.5) {
    messages.push({
      severity: "error",
      code: "ENC.FMDC_MIN_DISCHARGE",
      text: `FM Data Centers minimum discharge time is 3.5 minutes (actual: ${round2(
        t_actual
      )}).`,
      systemId: sys.id,
      zoneId: zone.id,
    });
  }

  // WATER: per-enclosure water quantity
  const isFMTMS =
    anyMethod === "FM Turbines" || anyMethod === "FM Machine Spaces";
  const timeForWater = isFMTMS ? t_design_zone : t_actual;

  let zoneWaterPeakGPM = 0;
  let zoneWaterDischargeGal = 0;

  const encsOut: Enclosure[] = rowsSized.map((r) => {
    const prop = zoneTotalFlowSCFM > 0 ? r.qTotal / zoneTotalFlowSCFM : 0;
    const Vn2_forO2 = prop * zoneTotalNitrogenSCF_Total;

    const o2 = computeO2Percent({
      Vn2_scf: Vn2_forO2,
      Venc_ft3: r.V_ft3,
      T_K: r.T_K,
      acf,
    });

    zoneWaterPeakGPM += r.qWaterTotal;
    const wWaterEncGal = r.qWaterTotal * (timeForWater || 0);
    zoneWaterDischargeGal += wWaterEncGal;

    const isFM_TMS =
      r.enc.method === "FM Turbines" || r.enc.method === "FM Machine Spaces";

    const extra: any = {
      qWater_gpm: round3(r.qWaterNoz || 0),
      qWaterTotal_gpm: round3(r.qWaterTotal || 0),
      estWater_gal: round2(wWaterEncGal),
    };

    return {
      ...r.enc,
      minEmitters: r.emitters,
      estDischarge: isFM_TMS
        ? `${t_design_zone} min`
        : `${round2(t_actual)} min`,
      estFinalO2: Number.isFinite(o2) && o2 > 0 ? `${round2(o2)} %` : "—",
      ...extra,
    } as Enclosure;
  });

  // WATER: zone tank capacity with pipe volume + safety factor
  const pipeVolGal = pipeVolumeToGallons(
    project,
    (sys.options as any).estimatedPipeVolume
  );
  const zoneTankMinGal = (zoneWaterDischargeGal + pipeVolGal) * SAFETY_FACTOR;

  // ── NEW: Panel sizing + design label (zone-level) ───────────
  // Flow rule:
  //  - if sum(enclosure flow) ≤ 1800 SCFM → 1" panel (capacity 1800)
  //  - otherwise → 1.5" panel (capacity 4500), qty = ceil(flow / 4500)
  const rawFlow = Math.max(0, zoneTotalFlowSCFM);
  const bore: "1in" | "1.5in" = rawFlow <= 1800 ? "1in" : "1.5in";
  const capacity = bore === "1in" ? 1800 : 4500;
  const qty = rawFlow > 0 ? Math.ceil(rawFlow / capacity) : 0;
  const style: "ar" | "dc" = (
    (sys.options as any).panelStyle === "dc" ? "dc" : "ar"
  ) as "ar" | "dc";

  const methodsInZone = new Set(encs.map((e) => e.method));
  let designLabel: "data_proc" | "comb_turb" | "spec_hazards";
  if (methodsInZone.size === 1 && methodsInZone.has("FM Data Centers")) {
    designLabel = "data_proc";
  } else if (
    methodsInZone.has("FM Turbines") ||
    methodsInZone.has("FM Machine Spaces")
  ) {
    designLabel = "comb_turb";
  } else {
    designLabel = "spec_hazards"; // NFPA 770 (A/C or B), or mixed A/C+B
  }

  // Return zone with exposed values for UI/BOM
  return {
    ...zone,
    enclosures: encsOut,
    totalNitrogen:
      W_zone_req > 0 ? `${Math.round(W_zone_req).toLocaleString()} SCF` : "—",
    minTotalCylinders: minCylEff,

    // Expose for UI/BOM
    q_n2_peak_scfm: round2(zoneTotalFlowSCFM) as any,
    water_peak_gpm: round2(zoneWaterPeakGPM) as any,
    waterDischarge_gal: round2(zoneWaterDischargeGal) as any,
    waterTankMin_gal: round2(zoneTankMinGal) as any,

    // NEW: attach panel sizing + label
    ...({
      panelSizing: { bore, capacity, qty, style },
      designLabel,
    } as any),
  };
}
/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */
const round3 = (n: number) => Math.ceil((n + Number.EPSILON) * 1000) / 1000;
const round2 = (n: number) => Math.ceil((n + Number.EPSILON) * 100) / 100;

export function volToFt3(project: Project, vol: number): number {
  return project.units === "metric" ? vol * FT3_PER_M3 : vol;
}
export function tempToKelvin(project: Project, tInput: number): number {
  return project.units === "metric"
    ? tInput + 273.15
    : (tInput - 32) * (5 / 9) + 273.15;
}
function getCylinderCaps(method: Enclosure["method"], fill: string) {
  const isFMTMS = method === "FM Turbines" || method === "FM Machine Spaces";
  const table = isFMTMS ? CYL_CAP_FMTMS : CYL_CAP_DEFAULT;
  return table[fill] ?? table["3000 PSI/206.8 BAR"];
}

function estimateFMTMSEmitters(project: Project, enc: Enclosure): number {
  const vol_ft3 = volToFt3(project, Number(enc.volume) || 0);
  const vol_m3 =
    project.units === "metric" ? Number(enc.volume) || 0 : vol_ft3 / FT3_PER_M3;
  const isMetric = project.units === "metric";

  const lowVol = isMetric ? 580 : 20485;
  const highVol = isMetric ? 3600 : 127525;
  const lowFactor = isMetric ? 65 : 2295;
  const highFactor = isMetric ? 73.4 : 2592;

  const V = isMetric ? vol_m3 : vol_ft3;
  if (V <= 0) return 0;
  if (V <= lowVol) return Math.ceil(V / lowFactor);
  if (V <= highVol) return Math.ceil(1.2 * (V / highFactor));
  return Math.max(1, Math.ceil(V / highFactor));
}

export function getNozzleFlowSCFM(enc: Enclosure): number {
  try {
    const methodMap = (emitterConfigMap as any)[enc.method];
    const nozzle = enc.nozzleCode ? methodMap?.[enc.nozzleCode] : undefined;
    const q = nozzle?.q_n2;
    return typeof q === "number" && q > 0 ? q : 0;
  } catch {
    return 0;
  }
}

// WATER: pull water flow (GPM) per nozzle from catalog
export function getNozzleWaterGPM(enc: Enclosure): number {
  try {
    const methodMap = (emitterConfigMap as any)[enc.method];
    const nozzle = enc.nozzleCode ? methodMap?.[enc.nozzleCode] : undefined;
    const q = nozzle?.q_water;
    return typeof q === "number" && q > 0 ? q : 0;
  } catch {
    return 0;
  }
}

export function computeO2Percent({
  Vn2_scf,
  Venc_ft3,
  T_K,
  acf,
}: {
  Vn2_scf: number;
  Venc_ft3: number;
  T_K: number;
  acf: number;
}): number {
  if (Vn2_scf <= 0 || Venc_ft3 <= 0 || T_K <= 0 || acf <= 0) return NaN;
  const exponent = -((Vn2_scf * T_K) / (Venc_ft3 * acf * T_STD_K));
  return 20.95 * Math.exp(exponent);
}

function estimatePrimaryReleaseAssembliesFromZones(
  zones: Zone[],
  maxCylAcrossZones: number
): number {
  if (!maxCylAcrossZones || maxCylAcrossZones <= 0) return 0;

  // Per-zone totals (current model: zone.minTotalCylinders is your cylinder count per zone)
  const totals = zones
    .map((z) => Number(z.minTotalCylinders || 0))
    .filter((n) => n > 0);

  if (totals.length === 0) return 0;

  // Distinct per-zone totals
  const uniqueCounts = Array.from(new Set(totals));

  // If only one zone has cylinders: ~1 primary per 24 cylinders
  if (totals.length === 1) {
    return Math.ceil(maxCylAcrossZones / 24);
  }

  if (maxCylAcrossZones <= 24) {
    switch (uniqueCounts.length) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 3:
        return 3;
      default:
        return 4;
    }
  } else if (maxCylAcrossZones <= 48) {
    switch (uniqueCounts.length) {
      case 1:
        return 2;
      case 2:
        return 3;
      default:
        return 4;
    }
  } else if (maxCylAcrossZones <= 72) {
    return uniqueCounts.length === 1 ? 3 : 4;
  }

  // 73+ cylinders → one primary per 24 cylinders (rounded up)
  return Math.ceil(maxCylAcrossZones / 24);
}

function estimateAdjacentRackHosesFromZones(maxCylAcrossZones: number) {
  if (maxCylAcrossZones <= 12) {
    return 0;
  } else {
    return Math.ceil(2 * (maxCylAcrossZones / 24));
  }
}

function estimateDoubleStackedRackHoseFromZones(maxCylAcrossZones: number) {
  if (maxCylAcrossZones == 1) {
    return 0;
  } else if (maxCylAcrossZones < 24 && maxCylAcrossZones > 1) {
    return 1;
  } else {
    return Math.ceil(maxCylAcrossZones / 24);
  }
}

/** Use the user value when editValues=true; otherwise use computed.
 * If edit=true but user hasn't provided a valid value, fall back to computed.
 */
function persistEditable(
  userValue: unknown,
  computed: number,
  edit: boolean
): number {
  const n =
    typeof userValue === "number" && Number.isFinite(userValue)
      ? userValue
      : null;
  return edit ? (n ?? computed) : computed;
}

type FacpTotals = { supervisory: number; alarm: number; releasing: number };

/** Component-driven FACP point estimator for Engineered systems. */
function estimateFacpTotalsFromDesign(sys: System): FacpTotals {
  const optsAny = sys.options as any;
  const est = (optsAny.estimates ?? {}) as Partial<EngineeredEstimates>;
  const bulk = !!optsAny.bulkTubes;

  // Panels chosen by calcZone (sum across zones)
  const totalPanels = sys.zones.reduce((s, z) => {
    const q = (z as any).panelSizing?.qty;
    return s + (typeof q === "number" ? q : 0);
  }, 0);

  // Use the panel style actually used for sizing (zone carries style; fall back to system)
  const panelStyle: "ar" | "dc" =
    (sys.zones.find((z) => (z as any).panelSizing?.style)?.panelSizing?.style ??
      optsAny.panelStyle) === "dc"
      ? "dc"
      : "ar";

  // Cylinder-driven primary pilots (goes to 0 when Bulk Tubes)
  const primaries = bulk ? 0 : Math.max(0, est.primaryReleaseAssemblies ?? 0);

  // Batteries come from your estimates
  const batteries = Math.max(0, est.batteryBackups ?? 0);

  // Water tank chosen by calcSystem (if present => 1 supervisory)
  const waterTankPresent = !!optsAny.waterTankPick;

  // Per your BOM rules:
  // - Each panel contributes: 1 supervisory (Panel Fault) + 1 alarm (Panel Discharge)
  // - DC panels add one releasing circuit each (AR panels do not)
  // - Each primary pilot adds: 2 supervisory (coil tamper, cyl low) + 1 releasing (solenoid)
  // - Each panel assembly adds 1 water ISO valve tamper (supervisory)
  // - Each manifold assembly (1 per panel) adds 1 N2 ISO valve tamper (supervisory)
  // - Each battery adds 2 supervisory (battery fault + AC fault)
  // - Water tank adds 1 supervisory (level)
  let supervisory = 0;
  let alarm = 0;
  let releasing = 0;

  // Panel-native
  supervisory += totalPanels; // Panel Fault
  alarm += totalPanels; // Panel Discharge
  if (panelStyle === "dc") releasing += totalPanels; // AR has no 24VRC output

  // Pilots (primary)
  supervisory += primaries * 2; // coil tamper + low pressure
  releasing += primaries * 1; // solenoid

  // ISO tampers
  supervisory += totalPanels * 1; // Water ISO valve (threaded ball valve)
  supervisory += totalPanels * 1; // N2 ISO valve (manifold assembly)

  // Batteries
  supervisory += batteries * 2;

  // Water tank
  if (waterTankPresent) supervisory += 1;

  // (Optional) Discharge verification switch (alarm): add here when you place that part.
  // alarm += dverifCount;

  // Bulk Tubes policy: if you want to guarantee a single releasing circuit to the bulk skid,
  // enforce at least one releasing point when bulk is selected.
  if (bulk) releasing = Math.max(releasing, 1);

  return { supervisory, alarm, releasing };
}
