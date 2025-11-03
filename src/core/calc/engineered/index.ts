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

import type { Codes } from "@/core/catalog/parts.constants";
/** ─────────────────────────────────────────────────────────────
 *  Constants & shared helpers (kept from legacy)
 *  ────────────────────────────────────────────────────────────*/
type Num = number;

const T_STD_K = 294.4;
const SAFETY_FACTOR = 1.2;
const FT3_PER_M3 = 35.3147;
const O2_REQ_PCT = 13.36; // if O2 <= 13.36% → N2 requirement met

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
  return project.units === "metric" ? n * GAL_PER_LITER : n;
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

/** Use the user value when editValues=true; otherwise use computed. */
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

/** Component-driven FACP point estimator for Engineered systems (kept). */
function estimateFacpTotalsFromDesign(sys: System): FacpTotals {
  const optsAny = sys.options as any;
  const est = (optsAny.estimates ?? {}) as Partial<EngineeredEstimates>;
  const bulk = !!optsAny.bulkTubes;

  const totalPanels = sys.zones.reduce((s, z) => {
    const q = (z as any).panelSizing?.qty;
    return s + (typeof q === "number" ? q : 0);
  }, 0);

  const panelStyle: "ar" | "dc" =
    (sys.zones.find((z) => (z as any).panelSizing?.style)?.panelSizing?.style ??
      optsAny.panelStyle) === "dc"
      ? "dc"
      : "ar";

  const primaries = bulk ? 0 : Math.max(0, est.primaryReleaseAssemblies ?? 0);
  const batteries = Math.max(0, est.batteryBackups ?? 0);
  const waterTankPresent = !!optsAny.waterTankPick;

  let supervisory = 0;
  let alarm = 0;
  let releasing = 0;

  supervisory += totalPanels; // Panel Fault
  alarm += totalPanels; // Panel Discharge
  if (panelStyle === "dc") releasing += totalPanels;

  supervisory += primaries * 2; // coil tamper + low pressure
  releasing += primaries * 1; // solenoid

  supervisory += totalPanels * 1; // water ISO
  supervisory += totalPanels * 1; // N2 ISO

  supervisory += batteries * 2;

  if (waterTankPresent) supervisory += 1;

  if (bulk) releasing = Math.max(releasing, 1);

  return { supervisory, alarm, releasing };
}

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
 *  NEW: Chapter 4 forward-flow for NFPA 770 Class A/C & B
 *  ────────────────────────────────────────────────────────────*/
function isNFPA_AC_or_B(m: string) {
  return m === "NFPA 770 Class A/C" || m === "NFPA 770 Class B";
}
function designDischargeLimitMin(): number {
  // Manual: 3 min max (default target).
  return 3;
}
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

// put these right under your ForwardRow type
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
  emitters_calc: number;
  emitters_final: number;
  Q_flow_enc_SCFM: number;
  t_est_min: number;
};

type ForwardRow = { skip: true; enc: Enclosure } | CalcRow;

function isCalcRow(r: ForwardRow): r is CalcRow {
  return r.skip === false;
}

