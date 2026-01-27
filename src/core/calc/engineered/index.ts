// src/core/calc/engineered/index.ts
import {
  Project,
  System,
  Zone,
  Enclosure,
  StatusInput,
  EngineeredEstimates,
  EngineeredOptions,
  SystemTotals,
  WaterTankCert,
} from "@/state/app-model";
import { emitterConfigMap } from "@/core/catalog/emitter.catalog";

import {
  selectWaterTankStrict,
  maxCapacityForCert,
  prettyCert,
} from "@/core/catalog/water_tanks.catalog";

import type { Codes } from "@/core/catalog/parts.constants";
import { statusFromCode } from "@/core/status/error-codes";

/** ─────────────────────────────────────────────────────────────
 *  CONSTANTS & SMALL HELPERS
 *  ────────────────────────────────────────────────────────────*/
type Num = number;

const T_STD_K = 294.4; // Reference absolute temperature (K)
const SAFETY_FACTOR = 1.2; // Default safety factor
const FT3_PER_M3 = 35.3147; // Unit conversion
const O2_REQ_PCT = 13.36; // Threshold for N2 requirement met

// Flooding factors by design method
const FLOODING_FACTOR: Record<Enclosure["method"], Num> = {
  "NFPA 770 Class A/C": 0.375,
  "NFPA 770 Class B": 0.375,
  "FM Data Centers": 0.375,
  "FM Machine Spaces/Turbines": 0.375,
};

// Altitude correction factors (UI uses string key)
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

// Cylinder capacity tables (default vs. FM Turb/Machine Space paths)
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

// Unit helpers
function pipeVolumeToGallons(
  project: Project,
  v: number | undefined | null
): number {
  const n = Number(v) || 0;
  return project.units === "metric" ? n * GAL_PER_LITER : n;
}

const clampInt = (n: any, min = 0) =>
  Math.max(min, Math.floor(Number.isFinite(+n) ? +n : 0));

// “Editable” toggles on enclosure/zone for user overrides
const hasCustomEmitters = (e: Enclosure) => {
  return e._editEmitters && e.customMinEmitters != null;
};
const getCustomEmitters = (e: Enclosure) => {
  const v = e.customMinEmitters;
  if (v == null) return 0;
  return clampInt(v, 0);
};
const hasCustomCyl = (z: Zone) =>
  !!z._editCylinders && z.customMinTotalCylinders != null;
const getCustomCyl = (z: Zone) => {
  const v = z.customMinTotalCylinders;
  if (v == null) return 0;
  return clampInt(v, 0);
};
function formatPsiList(psis: number[]) {
  const unique = Array.from(new Set(psis)).sort((a, b) => b - a);
  return unique.map((p) => `${p} psi`).join(", ");
}

// Rounding helpers
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function ceilToDecimals(n: number, decimals: number) {
  if (!(n > 0)) return 0;
  const f = 10 ** decimals;
  return Math.ceil(n * f) / f;
}
const ceil2 = (n: number) => ceilToDecimals(n, 2);

export function volToFt3(project: Project, vol: number): number {
  return project.units === "metric" ? vol * FT3_PER_M3 : vol;
}
export function tempToKelvin(project: Project, tInput: number): number {
  return project.units === "metric"
    ? tInput + 273.15
    : (tInput - 32) * (5 / 9) + 273.15;
}

function getBulkTubeCapacityPerTubeSCF(sys: System): number {
  const opts = asEngineeredOptions(sys);
  const cap = Number(opts.bulkTubeNitrogenSCF);
  return Number.isFinite(cap) && cap > 0 ? cap : 0;
}
function minBulkTubesRequired(requiredSCF: number, capPerTube: number): number {
  if (!(requiredSCF > 0) || !(capPerTube > 0)) return 0;
  return Math.max(1, Math.ceil(requiredSCF / capPerTube));
}

export function asEngineeredOptions(sys: System): EngineeredOptions {
  if (sys.options.kind !== "engineered") {
    throw new Error("Expected engineered options for engineered calc");
  }
  return sys.options;
}
function pushNote(enc: any, note: string) {
  if (!note) return;
  const arr = Array.isArray(enc.notes) ? enc.notes : (enc.notes = []);
  if (!arr.includes(note)) arr.push(note);
}

/** ─────────────────────────────────────────────────────────────
 *  METHOD FAMILIES (NEW)
 *  ────────────────────────────────────────────────────────────*/
type MethodFamily = "NFPA" | "FMDC" | "FMTMS";

function methodFamily(m: Enclosure["method"]): MethodFamily {
  if (m === "NFPA 770 Class A/C" || m === "NFPA 770 Class B") return "NFPA";
  if (m === "FM Data Centers") return "FMDC";
  // Merge Turbines + Machine Spaces as one family
  return "FMTMS";
}

