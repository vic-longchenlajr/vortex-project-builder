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
 *  OVERVIEW
 *  ─────────────────────────────────────────────────────────────
 *  This module computes engineered-system design outputs for Vortex:
 *   • Per-enclosure forward-flow requirements (NFPA 770 A/C & B)
 *   • Legacy sizing paths (FM families)
 *   • Cylinder counts, panel sizing (now per operating pressure), water needs
 *   • System-level water tank selection (strict cert), FACP estimate totals
 *   • Aggregated system totals for UI
 *
 *  Flow:
 *   calculateEngineered(project)
 *     → calcSystem_TotalFloodNFPA(system)
 *       → calcZone_* (forward for A/C & B; legacy for others)
 *         → per-enclosure rows → cylinders → O2 → water/tank → panel sizing
 *       → system-level: tank pick, estimates, FACP points, totals
 *
 *  Notes:
 *   - “Panel groups by pressure” is supported: one panel group per unique op PSI
 *     inside a zone so we don’t mix different pressures on a single panel set.
 */

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
  "FM Turbines": 0.375,
  "FM Machine Spaces": 0.375,
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

// Rounding helpers (ceil-based)
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function volToFt3(project: Project, vol: number): number {
  return project.units === "metric" ? vol * FT3_PER_M3 : vol;
}
export function tempToKelvin(project: Project, tInput: number): number {
  return project.units === "metric"
    ? tInput + 273.15
    : (tInput - 32) * (5 / 9) + 273.15;
}