function forwardPerEnclosureTotals(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): ForwardRow[] {
  const acf = ACF_BY_ELEVATION[p.elevation] ?? 1.0;
  const t_design = designDischargeLimitMin();

  return (zone.enclosures ?? []).map((enc) => {
    if (!isNFPA_AC_or_B(enc.method)) {
      return { enc, skip: true } as const;
    }

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

    const Qreq_flow_SCFM = enclosureFlowReq_SCFM(Qreq_enc_SCF, t_design);
    const emitters_calc = requiredEmittersForEnclosure(
      Qreq_flow_SCFM,
      qNoz_SCFM
    );

    const emitters_final = hasCustomEmitters(enc)
      ? getCustomEmitters(enc)
      : emitters_calc;

    if (hasCustomEmitters(enc) && emitters_final < emitters_calc) {
      messages.push({
        severity: "warn",
        code: "ENC.CUSTOM_EMITTERS",
        text: `Custom emitters below computed minimum for "${enc.name || "Enclosure"}": ${emitters_final} (calc: ${emitters_calc}).`,
        systemId: sys.id,
        zoneId: zone.id,
        enclosureId: enc.id,
      });
    }

    const Q_flow_enc_SCFM = emitters_final * qNoz_SCFM;
    const t_est = estimatedTdForEnclosure(Qreq_enc_SCF, Q_flow_enc_SCFM);

    if (t_est > t_design + 1e-6) {
      messages.push({
        severity: "error",
        code: "ENC.DISCHARGE_TIME_EXCEEDS",
        text: `Estimated discharge time ${round2(t_est)} min exceeds ${t_design} min for "${enc.name || "Enclosure"}". Increase emitters or nozzle flow.`,
        systemId: sys.id,
        zoneId: zone.id,
        enclosureId: enc.id,
      });
    }

    return {
      enc,
      skip: false,
      V_ft3,
      T_K,
      acf,
      ff,
      Qreq_enc_SCF: round3(Qreq_enc_SCF),
      qNoz_SCFM: round3(qNoz_SCFM),
      qWater_GPM: round3(qWater_GPM),
      emitters_calc,
      emitters_final,
      Q_flow_enc_SCFM: round3(Q_flow_enc_SCFM),
      t_est_min: round2(t_est),
    } as const;
  });
}

function sizeCylindersFromZoneNeed(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ForwardRow[]
) {
  const calcRows = rows.filter(isCalcRow);
  const W_zone_req_SCF = calcRows.reduce((s, r) => s + r.Qreq_enc_SCF, 0);

  const fillPressure =
    (sys.options as any).fillPressure || "3000 PSI/206.8 BAR";
  const caps =
    CYL_CAP_DEFAULT[fillPressure] ?? CYL_CAP_DEFAULT["3000 PSI/206.8 BAR"];

  const minCylinders = Math.max(
    0,
    Math.ceil(W_zone_req_SCF / Math.max(1, caps.total))
  );

  const useCustom = hasCustomCyl(zone);
  const cyl_final = useCustom ? getCustomCyl(zone) : minCylinders;

  return {
    W_zone_req_SCF: round2(W_zone_req_SCF),
    caps,
    minCylinders,
    cyl_final,
  };
}

function computePerEnclosureO2AndExpose(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ForwardRow[],
  cyl_final: number,
  caps: { usable: number; total: number }
) {
  const calcRows = rows.filter(isCalcRow);
  const zoneTotalFlow_SCFM = calcRows.reduce(
    (s, r) => s + r.Q_flow_enc_SCFM,
    0
  );

  const encsOut: Enclosure[] = rows.map((r) => {
    if (!isCalcRow(r)) return r.enc;

    const prop =
      zoneTotalFlow_SCFM > 0 ? r.Q_flow_enc_SCFM / zoneTotalFlow_SCFM : 0;
    const Vn2_forO2_SCF = cyl_final * caps.total * prop;

    const o2_final = computeO2Percent({
      Vn2_scf: Vn2_forO2_SCF,
      Venc_ft3: r.V_ft3,
      T_K: r.T_K,
      acf: r.acf,
    });

    return {
      ...r.enc,
      minEmitters: r.emitters_final,
      estDischarge: `${round2(r.t_est_min)} min`,
      estFinalO2: Number.isFinite(o2_final) ? `${round2(o2_final)} %` : "—",
      qWater_gpm: r.qWater_GPM,
      qWaterTotal_gpm: round3(r.qWater_GPM * r.emitters_final),
    } as Enclosure;
  });

  return {
    encsOut,
    zoneTotalFlow_SCFM: round2(zoneTotalFlow_SCFM),
  };
}