function designTimeMinForFamily(sys: System, fam: MethodFamily): number {
  const opts = asEngineeredOptions(sys);
  if (fam === "NFPA") return 3;
  if (fam === "FMDC") return 3.5;
  // FMTMS: both are now 10 + rundown
  return 10 + (opts.rundownTimeMin || 0);
}

function cylinderCapsForFamily(fam: MethodFamily, fill: string) {
  const table = fam === "FMTMS" ? CYL_CAP_FMTMS : CYL_CAP_DEFAULT;
  return table[fill] ?? table["3000 PSI/206.8 BAR"];
}

/** ─────────────────────────────────────────────────────────────
 *  EMITTER / NOZZLE LOOKUPS & O2
 *  ────────────────────────────────────────────────────────────*/

// Estimation for FM Turbines / Machine Spaces (piecewise)
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
function getNozzleOpPSI(enc: Enclosure): number {
  try {
    const methodMap = (emitterConfigMap as any)[enc.method];
    const nozzle = enc.nozzleCode ? methodMap?.[enc.nozzleCode] : undefined;
    const p = nozzle?.op_psi;
    return typeof p === "number" && p > 0 ? p : 0;
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

/** ─────────────────────────────────────────────────────────────
 *  USER OVERRIDES (ESTIMATES EDITING)
 *  ────────────────────────────────────────────────────────────*/
type EstKey = keyof EngineeredEstimates;

function useUserFor(sys: System, field: EstKey): boolean {
  const o: any = sys.options || {};
  return !!(o._editEstimates && o._editEstimates[field]);
}
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

/** ─────────────────────────────────────────────────────────────
 *  FACP TOTALS (SYSTEM-LEVEL ESTIMATION)
 *  ────────────────────────────────────────────────────────────*/
type FacpTotals = { supervisory: number; alarm: number; releasing: number };

function estimateFacpTotalsFromDesign(params: {
  sys: System;
  zonesUsed: Zone[];
  primaries: number;
  batteries: number;
  bulk: boolean;
  waterTankPresent: boolean;
}): FacpTotals {
  const opts = asEngineeredOptions(params.sys);
  const { sys, zonesUsed, primaries, batteries, bulk, waterTankPresent } =
    params;

  const totalPanels = zonesUsed.reduce((s, z) => {
    const q = z.panelSizing?.qty;
    return s + (typeof q === "number" ? q : 0);
  }, 0);

  const panelStyle: "ar" | "dc" =
    (zonesUsed.find((z) => z.panelSizing?.style)?.panelSizing?.style ??
      opts.panelStyle) === "dc"
      ? "dc"
      : "ar";

  let supervisory = 0;
  let alarm = 0;
  let releasing = 0;

  supervisory += totalPanels;
  alarm += totalPanels;
  if (panelStyle === "dc") releasing += totalPanels;

  const prim = Math.max(0, primaries);
  const bat = Math.max(0, batteries);
  supervisory += prim * 2;
  releasing += prim * 1;

  supervisory += totalPanels * 1;
  supervisory += totalPanels * 1;

  supervisory += bat * 2;

  if (waterTankPresent) supervisory += 1;
  if (bulk) releasing = Math.max(releasing, 1);

  return { supervisory, alarm, releasing };
}

/** ─────────────────────────────────────────────────────────────
 *  PANEL/HOSE/RACK ESTIMATORS (COUNTS ONLY)
 *  ────────────────────────────────────────────────────────────*/
function estimatePrimaryReleaseAssembliesFromZones(
  zones: Zone[],
  maxCylAcrossZones: number
): number {
  if (!maxCylAcrossZones || maxCylAcrossZones <= 0) return 0;
  const totals = zones
    .map((z) => Number(z.minTotalCylinders || 0))
    .filter((n) => n > 0);
  if (totals.length === 0) return 0;
  const uniqueCounts = Array.from(new Set(totals));
  if (totals.length === 1) return Math.ceil(maxCylAcrossZones / 24);
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
  return Math.ceil(maxCylAcrossZones / 24);
}
function estimateAdjacentRackHosesFromZones(maxCylAcrossZones: number) {
  if (maxCylAcrossZones <= 12) return 0;
  return Math.ceil(2 * (maxCylAcrossZones / 24));
}
function estimateDoubleStackedRackHoseFromZones(maxCylAcrossZones: number) {
  if (maxCylAcrossZones == 1) return 0;
  if (maxCylAcrossZones < 24 && maxCylAcrossZones > 1) return 1;
  return Math.ceil(maxCylAcrossZones / 24);
}

/** ─────────────────────────────────────────────────────────────
 *  CORE FORWARD-FLOW EQUATIONS
 *  ────────────────────────────────────────────────────────────*/
function sum<T>(arr: T[], f: (x: T) => number) {
  return arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
}

function enclosureQreq_N2_enc_ft3({
  V_ft3,
  T_min_K,
  acf,
  ff = 0.375,
}: {
  V_ft3: Num;
  T_min_K: Num;
  acf: Num;
  ff?: Num;
}): Num {
  return V_ft3 * (T_STD_K / T_min_K) * acf * ff * SAFETY_FACTOR;
}
function enclosureFlowReq_SCFM(Qreq_enc_SCF: Num, t_design_min: Num): Num {
  return Qreq_enc_SCF / Math.max(t_design_min, 1e-6);
}
function requiredEmittersForEnclosure(
  Qreq_flow_SCFM: Num,
  qNoz_SCFM: Num
): number {
  if (qNoz_SCFM <= 0) return 0;
  return Math.max(0, Math.ceil(Qreq_flow_SCFM / qNoz_SCFM));
}
function estimatedTdForEnclosure(Qreq_enc_SCF: Num, Q_flow_enc_SCFM: Num): Num {
  return Q_flow_enc_SCFM > 0 ? Qreq_enc_SCF / Q_flow_enc_SCFM : 0;
}

/** ─────────────────────────────────────────────────────────────
 *  UNIFIED ZONE ROW
 *  ────────────────────────────────────────────────────────────*/
type ZoneRow = {
  enc: Enclosure;
  V_ft3: number;
  T_K: number;
  acf: number;
  ff: number;
  qNoz_SCFM: number;
  qWater_GPM: number;
  opPSI: number;

  emitters_calc: number;
  emitters_final: number;
  Qreq_enc_SCF: number;
  Q_flow_enc_SCFM: number;
  t_est_min: number;
};

/** ─────────────────────────────────────────────────────────────
 *  ROW BUILDERS (FORWARD + FMTMS)
 *  ────────────────────────────────────────────────────────────*/
function buildRowsForwardLike(
  p: Project,
  sys: System,
  zone: Zone,
  fam: "NFPA" | "FMDC",
  messages: StatusInput[]
): ZoneRow[] {
  const acf = ACF_BY_ELEVATION[p.elevation] ?? 1.0;
  const t_design = designTimeMinForFamily(sys, fam);

  return (zone.enclosures ?? []).map((enc) => {
    const V_ft3 = volToFt3(p, Number(enc.volume) || 0);
    const T_K = tempToKelvin(p, Number(enc.tempF) || 70);
    const ff = FLOODING_FACTOR[enc.method] ?? 0.375;

    const Qreq_enc_SCF = enclosureQreq_N2_enc_ft3({
      V_ft3,
      T_min_K: T_K,
      acf,
      ff,
    });

    const qNoz_SCFM = getNozzleFlowSCFM(enc);
    const qWater_GPM = getNozzleWaterGPM(enc);
    const opPSI = getNozzleOpPSI(enc);

    const Qreq_flow_SCFM = enclosureFlowReq_SCFM(Qreq_enc_SCF, t_design);

    let emitters_calc = 0;

    if (qNoz_SCFM > 0) {
      const raw = Qreq_flow_SCFM / qNoz_SCFM;

      if (fam === "FMDC") {
        // Excel: ROUNDDOWN(raw, 0), but if that would be 0 and volume exists -> 1
        const down = Math.floor(raw);
        emitters_calc = down === 0 && V_ft3 > 0 ? 1 : Math.max(0, down);
      } else {
        // NFPA: round up to satisfy the maximum discharge time limit
        emitters_calc = Math.max(0, Math.ceil(raw));
      }
    }

    const emitters_final = hasCustomEmitters(enc)
      ? getCustomEmitters(enc)
      : emitters_calc;

    if (hasCustomEmitters(enc) && emitters_final !== emitters_calc) {
      pushNote(enc, "Custom nozzle count applied.");
      messages.push(
        statusFromCode(
          "ENC.CUSTOM_NOZZLES",
          { systemId: sys.id, zoneId: zone.id, enclosureId: enc.id },
          { name: enc.name, final: emitters_final, calc: emitters_calc }
        )
      );
    }

    const Q_flow_enc_SCFM = emitters_final * qNoz_SCFM;
    const t_est = estimatedTdForEnclosure(Qreq_enc_SCF, Q_flow_enc_SCFM);
    // NEW: NFPA under 2.1 min warning (suggest lower pressure/smaller nozzles)
    if (fam === "NFPA" && t_est > 0 && t_est < 2.1 - 1e-6) {
      messages.push(
        statusFromCode(
          "ENC.NFPA_LOW_DISCHARGE",
          { systemId: sys.id, zoneId: zone.id, enclosureId: enc.id },
          { name: enc.name, t_est: ceil2(t_est) }
        )
      );
    }

    if (fam === "FMDC" && t_est > 0 && t_est < 3.5 - 1e-6) {
      messages.push(
        statusFromCode(
          "ENC.FMDC_MIN_DISCHARGE",
          { systemId: sys.id, zoneId: zone.id, enclosureId: enc.id },
          { t_actual: ceil2(t_est) } // ceiling display
        )
      );
    }

    return {
      enc,
      V_ft3,
      T_K,
      acf,
      ff,
      qNoz_SCFM,
      qWater_GPM,
      opPSI,
      emitters_calc,
      emitters_final,
      Qreq_enc_SCF,
      Q_flow_enc_SCFM,
      t_est_min: t_est,
    };
  });
}

function buildRowsFMTMS(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): ZoneRow[] {
  const acf = ACF_BY_ELEVATION[p.elevation] ?? 1.0;
  const t_design = designTimeMinForFamily(sys, "FMTMS");

  return (zone.enclosures ?? []).map((enc) => {
    const V_ft3 = volToFt3(p, Number(enc.volume) || 0);
    const T_K = tempToKelvin(p, Number(enc.tempF) || 70);
    const ff = FLOODING_FACTOR[enc.method] ?? 0.375;

    // defaults used previously in legacy path
    let qNoz_SCFM = getNozzleFlowSCFM(enc);
    let qWater_GPM = getNozzleWaterGPM(enc);
    if (!qNoz_SCFM) qNoz_SCFM = 150;
    if (!qWater_GPM) qWater_GPM = 1.06;

    const opPSI = getNozzleOpPSI(enc);

    const emitters_calc = Math.max(0, estimateFMTMSEmitters(p, enc));
    const emitters_final = hasCustomEmitters(enc)
      ? getCustomEmitters(enc)
      : emitters_calc;

    if (hasCustomEmitters(enc) && emitters_final !== emitters_calc) {
      pushNote(enc, "Custom nozzle count applied.");
      messages.push(
        statusFromCode(
          "ENC.CUSTOM_NOZZLES",
          { systemId: sys.id, zoneId: zone.id, enclosureId: enc.id },
          { name: enc.name, final: emitters_final, calc: emitters_calc }
        )
      );
    }

    // For FMTMS, requirement is driven by (emitters * nozzle flow * design time)
    const Q_flow_enc_SCFM = emitters_final * qNoz_SCFM;
    const Qreq_enc_SCF = Q_flow_enc_SCFM * t_design;

    // By construction, t_est == t_design (unless flow is 0)
    const t_est = Q_flow_enc_SCFM > 0 ? Qreq_enc_SCF / Q_flow_enc_SCFM : 0;
    return {
      enc,
      V_ft3,
      T_K,
      acf,
      ff,
      qNoz_SCFM,
      qWater_GPM,
      opPSI,
      emitters_calc,
      emitters_final,
      Qreq_enc_SCF,
      Q_flow_enc_SCFM,
      t_est_min: t_est,
    };
  });
}

/** ─────────────────────────────────────────────────────────────
 *  SHARED ZONE SIZING STEPS
 *  ────────────────────────────────────────────────────────────*/
function sizeStorageFromRows(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ZoneRow[]
) {
  const opts = asEngineeredOptions(sys);
  const bulkOn = !!opts.bulkTubes;

  const QN2_zone_SCFM = rows.reduce((s, r) => s + r.Q_flow_enc_SCFM, 0);

  // controlling time = highest enclosure estimated discharge time
  const td_highest_est_min = rows.reduce(
    (m, r) => Math.max(m, r.t_est_min || 0),
    0
  );

  const Wreq_zone_SCF_raw = QN2_zone_SCFM * td_highest_est_min;

  return {
    bulkOn,
    QN2_zone_SCFM,
    td_highest_est_min,
    Wreq_zone_SCF_raw,
  };
}

function computePerEnclosureO2AndExposeUnified(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ZoneRow[],
  params: {
    Wprov_zone_SCF: number;
    QN2_zone_SCFM: number;
    suppressDischargeTime: boolean;
  }
) {
  const { Wprov_zone_SCF, QN2_zone_SCFM, suppressDischargeTime } = params;

  const encsOut: Enclosure[] = rows.map((r) => {
    const propRaw = QN2_zone_SCFM > 0 ? r.Q_flow_enc_SCFM / QN2_zone_SCFM : 0;
    const prop = Math.round(propRaw * 10000) / 10000;

    const Vn2_forO2_SCF = Wprov_zone_SCF * prop;

    const o2_final = computeO2Percent({
      Vn2_scf: Vn2_forO2_SCF,
      Venc_ft3: r.V_ft3,
      T_K: r.T_K,
      acf: r.acf,
    });
    const flowLabel = r.qWater_GPM > 0 ? `${r.qWater_GPM} GPM` : "—";
    const dischargeLabel = r.t_est_min > 0 ? `${ceil2(r.t_est_min)} min` : "—";
    return {
      ...r.enc,
      minEmitters: r.emitters_final,
      estDischarge: dischargeLabel,
      estFinalO2: Number.isFinite(o2_final) ? `${ceil2(o2_final)} %` : "—",
      flowCartridge: flowLabel,
      qWater_gpm: r.qWater_GPM,
      qWaterTotal_gpm: r.qWater_GPM * r.emitters_final,
    } as Enclosure;
  });

  return { encsOut };
}

function computeZoneWaterAndTank(
  p: Project,
  sys: System,
  encsOut: Enclosure[],
  t_flow_zone_min: number
) {
  const opts = asEngineeredOptions(sys);
  const qWaterPeak_GPM = sum(encsOut, (e) => Number(e.qWaterTotal_gpm) || 0);
  const zoneWaterDischarge_GAL = qWaterPeak_GPM * t_flow_zone_min;

  const pipeVolGal = pipeVolumeToGallons(p, opts.estimatedPipeVolume);
  const zoneTankMin_GAL = (zoneWaterDischarge_GAL + pipeVolGal) * SAFETY_FACTOR;

  return {
    qWaterPeak_GPM,
    zoneWaterDischarge_GAL,
    zoneTankMin_GAL,
  };
}

function sizePanelsFromZoneFlow(
  sys: System,
  zoneTotalFlow_SCFM: number
): {
  bore: "1in" | "1.5in";
  capacity: number;
  qty: number;
  style: "ar" | "dc";
} {
  const opts = asEngineeredOptions(sys);
  const bore: "1in" | "1.5in" = zoneTotalFlow_SCFM <= 1800 ? "1in" : "1.5in";
  const capacity = bore === "1in" ? 1800 : 4500;
  const qty =
    zoneTotalFlow_SCFM > 0 ? Math.ceil(zoneTotalFlow_SCFM / capacity) : 0;
  const style: "ar" | "dc" = (opts.panelStyle === "dc" ? "dc" : "ar") as any;
  return { bore, capacity, qty, style };
}

/** ─────────────────────────────────────────────────────────────
 *  UNIFIED ZONE CALC (REPLACES calcZone_TotalFloodNFPA + calcZone_Legacy)
 *  ────────────────────────────────────────────────────────────*/
function calcZone_EngineeredUnified(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const encs = zone.enclosures ?? [];
  if (encs.length === 0) return zone;

  const families = new Set(encs.map((e) => methodFamily(e.method)));

  if (families.size > 1) {
    // Return early so no enclosure-level logic runs
    return {
      ...zone,
      enclosures: encs.map((e) => ({
        ...e,
        estDischarge: "—",
        estFinalO2: "—",
      })),
      totalNitrogenRequired_scf: 0 as any,
      totalNitrogenDelivered_scf: 0 as any,
      minTotalCylinders: 0,
      q_n2_peak_scfm: 0 as any,
      water_peak_gpm: 0 as any,
      waterDischarge_gal: 0 as any,
      waterTankMin_gal: 0 as any,
      ...({
        panelSizing: { bore: "1in", capacity: 1800, qty: 0, style: "ar" },
        panelSizingByPressure: [],
        designLabel: "spec_hazards",
      } as any),
    };
  }

  const fam = Array.from(families)[0] as MethodFamily;
  const opts = asEngineeredOptions(sys);

  // Build rows based on family
  const rows: ZoneRow[] =
    fam === "FMTMS"
      ? buildRowsFMTMS(p, sys, zone, messages)
      : buildRowsForwardLike(p, sys, zone, fam, messages);

  // Base zone aggregates
  const sized = sizeStorageFromRows(p, sys, zone, rows);
  const { QN2_zone_SCFM, td_highest_est_min } = sized;

  // Display time in calculations must be CEILING to avoid under-delivery
  const t_display_min = ceil2(Math.max(0, td_highest_est_min || 0));

  // Required nitrogen:
  // - Keep your prior multi-enclosure Excel behavior: use displayed controlling time for flow×time
  // - Single enclosure: use raw (flow × exact t_est)
  const activeEncCount = rows.filter((r) => (r.V_ft3 ?? 0) > 0).length;
  const isMultiEnclosure = activeEncCount > 1;

  const Wreq_zone_SCF_raw =
    QN2_zone_SCFM * Math.max(0, td_highest_est_min || 0);
  const Wreq_zone_SCF_display = QN2_zone_SCFM * t_display_min;

  const Wreq_zone_SCF = isMultiEnclosure
    ? Wreq_zone_SCF_display
    : Wreq_zone_SCF_raw;

  // Storage selection (cylinders vs bulk)
  const fillPressure = sys.options.fillPressure || "3000 PSI/206.8 BAR";
  const caps = cylinderCapsForFamily(fam, fillPressure);

  const bulkOn = !!opts.bulkTubes;

  let Wprov_zone_SCF = 0;
  let t_flow_zone_min = 0;
  let cyl_final = 0;
  let minCylinders = 0;

  // Track nitrogen calc error → suppress discharge time display
  let n2CalcError = false;

  if (bulkOn) {
    const requiredOpenMin = t_display_min;

    const isEditingOpen = !!zone._editBulkValveOpenTimeMin;

    const userOpenRaw = Number(zone.bulkValveOpenTimeMin);
    const userOpen = Number.isFinite(userOpenRaw)
      ? userOpenRaw
      : requiredOpenMin;

    // Clamp to at least required time; store CEIL to 2 decimals
    const tOpen = ceil2(
      isEditingOpen ? Math.max(requiredOpenMin, userOpen) : requiredOpenMin
    );

    zone.bulkValveOpenTimeMinRequired = requiredOpenMin;
    zone.bulkValveOpenTimeMin = tOpen;

    const capPerTube = getBulkTubeCapacityPerTubeSCF(sys);
    const tubesMin = minBulkTubesRequired(Wreq_zone_SCF, capPerTube);
    const bulkCapSCF = tubesMin * capPerTube;

    const idealDeliverable = QN2_zone_SCFM * tOpen;
    Wprov_zone_SCF = Math.min(idealDeliverable, bulkCapSCF);
    t_flow_zone_min = QN2_zone_SCFM > 0 ? Wprov_zone_SCF / QN2_zone_SCFM : 0;

    zone.minTotalTubes = tubesMin;
  } else {
    minCylinders = Math.max(
      0,
      Math.ceil(Wreq_zone_SCF / Math.max(1, caps.total))
    );
    cyl_final = hasCustomCyl(zone) ? getCustomCyl(zone) : minCylinders;

    if (hasCustomCyl(zone)) {
      pushNote(zone.enclosures?.[0], "Custom cylinder count applied.");
      messages.push(
        statusFromCode(
          "ZONE.CUSTOM_CYLINDERS",
          { systemId: sys.id, zoneId: zone.id },
          { actual: cyl_final, recommended: minCylinders }
        )
      );
    }

    Wprov_zone_SCF = cyl_final * caps.total;
    t_flow_zone_min = QN2_zone_SCFM > 0 ? Wprov_zone_SCF / QN2_zone_SCFM : 0;
  }

  // Zone-level N2 requirement check
  if (Wprov_zone_SCF + 1e-6 < Wreq_zone_SCF) {
    n2CalcError = true;
    messages.push(
      statusFromCode(
        "ZONE.N2_NOT_MET",
        { systemId: sys.id, zoneId: zone.id },
        {
          provided: Math.round(Wprov_zone_SCF),
          required: Math.round(Wreq_zone_SCF),
          bulkOn,
        }
      )
    );
  }

  // Enclosure-level N2 requirement check (allocation by flow proportion)
  for (const r of rows) {
    const propRaw = QN2_zone_SCFM > 0 ? r.Q_flow_enc_SCFM / QN2_zone_SCFM : 0;
    const pflow = Math.round(propRaw * 10000) / 10000;

    const WN2_enc_SCF = Wprov_zone_SCF * pflow;

    if (WN2_enc_SCF + 1e-6 < r.Qreq_enc_SCF) {
      n2CalcError = true;
      messages.push(
        statusFromCode(
          "ENC.N2_NOT_MET",
          { systemId: sys.id, zoneId: zone.id, enclosureId: r.enc.id },
          {
            name: r.enc.name,
            delivered: Math.round(WN2_enc_SCF),
            required: Math.round(r.Qreq_enc_SCF),
            bulkOn,
          }
        )
      );
    }
  }

  // O2 + UI fields (suppress discharge time display when any N2 error exists)
  const { encsOut } = computePerEnclosureO2AndExposeUnified(
    p,
    sys,
    zone,
    rows,
    {
      Wprov_zone_SCF,
      QN2_zone_SCFM,
      suppressDischargeTime: n2CalcError,
    }
  );

  // Water + tank (use actual flow time derived from provided nitrogen)
  const water = computeZoneWaterAndTank(p, sys, encsOut, t_flow_zone_min);

  // Panel grouping by operating pressure
  const flowByPSI = new Map<number, number>();
  for (const r of rows) {
    if (r.opPSI > 0) {
      flowByPSI.set(r.opPSI, (flowByPSI.get(r.opPSI) || 0) + r.Q_flow_enc_SCFM);
    }
  }

  const panelGroups = Array.from(flowByPSI.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([psi, flow]) => ({ psi, ...sizePanelsFromZoneFlow(sys, flow) }));

  const panelQtyTotal = panelGroups.reduce((s, g) => s + g.qty, 0);

  const panelSizing = {
    bore: (panelGroups[0]?.bore ?? "1in") as "1in" | "1.5in",
    capacity: (panelGroups[0]?.capacity ?? 0) as 1800 | 4500,
    qty: panelQtyTotal,
    style: (panelGroups[0]?.style ??
      (opts.panelStyle === "dc" ? "dc" : "ar")) as "ar" | "dc",
  };

  const panelSizingByPressure = panelGroups;

  if (panelGroups.length > 1) {
    const psiList = formatPsiList(panelGroups.map((g) => g.psi));
    messages.push(
      statusFromCode(
        "ZONE.MULTI_OP_PSI",
        { systemId: sys.id, zoneId: zone.id },
        { psiList }
      )
    );
  }

  // Design label for UI (kept from prior behavior)
  let designLabel: "data_proc" | "comb_turb" | "spec_hazards";
  if (fam === "FMDC") designLabel = "data_proc";
  else if (fam === "FMTMS") designLabel = "comb_turb";
  else designLabel = "spec_hazards";

  return {
    ...zone,
    enclosures: encsOut,

    totalNitrogenRequired_scf: ceil2(Wreq_zone_SCF) as any,
    totalNitrogenDelivered_scf: ceil2(Wprov_zone_SCF) as any,

    minTotalCylinders: bulkOn ? 0 : cyl_final,
    ...(bulkOn ? { minTotalTubes: zone.minTotalTubes } : {}),

    q_n2_peak_scfm: QN2_zone_SCFM as any,
    water_peak_gpm: water.qWaterPeak_GPM as any,
    waterDischarge_gal: water.zoneWaterDischarge_GAL as any,
    waterTankMin_gal: water.zoneTankMin_GAL as any,

    ...({
      panelSizing,
      panelSizingByPressure,
      designLabel,
    } as any),
  };
}

/** ─────────────────────────────────────────────────────────────
 *  SYSTEM CALC (PER SYSTEM): ZONES → TANK → ESTIMATES → TOTALS
 *  ────────────────────────────────────────────────────────────*/
function calcSystem_TotalFloodNFPA(
  project: Project,
  sys: System,
  messages: StatusInput[]
): System {
  if (sys.options.kind !== "engineered") return sys;

  // Unified zone calc replaces legacy branching
  const zones = sys.zones.map((z) =>
    calcZone_EngineeredUnified(project, sys, z, messages)
  );

  // Water tank selection (strict matching to chosen certification)
  const zoneNeeds = zones
    .map((z) => Number(z.waterTankMin_gal) || 0)
    .filter((g) => g > 0);
  const maxReqGal = zoneNeeds.length ? Math.max(...zoneNeeds) : 0;

  const opts: EngineeredOptions = { ...sys.options };
  const defaultCert: WaterTankCert =
    project.currency === "USD" ? "ASME/FM" : "CE";
  const cert: WaterTankCert = opts.waterTankCertification ?? defaultCert;

  let pickCodes: Codes | null = null;
  let pickDesc: string | null = null;

  if (maxReqGal > 0) {
    const chosen = selectWaterTankStrict(cert, maxReqGal);
    if (chosen) {
      pickCodes = chosen.codes;
      pickDesc = chosen.description;
    } else {
      const maxAvail = maxCapacityForCert(cert);
      messages.push(
        statusFromCode(
          "SYS.TANK_CAPACITY",
          { systemId: sys.id },
          {
            reqGal: Math.ceil(maxReqGal),
            certPretty: prettyCert(cert),
            maxGal: Math.ceil(maxAvail),
          }
        )
      );
    }
  }

  opts.waterTankRequired_gal = maxReqGal;
  opts.waterTankCertification = cert;
  opts.waterTankPick = pickCodes;
  opts.waterTankPickDesc = pickDesc;

  // 3) Engineered estimates (panels, primaries, hoses, batteries, FACP)
  const maxCylAcrossZones = Math.max(
    0,
    ...zones.map((z) => Number(z.minTotalCylinders || 0))
  );

  const bulkEligible = true;
  opts.bulkTubesEligible = bulkEligible;

  const bulkSelected = !!opts.bulkTubes;
  const zonesUsed = zones;

  const totalPanelQty = zonesUsed.reduce((s, z) => {
    const ps = z.panelSizing as { qty: number } | undefined;
    return s + (ps?.qty ?? 0);
  }, 0);

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

  const prevEst = (opts.estimates ?? {}) as Partial<EngineeredEstimates>;

  const primaryReleaseAssemblies = persistEditable(
    prevEst.primaryReleaseAssemblies,
    bulkSelected ? 0 : primaryReleaseAssembliesComputed,
    useUserFor(sys, "primaryReleaseAssemblies")
  );
  const adjacentRackHose = persistEditable(
    prevEst.adjacentRackHose,
    bulkSelected ? 0 : adjacentRackHoseComputed,
    useUserFor(sys, "adjacentRackHose")
  );
  const doubleStackedRackHose = persistEditable(
    prevEst.doubleStackedRackHose,
    bulkSelected ? 0 : doubleStackedRackHoseComputed,
    useUserFor(sys, "doubleStackedRackHose")
  );
  const batteryBackups = persistEditable(
    prevEst.batteryBackups,
    batteryBackupsComputed,
    useUserFor(sys, "batteryBackups")
  );

  const waterTankPresent = !!opts.waterTank;
  const facp = estimateFacpTotalsFromDesign({
    sys,
    zonesUsed,
    primaries: primaryReleaseAssemblies,
    batteries: batteryBackups,
    bulk: bulkSelected,
    waterTankPresent,
  });

  const releasePoints = persistEditable(
    prevEst.releasePoints,
    facp.releasing,
    useUserFor(sys, "releasePoints")
  );
  const monitorPoints = persistEditable(
    prevEst.monitorPoints,
    facp.supervisory + facp.alarm,
    useUserFor(sys, "monitorPoints")
  );

  opts.estimates = {
    primaryReleaseAssemblies,
    adjacentRackHose,
    doubleStackedRackHose,
    batteryBackups,
    releasePoints,
    monitorPoints,
  };

  // 4) System totals for UI summary (kept as-is)
  const nums = {
    cylMax: 0,
    cylZoneId: null as string | null,
    n2ZoneId: null as string | null,
    n2ReqMax: 0,
    n2DelMax: 0,
    panelsSum: 0,
    flowSum: 0,
    waterTankMax: 0,
    waterTankZoneId: null as string | null,
    waterReqMax: 0,
    tubeMax: 0,
    tubeZoneId: null as string | null,
  };

  for (const z of zonesUsed) {
    const cyl = Math.max(0, Number(z.minTotalCylinders || 0));
    if (cyl > nums.cylMax) {
      nums.cylMax = cyl;
      nums.cylZoneId = z.id;
    }

    const n2Req = Math.max(0, Number(z.totalNitrogenRequired_scf || 0));
    const n2Del = Math.max(0, Number(z.totalNitrogenDelivered_scf || 0));

    if (n2Req > nums.n2ReqMax) {
      nums.n2ReqMax = n2Req;
      nums.n2ZoneId = z.id;
    }

    const tubes = Math.max(0, Number(z.minTotalTubes || 0));
    if (tubes > nums.tubeMax) {
      nums.tubeMax = tubes;
      nums.tubeZoneId = z.id;
    }

    nums.n2DelMax = Math.max(nums.n2DelMax, n2Del);

    const ps = z.panelSizing as { qty?: number } | undefined;
    nums.panelsSum += Math.max(0, Number(ps?.qty || 0));
    nums.flowSum += Math.max(0, Number(z.q_n2_peak_scfm || 0));

    const tank = Math.max(0, Number(z.waterTankMin_gal || 0));
    if (tank > nums.waterTankMax) {
      nums.waterTankMax = tank;
      nums.waterTankZoneId = z.id;
    }

    nums.waterReqMax = Math.max(
      nums.waterReqMax,
      Math.max(0, Number(z.waterDischarge_gal || 0))
    );
  }

  const systemTotals = {
    governingNitrogenZoneId: nums.n2ZoneId,
    governingWaterZoneId: nums.waterTankZoneId,

    totalCylinders: bulkSelected ? nums.tubeMax : nums.cylMax,
    totalBulkTubes: bulkSelected ? nums.tubeMax : 0,

    totalNitrogenRequired_scf: Math.round(nums.n2ReqMax),
    totalNitrogenDelivered_scf: Math.round(nums.n2DelMax),
    dischargePanels_qty: nums.panelsSum,
    waterTankRequired_gal: Math.ceil(nums.waterTankMax),
    waterRequirement_gal: round2(nums.waterReqMax),

    estReleasePoints: Number(opts.estimates?.releasePoints || 0),
    estMonitorPoints: Number(opts.estimates?.monitorPoints || 0),
    estBatteryBackups: Number(opts.estimates?.batteryBackups || 0),
  };

  return { ...sys, zones: zonesUsed, options: opts, systemTotals };
}

/** ─────────────────────────────────────────────────────────────
 *  PUBLIC API
 *  ────────────────────────────────────────────────────────────*/
export function calculateEngineered(p: Project): {
  project: Project;
  messages: StatusInput[];
} {
  const messages: StatusInput[] = [];
  const systems = p.systems.map((sys) =>
    sys.type === "engineered"
      ? calcSystem_TotalFloodNFPA(p, sys, messages)
      : sys
  );
  return { project: { ...p, systems }, messages };
}