// Cylinder caps depend on FM T/M/S vs others + system fill-pressure
function getCylinderCaps(method: Enclosure["method"], fill: string) {
  const isFMTMS = method === "FM Turbines" || method === "FM Machine Spaces";
  const table = isFMTMS ? CYL_CAP_FMTMS : CYL_CAP_DEFAULT;
  return table[fill] ?? table["3000 PSI/206.8 BAR"];
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

// Nozzle datasheet queries from emitter catalog
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

// Oxygen percentage after N2 delivery for an enclosure
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

// Persist computed values unless user edited that specific estimate
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

// Rough point counts from design selections (panels, primaries, batteries, tank)
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

  // Base panel points
  supervisory += totalPanels; // Panel Fault
  alarm += totalPanels; // Panel Discharge
  if (panelStyle === "dc") releasing += totalPanels; // ARV contact on DC style

  // Primary release assemblies
  const prim = Math.max(0, primaries);
  const bat = Math.max(0, batteries);
  supervisory += prim * 2; // coil tamper + low pressure
  releasing += prim * 1; // solenoid

  // ISO valves on panel skid (water + N2)
  supervisory += totalPanels * 1; // water ISO
  supervisory += totalPanels * 1; // N2 ISO

  // Batteries
  supervisory += bat * 2; // battery fault + AC fault

  // Water tank level
  if (waterTankPresent) supervisory += 1;

  // Bulk refill option ensures at least one releasing circuit
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
 *  NFPA 770 FORWARD-FLOW (CLASS A/C & B)
 *  ────────────────────────────────────────────────────────────*/
function isNFPA_AC_or_B(m: string) {
  return m === "NFPA 770 Class A/C" || m === "NFPA 770 Class B";
}
function designDischargeLimitMin(): number {
  // Forward-flow chapter target
  return 3;
}
function sum<T>(arr: T[], f: (x: T) => number) {
  return arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
}

// Core equations from Chapter 4
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
  // Qreq,N2,enc = V × (294.4/Tmin) × ACF × FF × SF
  return V_ft3 * (T_STD_K / T_min_K) * acf * ff * SAFETY_FACTOR;
}
function enclosureFlowReq_SCFM(Qreq_enc_SCF: Num, t_design_min: Num): Num {
  // Qreq,N2,flow = Qreq,N2,enc / t_d
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

// Typed working row for forward-flow path
type CalcRow = {
  skip: false;
  enc: Enclosure;
  V_ft3: number;
  T_K: number;
  acf: number;
  ff: number;
  Qreq_enc_SCF: number;
  qNoz_SCFM: number;
  qWater_GPM: number;
  opPSI: number; // ← operating pressure used for per-PSI panel grouping
  emitters_calc: number;
  emitters_final: number;
  Q_flow_enc_SCFM: number;
  t_est_min: number;
};
type ForwardRow = { skip: true; enc: Enclosure } | CalcRow;
function isCalcRow(r: ForwardRow): r is CalcRow {
  return r.skip === false;
}

// Build per-enclosure rows for a zone (forward-flow)
function forwardPerEnclosureTotals(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): ForwardRow[] {
  const acf = ACF_BY_ELEVATION[p.elevation];
  const t_design = designDischargeLimitMin();

  return (zone.enclosures ?? []).map((enc) => {
    if (!isNFPA_AC_or_B(enc.method)) {
      return { enc, skip: true } as const;
    }

    // Inputs and base requirements
    const V_ft3 = volToFt3(p, Number(enc.volume) || 0);
    const T_K = tempToKelvin(p, Number(enc.tempF) || 70);
    const ff = FLOODING_FACTOR[enc.method] ?? 0.375;
    const Qreq_enc_SCF = enclosureQreq_N2_enc_ft3({
      V_ft3,
      T_min_K: T_K,
      acf,
      ff,
    });

    // Nozzle properties
    const qNoz_SCFM = getNozzleFlowSCFM(enc);

    const qWater_GPM = getNozzleWaterGPM(enc);
    const opPSI = getNozzleOpPSI(enc);

    // Emitters + flow + time
    const Qreq_flow_SCFM = enclosureFlowReq_SCFM(Qreq_enc_SCF, t_design);
    const emitters_calc = requiredEmittersForEnclosure(
      Qreq_flow_SCFM,
      qNoz_SCFM
    );
    const emitters_final = hasCustomEmitters(enc)
      ? getCustomEmitters(enc)
      : emitters_calc;
    if (hasCustomEmitters(enc) && emitters_final != emitters_calc) {
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

    if (t_est > t_design + 1e-6) {
      messages.push(
        statusFromCode(
          "ENC.NFPA_MAX_DISCHARGE",
          { systemId: sys.id, zoneId: zone.id, enclosureId: enc.id },
          { name: enc.name, t_est: round2(t_est) }
        )
      );
    }

    return {
      enc,
      skip: false,
      V_ft3,
      T_K,
      acf,
      ff,
      opPSI,
      Qreq_enc_SCF, // raw
      qNoz_SCFM, // raw
      qWater_GPM, // raw
      emitters_calc,
      emitters_final,
      Q_flow_enc_SCFM, // raw
      t_est_min: t_est, // raw
    } as const;
  });
}

/** ─────────────────────────────────────────────────────────────
 *  ZONE SIZING STEPS (FORWARD-FLOW): CYLINDERS → O2 → WATER/TANK → PANELS
 *  ────────────────────────────────────────────────────────────*/

// 1) Cylinder sizing from summed N2 requirement
function sizeCylindersFromZoneNeed(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ForwardRow[]
) {
  const opts = asEngineeredOptions(sys);
  const calcRows = rows.filter(isCalcRow);

  // Zone PROVIDED flow (based on emitters_final)
  const QN2_zone_SCFM = calcRows.reduce((s, r) => s + r.Q_flow_enc_SCFM, 0);

  // Controlling enclosure time (still useful for valve-time checks)
  const td_highest_est_min = calcRows.reduce(
    (m, r) => Math.max(m, r.t_est_min || 0),
    0
  );

  const Wreq_zone_SCF = QN2_zone_SCFM * td_highest_est_min;

  const fillPressure = sys.options.fillPressure || "3000 PSI/206.8 BAR";
  const caps =
    CYL_CAP_DEFAULT[fillPressure] ?? CYL_CAP_DEFAULT["3000 PSI/206.8 BAR"];

  const bulkOn = !!opts.bulkTubes;

  if (bulkOn) {
    return {
      QN2_zone_SCFM,
      td_highest_est_min,
      Wreq_zone_SCF,
      caps,
      minCylinders: 0,
      cyl_final: 0,
      bulkOn,
    };
  }

  const minCylinders = Math.max(
    0,
    Math.ceil(Wreq_zone_SCF / Math.max(1, caps.total))
  );

  const useCustom = hasCustomCyl(zone);
  const cyl_final = useCustom ? getCustomCyl(zone) : minCylinders;

  return {
    QN2_zone_SCFM,
    td_highest_est_min,
    Wreq_zone_SCF,
    caps,
    minCylinders,
    cyl_final,
    bulkOn,
  };
} // 2) O2 compute per enclosure + expose display fields
function computePerEnclosureO2AndExpose(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ForwardRow[],
  params: {
    Wprov_zone_SCF: number;
    QN2_zone_SCFM: number;
  }
) {
  const { Wprov_zone_SCF, QN2_zone_SCFM } = params;

  const encsOut: Enclosure[] = rows.map((r) => {
    if (!isCalcRow(r)) return r.enc;

    const propRaw = QN2_zone_SCFM > 0 ? r.Q_flow_enc_SCFM / QN2_zone_SCFM : 0;
    const prop = Math.round(propRaw * 10000) / 10000; // doc: 4 decimals

    const Vn2_forO2_SCF = Wprov_zone_SCF * prop;

    const o2_final = computeO2Percent({
      Vn2_scf: Vn2_forO2_SCF,
      Venc_ft3: r.V_ft3,
      T_K: r.T_K,
      acf: r.acf,
    });

    const flowLabel = r.qWater_GPM > 0 ? `${round2(r.qWater_GPM)} GPM` : "—";

    return {
      ...r.enc,
      minEmitters: r.emitters_final,
      estDischarge: `${round2(r.t_est_min)} min`,
      estFinalO2: Number.isFinite(o2_final) ? `${round2(o2_final)} %` : "—",
      flowCartridge: flowLabel,
      qWater_gpm: r.qWater_GPM,
      qWaterTotal_gpm: r.qWater_GPM * r.emitters_final,
    } as Enclosure;
  });

  return { encsOut };
}

// 3) Water calc and minimum tank size (zone)
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

// 4) Panel sizing (per-flow capacity) for a single flow number
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
 *  ZONE CALC (FORWARD: NFPA 770 A/C & B)
 *  ────────────────────────────────────────────────────────────*/
function calcZone_TotalFloodNFPA(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const encs = zone.enclosures ?? [];
  if (encs.length === 0) return zone;

  // 4.1–4.2: Build per-enclosure forward-flow rows (NFPA 770 A/C & B only)
  const rows = forwardPerEnclosureTotals(p, sys, zone, messages);

  // 4.3: Zone sizing inputs derived from rows
  const sized = sizeCylindersFromZoneNeed(p, sys, zone, rows);
  const opts = asEngineeredOptions(sys);
  const {
    QN2_zone_SCFM,
    td_highest_est_min,
    Wreq_zone_SCF,
    caps,
    cyl_final,
    minCylinders,
    bulkOn,
  } = sized;

  const calcRows = rows.filter(isCalcRow);

  // Warn when user overrides cylinders (cylinder mode only)
  if (!bulkOn && hasCustomCyl(zone)) {
    pushNote(zone.enclosures[0], "Custom cylinder count applied.");
    messages.push(
      statusFromCode(
        "ZONE.CUSTOM_CYLINDERS",
        { systemId: sys.id, zoneId: zone.id },
        { actual: cyl_final, recommended: minCylinders }
      )
    );
  }

  const activeEncCount = calcRows.filter((r) => (r.V_ft3 ?? 0) > 0).length;
  const isMultiEnclosure = activeEncCount > 1;

  // Excel uses the displayed (2-decimal) max discharge time in the flow×time requirement.
  const t_design_display_min = round2(Math.max(0, td_highest_est_min || 0));

  const Wreq_zone_excel_SCF = isMultiEnclosure
    ? QN2_zone_SCFM * t_design_display_min
    : Wreq_zone_SCF;

  // 4.4: Compute zone-level provided nitrogen (bulk tubes OR cylinders) and resulting flow time
  let Wprov_zone_SCF = 0;
  let t_flow_zone_min = 0;

  if (bulkOn) {
    // Required open time = highest enclosure estimated discharge time (2 decimals)
    const requiredOpenMin = t_design_display_min;

    const isEditingOpen = !!zone._editBulkValveOpenTimeMin;

    const userOpenRaw = Number(zone.bulkValveOpenTimeMin);
    const userOpen = Number.isFinite(userOpenRaw)
      ? userOpenRaw
      : requiredOpenMin;

    // If user edits, we clamp to at least required time (matches intent of sheet)
    const tOpen = round2(
      isEditingOpen ? Math.max(requiredOpenMin, userOpen) : requiredOpenMin
    );

    // Persist both for UI (always 2 decimals)
    zone.bulkValveOpenTimeMinRequired = requiredOpenMin;
    zone.bulkValveOpenTimeMin = tOpen;

    const capPerTube = getBulkTubeCapacityPerTubeSCF(sys);
    // IMPORTANT:
    // Use Excel-aligned required SCF for tube count so the "tube qty" matches the sheet
    const tubesMin = minBulkTubesRequired(Wreq_zone_excel_SCF, capPerTube);
    const bulkCapSCF = tubesMin * capPerTube;

    // What we could deliver if the bulk valve stays open for tOpen
    const idealDeliverable = QN2_zone_SCFM * tOpen;

    // Provided nitrogen is limited by tube storage capacity
    Wprov_zone_SCF = Math.min(idealDeliverable, bulkCapSCF);

    // Actual flow time based on what was provided
    t_flow_zone_min = QN2_zone_SCFM > 0 ? Wprov_zone_SCF / QN2_zone_SCFM : 0;

    // Persist for UI/BOM
    zone.minTotalTubes = tubesMin;
  } else {
    // Cylinder mode: provided nitrogen is based on total cylinder capacity (SCF)
    Wprov_zone_SCF = cyl_final * caps.total;
    t_flow_zone_min = QN2_zone_SCFM > 0 ? Wprov_zone_SCF / QN2_zone_SCFM : 0;
  }

  // Zone-level: delivered vs required (Excel-aligned requirement)
  if (Wprov_zone_SCF + 1e-6 < Wreq_zone_excel_SCF) {
    messages.push(
      statusFromCode(
        "ZONE.N2_NOT_MET",
        { systemId: sys.id, zoneId: zone.id },
        {
          provided: Math.round(Wprov_zone_SCF),
          required: Math.round(Wreq_zone_excel_SCF),
          bulkOn,
        }
      )
    );
  }

  // Enclosure-level: allocation vs enclosure requirement (still use each enclosure’s own Qreq)
  for (const r of calcRows) {
    const propRaw = QN2_zone_SCFM > 0 ? r.Q_flow_enc_SCFM / QN2_zone_SCFM : 0;
    const pflow = Math.round(propRaw * 10000) / 10000; // legacy behavior: 4 decimals

    const WN2_enc_SCF = Wprov_zone_SCF * pflow;

    if (WN2_enc_SCF + 1e-6 < r.Qreq_enc_SCF) {
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

  // O2 per enclosure + expose UI fields using zone provided SCF and zone flow SCFM
  const { encsOut } = computePerEnclosureO2AndExpose(p, sys, zone, rows, {
    Wprov_zone_SCF,
    QN2_zone_SCFM,
  });

  // 4.5.2 Water + tank requirement for this zone (uses actual flow time derived above)
  const water = computeZoneWaterAndTank(p, sys, encsOut, t_flow_zone_min);

  // Panel sizing: group by operating pressure (one panel group per unique op PSI)
  const flowByPSI = new Map<number, number>();
  for (const r of rows) {
    if (isCalcRow(r) && r.opPSI > 0) {
      flowByPSI.set(r.opPSI, (flowByPSI.get(r.opPSI) || 0) + r.Q_flow_enc_SCFM);
    }
  }

  const panelGroups = Array.from(flowByPSI.entries())
    .sort((a, b) => b[0] - a[0]) // higher PSI first
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

  return {
    ...zone,
    enclosures: encsOut,

    // ✅ Excel-aligned required nitrogen; delivered is computed from tubes/cylinders above
    totalNitrogenRequired_scf: round2(Wreq_zone_excel_SCF) as any,
    totalNitrogenDelivered_scf: round2(Wprov_zone_SCF) as any,

    // Cylinder vs bulk outputs
    minTotalCylinders: bulkOn ? 0 : cyl_final,
    ...(bulkOn ? { minTotalTubes: zone.minTotalTubes } : {}),

    // Peak flow (SCFM) and water outputs
    q_n2_peak_scfm: QN2_zone_SCFM as any,
    water_peak_gpm: water.qWaterPeak_GPM as any,
    waterDischarge_gal: water.zoneWaterDischarge_GAL as any,
    waterTankMin_gal: water.zoneTankMin_GAL as any,

    // Panels + design label
    ...({
      panelSizing,
      panelSizingByPressure,
      designLabel: "spec_hazards",
    } as any),
  };
}

/** ─────────────────────────────────────────────────────────────
 *  ZONE CALC (LEGACY: FM DC / TURBINES / MACHINE SPACES)
 *  ────────────────────────────────────────────────────────────*/
function calcZone_Legacy(
  project: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const encs = zone.enclosures ?? [];
  if (encs.length === 0) return zone;

  const acf = ACF_BY_ELEVATION[project.elevation] ?? 1.0;
  const opts = asEngineeredOptions(sys);
  // Working row for legacy path
  type RowOut = {
    enc: Enclosure;
    Vreq_scf: number;
    emitters: number;
    qNoz: number;
    qWaterNoz: number;
    qTotal: number;
    qWaterTotal: number;
    T_K: number;
    opPSI: number;
    V_ft3: number;
  };

  // 1) Build rows
  const rows: RowOut[] = encs.map((e) => {
    const method = e.method;
    const T_K = tempToKelvin(project, Number(e.tempF) || 70);
    const tCorr = T_STD_K / T_K;
    const V_ft3 = volToFt3(project, Number(e.volume) || 0);
    const opPSI = getNozzleOpPSI(e);

    let emitters = 0;
    let qNoz = getNozzleFlowSCFM(e);
    let qWaterNoz = getNozzleWaterGPM(e);
    let Vreq_scf = 0;

    if (method === "FM Turbines" || method === "FM Machine Spaces") {
      if (!qNoz) qNoz = 150;
      if (!qWaterNoz) qWaterNoz = 1.06;
      emitters = Math.max(0, estimateFMTMSEmitters(project, e));
      const t_design =
        method === "FM Turbines" ? 10 + (opts.rundownTimeMin || 0) : 10;
      Vreq_scf = emitters * qNoz * t_design;
    } else {
      const ff = FLOODING_FACTOR[method] ?? 0.375;
      Vreq_scf = V_ft3 * tCorr * acf * ff * SAFETY_FACTOR;
      emitters = 0; // emitters will be set from qNoz proportion below
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
      opPSI,
    };
  });

  // 2) Cylinders & time for legacy methods
  const anyMethod = encs[0].method;
  const caps = getCylinderCaps(anyMethod, sys.options.fillPressure);
  const W_zone_req = rows.reduce((s, r) => s + r.Vreq_scf, 0);
  const minCylBase = Math.max(0, Math.ceil(W_zone_req / caps.total));
  const minCylEff = hasCustomCyl(zone) ? getCustomCyl(zone) : minCylBase;
  const bulkOn = !!opts?.bulkTubes;

  if (!bulkOn && hasCustomCyl(zone)) {
    pushNote(zone.enclosures[0], "Custom cylinder count applied.");
    messages.push(
      statusFromCode(
        "ZONE.CUSTOM_CYLINDERS",
        { systemId: sys.id, zoneId: zone.id },
        { actual: minCylEff, recommended: minCylBase }
      )
    );
  }

  const t_design_zone =
    anyMethod === "FM Turbines"
      ? 10 + (opts.rundownTimeMin || 0)
      : anyMethod === "FM Machine Spaces"
        ? 10
        : anyMethod === "FM Data Centers"
          ? 3.5
          : opts.rundownTimeMin && opts.rundownTimeMin > 0
            ? opts.rundownTimeMin
            : 3;

  // 3) Emitters allocation (for non-FM-T/M/S use proportional flow logic)
  const totalVolFt3 = encs.reduce(
    (s, e) => s + volToFt3(project, Number(e.volume) || 0),
    0
  );
  const rowsSized = rows.map((r) => {
    let emittersComputed = r.emitters;
    const isFM_TMS =
      r.enc.method === "FM Turbines" || r.enc.method === "FM Machine Spaces";

    let emittersFinal: number;
    if (isFM_TMS) {
      emittersFinal = clampInt(emittersComputed, 0);
    } else {
      const EF = totalVolFt3 > 0 ? r.V_ft3 / totalVolFt3 : 0;
      const Q_req = ((minCylEff * caps.usable) / (t_design_zone || 1)) * EF;

      const isFMDC = r.enc.method === "FM Data Centers";
      const emittersRaw = r.qNoz > 0 ? Q_req / r.qNoz : 0;
      emittersFinal = isFMDC ? Math.floor(emittersRaw) : Math.ceil(emittersRaw);
      emittersFinal = clampInt(emittersFinal, 0);
    }
    if (hasCustomEmitters(r.enc) && emittersFinal != emittersComputed) {
      pushNote(r.enc, "Custom nozzle count applied.");
      emittersFinal = getCustomEmitters(r.enc);
      messages.push(
        statusFromCode(
          "ENC.CUSTOM_NOZZLES",
          { systemId: sys.id, zoneId: zone.id, enclosureId: r.enc.id },
          { name: r.enc.name, final: emittersFinal, calc: emittersComputed }
        )
      );
    }
    const qTotal = emittersFinal * (r.qNoz || 0);
    const qWaterTotal = emittersFinal * (r.qWaterNoz || 0);
    return { ...r, emitters: emittersFinal, qTotal, qWaterTotal };
  });

  // 4) Zone totals + FM DC min time check
  const zoneTotalFlowSCFM = rowsSized.reduce((s, r) => s + r.qTotal, 0);

  let t_actual = 0;
  let zoneTotalNitrogenSCF_Total = 0;
  const isFMTMS =
    anyMethod === "FM Turbines" || anyMethod === "FM Machine Spaces";

  if (bulkOn) {
    pushNote(zone.enclosures[0], "Bulk Tube Design");

    const requiredOpenMin = round2(Math.max(0, t_design_zone || 0));

    const isEditingOpen = !!zone._editBulkValveOpenTimeMin;

    const userOpenRaw = Number(zone.bulkValveOpenTimeMin);
    const userOpen = Number.isFinite(userOpenRaw)
      ? userOpenRaw
      : requiredOpenMin;

    const tOpen = round2(
      isEditingOpen ? Math.max(requiredOpenMin, userOpen) : requiredOpenMin
    );

    zone.bulkValveOpenTimeMinRequired = requiredOpenMin;
    zone.bulkValveOpenTimeMin = tOpen;
  } else {
    t_actual =
      zoneTotalFlowSCFM > 0 ? (minCylEff * caps.usable) / zoneTotalFlowSCFM : 0;
    zoneTotalNitrogenSCF_Total = minCylEff * caps.total;
  }

  // Panel grouping by operating pressure (legacy path too)
  const flowByPSI = new Map<number, number>();
  for (const r of rowsSized) {
    if (r.opPSI > 0) {
      flowByPSI.set(r.opPSI, (flowByPSI.get(r.opPSI) || 0) + r.qTotal);
    }
  }
  const panelGroups = Array.from(flowByPSI.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([psi, flow]) => ({ psi, ...sizePanelsFromZoneFlow(sys, flow) }));
  const panelQtyTotal = panelGroups.reduce((s, g) => s + g.qty, 0);
  const panelSizing = {
    bore: (panelGroups[0]?.bore ?? "1in") as "1in" | "1.5in",
    capacity: panelGroups[0]?.capacity ?? 0,
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
        { psiList: psiList }
      )
    );
  }

  if (anyMethod === "FM Data Centers" && t_actual > 0 && t_actual < 3.5) {
    messages.push(
      statusFromCode(
        "ENC.FMDC_MIN_DISCHARGE",
        { systemId: sys.id, zoneId: zone.id },
        { t_actual: round2(t_actual) }
      )
    );
  }

  // 5) Water & O2 per enclosure
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

    const extra: any = {
      qWater_gpm: round3(r.qWaterNoz || 0),
      qWaterTotal_gpm: round3(r.qWaterTotal || 0),
      estWater_gal: round2(wWaterEncGal),
    };

    const isFM_TMS2 =
      r.enc.method === "FM Turbines" || r.enc.method === "FM Machine Spaces";

    // GPM-based cartridge label
    const flowLabel = r.qWaterNoz > 0 ? `${round2(r.qWaterNoz)} GPM` : "—";

    return {
      ...r.enc,
      minEmitters: r.emitters,
      estDischarge: isFM_TMS2
        ? `${t_design_zone} min`
        : `${round2(t_actual)} min`,
      estFinalO2: Number.isFinite(o2) && o2 > 0 ? `${round2(o2)} %` : "—",
      flowCartridge: flowLabel, // ← now GPM-based
      ...extra,
    } as Enclosure;
  });

  // 6) Zone tank min with pipe volume safety
  const pipeVolGal = pipeVolumeToGallons(project, opts.estimatedPipeVolume);
  const zoneTankMinGal = (zoneWaterDischargeGal + pipeVolGal) * SAFETY_FACTOR;

  // 7) Design label selection for UI hints
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
    designLabel = "spec_hazards";
  }
  const zoneNitrogenRequired_scf = W_zone_req;

  const zoneNitrogenDelivered_scf = bulkOn
    ? zoneTotalNitrogenSCF_Total
    : minCylEff * caps.usable; // IMPORTANT: usable, not total

  return {
    ...zone,
    enclosures: encsOut,

    // ✅ keep meaning consistent with NFPA-forward:
    totalNitrogenRequired_scf: round2(zoneNitrogenRequired_scf) as any,
    totalNitrogenDelivered_scf: round2(zoneNitrogenDelivered_scf) as any,

    minTotalCylinders: bulkOn ? 0 : minCylEff,
    ...(bulkOn ? { minTotalTubes: zone.minTotalTubes } : {}),

    q_n2_peak_scfm: round2(zoneTotalFlowSCFM) as any,
    water_peak_gpm: round2(zoneWaterPeakGPM) as any,
    waterDischarge_gal: zoneWaterDischargeGal as any,
    waterTankMin_gal: zoneTankMinGal as any,
    ...({ panelSizing, panelSizingByPressure, designLabel } as any),
  };
}