function computeZoneWaterAndTank(
  p: Project,
  sys: System,
  encsOut: Enclosure[],
  t_flow_zone_min: number
) {
  const qWaterPeak_GPM = sum(
    encsOut,
    (e) => Number((e as any).qWaterTotal_gpm) || 0
  );
  const zoneWaterDischarge_GAL = qWaterPeak_GPM * t_flow_zone_min;

  const pipeVolGal = pipeVolumeToGallons(
    p,
    (sys.options as any).estimatedPipeVolume
  );

  const zoneTankMin_GAL = (zoneWaterDischarge_GAL + pipeVolGal) * SAFETY_FACTOR;

  return {
    qWaterPeak_GPM: round2(qWaterPeak_GPM),
    zoneWaterDischarge_GAL: round2(zoneWaterDischarge_GAL),
    zoneTankMin_GAL: round2(zoneTankMin_GAL),
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
  const bore: "1in" | "1.5in" = zoneTotalFlow_SCFM <= 1800 ? "1in" : "1.5in";
  const capacity = bore === "1in" ? 1800 : 4500;
  const qty =
    zoneTotalFlow_SCFM > 0 ? Math.ceil(zoneTotalFlow_SCFM / capacity) : 0;
  const style: "ar" | "dc" = (
    (sys.options as any).panelStyle === "dc" ? "dc" : "ar"
  ) as any;
  return { bore, capacity, qty, style };
}

function calcZone_TotalFloodNFPA(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const encs = zone.enclosures ?? [];
  if (encs.length === 0) return zone;

  // 4.1 → 4.2 (per enclosure)
  const rows = forwardPerEnclosureTotals(p, sys, zone, messages);

  // 4.3 (cylinders from summed N2)
  const { W_zone_req_SCF, caps, minCylinders, cyl_final } =
    sizeCylindersFromZoneNeed(p, sys, zone, rows);

  if (hasCustomCyl(zone) && cyl_final < minCylinders) {
    messages.push({
      severity: "warn",
      code: "ZONE.CUSTOM_CYLINDERS",
      text: `Custom cylinders below computed minimum: ${cyl_final} (calc: ${minCylinders}).`,
      systemId: sys.id,
      zoneId: zone.id,
    });
  }

  // 4.4 (O2 per enclosure; expose)
  const { encsOut, zoneTotalFlow_SCFM } = computePerEnclosureO2AndExpose(
    p,
    sys,
    zone,
    rows,
    cyl_final,
    caps
  );

  // ---------- N2 requirement check (Chapter 4) ----------
  const calcRows = rows.filter((r) => r.skip === false) as any[];
  const zoneFlow = calcRows.reduce((s, r) => s + r.Q_flow_enc_SCFM, 0);

  // Delivered N2 per enclosure by flow proportion using TOTAL capacity (§4.4.2)
  const deliveredByEnc: Record<string, number> = {};
  for (const r of calcRows) {
    const pflow = zoneFlow > 0 ? r.Q_flow_enc_SCFM / zoneFlow : 0;
    deliveredByEnc[r.enc.id] = cyl_final * caps.total * pflow;
  }

  for (const r of calcRows) {
    const encId = r.enc.id;
    const delivered = deliveredByEnc[encId] || 0;
    const required = r.Qreq_enc_SCF;

    // find the outbound enc object to mutate discharge display
    const outEnc = encsOut.find((e) => e.id === encId);

    // parse estFinalO2 like "13.2 %" → 13.2
    const o2pct = outEnc?.estFinalO2
      ? Number(String(outEnc.estFinalO2).replace(/[^\d.]/g, ""))
      : NaN;

    // N2 not met if either delivered < required OR O2 > 13.36%
    const n2NotMet =
      delivered + 1e-6 < required ||
      (Number.isFinite(o2pct) && o2pct > O2_REQ_PCT);

    if (n2NotMet) {
      // Send a status-bar WARNING
      messages.push({
        severity: "warn",
        code: "ENC.N2_NOT_MET",
        systemId: sys.id,
        zoneId: zone.id,
        enclosureId: encId,
        text:
          `Nitrogen requirement not met for "${r.enc.name || "Enclosure"}". ` +
          `Delivered ≈ ${Math.round(delivered)} SCF, required ≈ ${Math.round(required)} SCF. ` +
          `Design discharge time is invalid. ` +
          `Try reducing the enclosure nozzle size or increasing the number of cylinders.`,
      });

      // Show "-" in discharge time for this enclosure
      if (outEnc) {
        (outEnc as any).estDischarge = "-";
      }
    }
  }

  // 4.5.1 flow time: t_flow = N_cyl * Q_con / Q_flow_zone
  const t_flow_zone_min =
    zoneTotalFlow_SCFM > 0 ? (cyl_final * caps.total) / zoneTotalFlow_SCFM : 0;

  // 4.5.2 water + tank
  const water = computeZoneWaterAndTank(p, sys, encsOut, t_flow_zone_min);

  // 4.7 panel sizing
  const panelSizing = sizePanelsFromZoneFlow(sys, zoneTotalFlow_SCFM);

  return {
    ...zone,
    enclosures: encsOut,
    totalNitrogen:
      W_zone_req_SCF > 0
        ? `${Math.round(W_zone_req_SCF).toLocaleString()} SCF`
        : "—",
    minTotalCylinders: cyl_final,

    q_n2_peak_scfm: zoneTotalFlow_SCFM as any,
    water_peak_gpm: water.qWaterPeak_GPM as any,
    waterDischarge_gal: water.zoneWaterDischarge_GAL as any,
    waterTankMin_gal: water.zoneTankMin_GAL as any,

    ...({ panelSizing, designLabel: "spec_hazards" } as any),
  };
}

/** ─────────────────────────────────────────────────────────────
 *  Legacy zone calc retained for FM paths (unchanged behavior)
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

  type RowOut = {
    enc: Enclosure;
    Vreq_scf: number;
    emitters: number;
    qNoz: number;
    qWaterNoz: number;
    qTotal: number;
    qWaterTotal: number;
    T_K: number;
    V_ft3: number;
  };

  const rows: RowOut[] = encs.map((e) => {
    const method = e.method;
    const T_K = round3(tempToKelvin(project, Number(e.tempF) || 70));
    const tCorr = round3(T_STD_K / T_K);
    const V_ft3 = volToFt3(project, Number(e.volume) || 0);

    let emitters = 0;
    let qNoz = getNozzleFlowSCFM(e);
    let qWaterNoz = getNozzleWaterGPM(e);
    let Vreq_scf = 0;

    if (method === "FM Turbines" || method === "FM Machine Spaces") {
      if (!qNoz) qNoz = 150;
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
    let emittersComputed = r.emitters;
    const isFM_TMS =
      r.enc.method === "FM Turbines" || r.enc.method === "FM Machine Spaces";

    let emittersFinal: number;

    if (hasCustomEmitters(r.enc)) {
      emittersFinal = getCustomEmitters(r.enc);
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
      emittersFinal = clampInt(emittersComputed, 0);
    } else {
      const EF = totalVolFt3 > 0 ? r.V_ft3 / totalVolFt3 : 0;
      const Q_req = ((minCylEff * caps.usable) / (t_design_zone || 1)) * EF;

      const isFMDC = r.enc.method === "FM Data Centers";
      const emittersRaw = r.qNoz > 0 ? Q_req / r.qNoz : 0;
      emittersFinal = isFMDC ? Math.floor(emittersRaw) : Math.ceil(emittersRaw);
      emittersFinal = clampInt(emittersFinal, 0);
    }

    const qTotal = emittersFinal * (r.qNoz || 0);
    const qWaterTotal = emittersFinal * (r.qWaterNoz || 0);

    return { ...r, emitters: emittersFinal, qTotal, qWaterTotal };
  });

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

    const extra: any = {
      qWater_gpm: round3(r.qWaterNoz || 0),
      qWaterTotal_gpm: round3(r.qWaterTotal || 0),
      estWater_gal: round2(wWaterEncGal),
    };

    const isFM_TMS =
      r.enc.method === "FM Turbines" || r.enc.method === "FM Machine Spaces";

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

  const pipeVolGal = pipeVolumeToGallons(
    project,
    (sys.options as any).estimatedPipeVolume
  );
  const zoneTankMinGal = (zoneWaterDischargeGal + pipeVolGal) * SAFETY_FACTOR;

  const rawFlow = Math.max(0, zoneTotalFlowSCFM);
  const bore: "1in" | "1.5in" = rawFlow <= 1800 ? "1in" : "1.5in";
  const capacity = bore === "1in" ? 1800 : 4500;
  const qty = rawFlow > 0 ? Math.ceil(rawFlow / capacity) : 0;
  const style: "ar" | "dc" = (
    (sys.options as any).panelStyle === "dc" ? "dc" : "ar"
  ) as any;

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

  return {
    ...zone,
    enclosures: encsOut,
    totalNitrogen:
      W_zone_req > 0 ? `${Math.round(W_zone_req).toLocaleString()} SCF` : "—",
    minTotalCylinders: minCylEff,

    q_n2_peak_scfm: round2(zoneTotalFlowSCFM) as any,
    water_peak_gpm: round2(zoneWaterPeakGPM) as any,
    waterDischarge_gal: round2(zoneWaterDischargeGal) as any,
    waterTankMin_gal: round2(zoneTankMinGal) as any,
    ...({ panelSizing: { bore, capacity, qty, style }, designLabel } as any),
  };
}

/** ─────────────────────────────────────────────────────────────
 *  System-level calc: use new forward flow for A/C & B; legacy for others
 *  ────────────────────────────────────────────────────────────*/
function calcSystem_TotalFloodNFPA(
  project: Project,
  sys: System,
  messages: StatusInput[]
): System {
  const zones = sys.zones.map((z) => {
    const hasACorB = (z.enclosures ?? []).some((e) => isNFPA_AC_or_B(e.method));
    const hasOnlyACorB = (z.enclosures ?? []).every((e) =>
      isNFPA_AC_or_B(e.method)
    );
    // If zone is purely A/C or B → forward Chapter 4; else → legacy
    return hasACorB && hasOnlyACorB
      ? calcZone_TotalFloodNFPA(project, sys, z, messages)
      : calcZone_Legacy(project, sys, z, messages);
  });

  // ── WATER TANK SELECTION (system-level, strict) ─────────────────────
  const zoneNeeds = zones
    .map((z) => Number((z as any).waterTankMin_gal) || 0)
    .filter((g) => g > 0);
  const maxReqGal = zoneNeeds.length ? Math.max(...zoneNeeds) : 0;

  const optsAny = { ...(sys.options as any) };
  const defaultCert: WaterTankCert =
    project.currency === "USD" ? "US_ASME_FM" : "CE_SS316L";
  const cert: WaterTankCert = optsAny.waterTankCertification ?? defaultCert;

  let pickCodes: Codes | null = null;
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

  optsAny.waterTankRequired_gal = maxReqGal;
  optsAny.waterTankCertification = cert;
  optsAny.waterTankPick = pickCodes
    ? { codes: pickCodes, description: pickDesc, cert }
    : null;

  // ── ENGINEERED ESTIMATES (kept; recomputed on new zones) ─────────────
  const maxCylAcrossZones = Math.max(
    0,
    ...zones.map((z) => Number(z.minTotalCylinders || 0))
  );
  const bulkEligible = true;
  optsAny.bulkTubesEligible = bulkEligible;

  const bulkSelected = !!optsAny.bulkTubes;
  const zonesForOutput = bulkSelected
    ? zones.map((z) => ({ ...z, minTotalCylinders: 0 }))
    : zones;

  const zonesUsed = zonesForOutput;

  const totalPanelQty = zonesUsed.reduce((s, z) => {
    const ps = (z as any).panelSizing as { qty: number } | undefined;
    return s + (ps?.qty ?? 0);
  }, 0);

  const styleUsed: "ar" | "dc" = (
    (sys.options as any).panelStyle === "dc" ? "dc" : "ar"
  ) as any;

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

  const editValues = !!optsAny.editValues;
  const prevEst = (optsAny.estimates ?? {}) as Partial<EngineeredEstimates>;

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

  // Points from design (panels, primaries, batteries, tank)
  const facp = estimateFacpTotalsFromDesign({ ...sys, zones: zonesUsed });
  const releasePoints = persistEditable(
    prevEst.releasePoints,
    facp.releasing,
    editValues
  );
  const monitorPoints = persistEditable(
    prevEst.monitorPoints,
    facp.supervisory + facp.alarm,
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

  return { ...sys, zones: zonesUsed, options: optsAny as any };
}

/** ─────────────────────────────────────────────────────────────
 *  Public API
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