/** ─────────────────────────────────────────────────────────────
 *  SYSTEM CALC (PER SYSTEM): PICK ZONE PATHS, TANK, ESTIMATES, TOTALS
 *  ────────────────────────────────────────────────────────────*/
function calcSystem_TotalFloodNFPA(
  project: Project,
  sys: System,
  messages: StatusInput[]
): System {
  if (sys.options.kind !== "engineered") return sys; // or throw

  // 1) Zone-by-zone: choose forward (A/C or B only) vs legacy
  const zones = sys.zones.map((z) => {
    const hasACorB = (z.enclosures ?? []).some((e) => isNFPA_AC_or_B(e.method));
    const hasOnlyACorB = (z.enclosures ?? []).every((e) =>
      isNFPA_AC_or_B(e.method)
    );
    return hasACorB && hasOnlyACorB
      ? calcZone_TotalFloodNFPA(project, sys, z, messages)
      : calcZone_Legacy(project, sys, z, messages);
  });

  // 2) Water tank selection (strict matching to chosen certification)
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

  // Recompute FACP using fresh numbers
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

  // 4) System totals for UI summary
  const nums = {
    cylMax: 0,
    cylZoneId: null as string | null,
    n2Max: 0,
    n2ZoneId: null as string | null,
    panelsSum: 0,
    flowSum: 0,
    waterTankMax: 0,
    waterTankZoneId: null as string | null,
    waterReqMax: 0,
    n2ReqMax: 0,
    n2DelMax: 0,
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
      nums.n2ZoneId = z.id; // governing based on required
    }
    const tubes = Math.max(0, Number(z.minTotalTubes || 0));
    if (tubes > nums.tubeMax) {
      nums.tubeMax = tubes;
      nums.tubeZoneId = z.id;
    }
    // optional: track delivered max separately (useful for bulk cases)
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
    totalBulkTubes: bulkSelected ? nums.tubeMax : 0, // optional but useful

    // NEW: split required vs delivered
    totalNitrogenRequired_scf: Math.round(nums.n2ReqMax),
    totalNitrogenDelivered_scf: Math.round(nums.n2DelMax),

    // keep old field if other UI depends on it (optional, but handy during transition)
    totalNitrogen_scf: Math.round(nums.n2ReqMax),

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
      ? calcSystem_TotalFloodNFPA(p, sys, messages) // engineered systems are fully re-computed
      : sys
  );
  return { project: { ...p, systems }, messages };
}
