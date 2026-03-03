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
import { statusFromCode } from "@/core/status/error-codes";

import type { Codes } from "@/core/catalog/parts.constants";

/* -------------------------------------------------------------------------- */
/*                            CONSTANTS & HELPERS                             */
/* -------------------------------------------------------------------------- */
type Num = number;

const T_STD_K = 294.4; // Reference absolute temperature (K)
const SAFETY_FACTOR = 1.2; // Default safety factor
const FT3_PER_M3 = 35.3147; // Unit conversion

// Flooding factors by design method
const FLOODING_FACTOR: Record<Enclosure["designMethod"], Num> = {
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

// Unit helpers
function pipeVolumeToGallons(project: Project, v: number | undefined | null) {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return 0;

  return project.units === "metric"
    ? x * 0.264172 // L → gal
    : x; // already in gal
}

const clampInt = (n: any, min = 0) =>
  Math.max(min, Math.floor(Number.isFinite(+n) ? +n : 0));

// “Editable” toggles on enclosure/zone for user overrides
const hasCustomEmitters = (e: Enclosure) => {
  return e.isNozzleCountOverridden && e.customNozzleCount != null;
};
const getCustomEmitters = (e: Enclosure) => {
  const v = e.customNozzleCount;
  if (v == null) return 0;
  return clampInt(v, 0);
};
const hasCustomCyl = (z: Zone) =>
  !!z.isCylinderCountOverridden && z.customCylinderCount != null;
const getCustomCyl = (z: Zone) => {
  const v = z.customCylinderCount;
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
  const cap = Number(opts.bulkTubeCapacityScf || 11500);
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
function pushNote(enc: Enclosure | undefined, note: string) {
  if (!enc || !note) return;
  const arr = Array.isArray(enc.notes) ? enc.notes : (enc.notes = []);
  if (!arr.includes(note)) arr.push(note);
}

/* -------------------------------------------------------------------------- */
/*                              METHOD FAMILIES                               */
/* -------------------------------------------------------------------------- */
type MethodFamily = "NFPA" | "FMDC" | "FMTMS";

function methodFamily(m: Enclosure["designMethod"]): MethodFamily {
  if (m === "NFPA 770 Class A/C" || m === "NFPA 770 Class B") return "NFPA";
  if (m === "FM Data Centers") return "FMDC";
  // Merge Turbines + Machine Spaces as one family
  return "FMTMS";
}

function designTimeMinForFamily(
  sys: System,
  zone: Zone,
  fam: MethodFamily,
): number {
  if (fam === "NFPA") return 3;
  if (fam === "FMDC") return 3.5;

  // FMTMS: 10 + rundown (zone-level now)
  const rundown = Number(zone.rundownTimeMin) || 0;
  return 10 + rundown;
}

function cylinderCapsForFamily(fam: MethodFamily, fill: string) {
  const table = fam === "FMTMS" ? CYL_CAP_FMTMS : CYL_CAP_DEFAULT;
  return table[fill] ?? table["3000 PSI/206.8 BAR"];
}

/* -------------------------------------------------------------------------- */
/*                           EMITTER / NOZZLE LOOKUP                          */
/* -------------------------------------------------------------------------- */

// Estimation for FM Turbines / Machine Spaces (piecewise)
function estimateFMTMSEmitters(project: Project, enc: Enclosure): number {
  const vol_ft3 = volToFt3(project, Number(enc.volumeFt3) || 0);
  const vol_m3 =
    project.units === "metric"
      ? Number(enc.volumeFt3) || 0
      : vol_ft3 / FT3_PER_M3;
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
    const methodMap = (emitterConfigMap as any)[enc.designMethod];
    const nozzle = enc.nozzleModel ? methodMap?.[enc.nozzleModel] : undefined;
    const q = nozzle?.q_n2;
    return typeof q === "number" && q > 0 ? q : 0;
  } catch {
    return 0;
  }
}
export function getNozzleWaterGPM(enc: Enclosure): number {
  try {
    const methodMap = (emitterConfigMap as any)[enc.designMethod];
    const nozzle = enc.nozzleModel ? methodMap?.[enc.nozzleModel] : undefined;
    const q = nozzle?.q_water;
    return typeof q === "number" && q > 0 ? q : 0;
  } catch {
    return 0;
  }
}
function getNozzleOpPSI(enc: Enclosure): number {
  try {
    const methodMap = (emitterConfigMap as any)[enc.designMethod];
    const nozzle = enc.nozzleModel ? methodMap?.[enc.nozzleModel] : undefined;
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

/* -------------------------------------------------------------------------- */
/*                            USER ESTIMATE EDITS                             */
/* -------------------------------------------------------------------------- */
type EstKey = keyof EngineeredEstimates;

function useUserFor(sys: System, field: EstKey): boolean {
  const o: any = sys.options || {};
  return !!(o.estimateOverrides && o.estimateOverrides[field]);
}
function persistEditable(
  userValue: unknown,
  computed: number,
  edit: boolean,
): number {
  const n =
    typeof userValue === "number" && Number.isFinite(userValue)
      ? userValue
      : null;
  return edit ? (n ?? computed) : computed;
}

/* -------------------------------------------------------------------------- */
/*                                FACP TOTALS                                 */
/* -------------------------------------------------------------------------- */
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

  const panelStyle = (zonesUsed.find((z) => z.panelSizing?.style)?.panelSizing
    ?.style ?? opts.panelStyle) as "ar" | "dc";

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

/* -------------------------------------------------------------------------- */
/*                      PANEL / HOSE / RACK ESTIMATORS                        */
/* -------------------------------------------------------------------------- */
type ZoneLike = {
  id?: string;
  name?: string;
  requiredCylinderCount?: number | null;
};

function toPosInt(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
}
function ceilDiv(a: number, b: number): number {
  return b > 0 ? Math.ceil(a / b) : 0;
}

function buildBanksFromDiffs(uniqueSorted: number[], maxBankSize: number) {
  // banks that make each group a prefix sum
  const diffs = uniqueSorted.map((g, i) =>
    i === 0 ? g : g - uniqueSorted[i - 1],
  );
  const banks: number[] = [];
  for (const d of diffs) {
    if (d <= 0) continue;
    const full = Math.floor(d / maxBankSize);
    const rem = d % maxBankSize;
    for (let i = 0; i < full; i++) banks.push(maxBankSize);
    if (rem > 0) banks.push(rem);
    if (rem === 0 && full > 0) {
      // nothing
    } else if (rem === 0 && full === 0) {
      // d < maxBankSize handled by rem push
    }
  }
  return banks;
}

function buildBanksConstructive(maxCyl: number, maxBankSize: number) {
  const banks: number[] = [];
  let cumulative = 0;

  while (cumulative < maxCyl) {
    const remaining = maxCyl - cumulative;
    const next = Math.min(maxBankSize, cumulative + 1, remaining);
    if (next <= 0) break;
    banks.push(next);
    cumulative += next;

    if (banks.length > 2000) break; // guard rail
  }
  return banks;
}

function greedyPickBanks(banks: number[], target: number) {
  // stable greedy: largest -> smallest
  const picks: number[] = [];
  let remaining = target;

  for (let i = banks.length - 1; i >= 0; i--) {
    const size = banks[i];
    if (size <= remaining) {
      picks.push(i + 1); // 1-based index
      remaining -= size;
      if (remaining === 0) break;
    }
  }

  // If remaining != 0, target wasn’t achievable with these banks (should be rare if banks built sanely)
  return { picks: picks.sort((a, b) => a - b), remaining };
}

export function buildPrimariesPlanFromZones(
  zones: ZoneLike[],
  params: { bulkSelected: boolean; maxBankSize: number },
) {
  const { bulkSelected, maxBankSize } = params;

  const zoneCylinders = zones
    .map((z) => ({
      zoneId: String((z as any).id ?? ""),
      zoneName: String((z as any).name ?? ""),
      requiredCyl: toPosInt((z as any).requiredCylinderCount),
    }))
    .filter((z) => z.requiredCyl > 0);

  if (bulkSelected || zoneCylinders.length === 0) {
    return {
      maxBankSize,
      bulkSelected: true,
      zoneCylinders,
      groupsUniqueSorted: [],
      maxCyl: 0,
      calcPrimaries: 0,
      maxPrimaries: 0,
      primariesUsed: 0,
      methodUsed: "calc" as const,
      banks: [],
      releaseGroups: [],
    };
  }

  const groupsUniqueSorted = Array.from(
    new Set(zoneCylinders.map((z) => z.requiredCyl)),
  ).sort((a, b) => a - b);

  const maxCyl = groupsUniqueSorted[groupsUniqueSorted.length - 1];

  // Method 2: calc primaries from diffs
  let calcPrimaries = 0;
  for (let i = 0; i < groupsUniqueSorted.length; i++) {
    const diff =
      i === 0
        ? groupsUniqueSorted[0]
        : groupsUniqueSorted[i] - groupsUniqueSorted[i - 1];
    if (diff > 0) calcPrimaries += ceilDiv(diff, maxBankSize);
  }

  // Method 1: constructive
  const maxBanksSizes = buildBanksConstructive(maxCyl, maxBankSize);
  const maxPrimaries = maxBanksSizes.length;

  const methodUsed: "calc" | "max" =
    calcPrimaries <= maxPrimaries ? "calc" : "max";
  const primariesUsed = Math.min(calcPrimaries, maxPrimaries);

  // Choose bank sizing strategy based on chosen method
  const bankSizes =
    methodUsed === "calc"
      ? buildBanksFromDiffs(groupsUniqueSorted, maxBankSize)
      : maxBanksSizes;

  const banks = bankSizes.map((size, i) => ({ bankIndex: i + 1, size }));

  // Build release groups per zone
  const releaseGroups = zoneCylinders.map((z) => {
    if (methodUsed === "calc") {
      // prefix strategy: find which group index matches this requiredCyl
      const idx = groupsUniqueSorted.indexOf(z.requiredCyl);
      const prefixCount = (() => {
        // number of banks needed to reach that group in diff-built banks
        // easiest: walk sums
        let sum = 0;
        for (let i = 0; i < bankSizes.length; i++) {
          sum += bankSizes[i];
          if (sum >= z.requiredCyl) return i + 1;
        }
        return bankSizes.length;
      })();

      const bankIndices = Array.from({ length: prefixCount }, (_, i) => i + 1);
      const totalCyl = bankIndices.reduce(
        (s, bi) => s + (banks[bi - 1]?.size ?? 0),
        0,
      );

      return { ...z, bankIndices, totalCyl };
    }

    // methodUsed === "max": greedy subset pick
    const picked = greedyPickBanks(bankSizes, z.requiredCyl);
    const totalCyl = picked.picks.reduce(
      (s, bi) => s + (banks[bi - 1]?.size ?? 0),
      0,
    );

    return { ...z, bankIndices: picked.picks, totalCyl };
  });

  return {
    maxBankSize,
    bulkSelected,
    zoneCylinders,
    groupsUniqueSorted,
    maxCyl,
    calcPrimaries,
    maxPrimaries,
    primariesUsed,
    methodUsed,
    banks,
    releaseGroups,
  };
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

/* -------------------------------------------------------------------------- */
/*                         CORE CALCULATION EQUATIONS                         */
/* -------------------------------------------------------------------------- */
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
  qNoz_SCFM: Num,
): number {
  if (qNoz_SCFM <= 0) return 0;
  return Math.max(0, Math.ceil(Qreq_flow_SCFM / qNoz_SCFM));
}
function estimatedTdForEnclosure(Qreq_enc_SCF: Num, Q_flow_enc_SCFM: Num): Num {
  return Q_flow_enc_SCFM > 0 ? Qreq_enc_SCF / Q_flow_enc_SCFM : 0;
}

/* -------------------------------------------------------------------------- */
/*                            UNIFIED ZONE ROW                                */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*                              ROW BUILDERS                                  */
/* -------------------------------------------------------------------------- */
function buildRowsForwardLike(
  p: Project,
  sys: System,
  zone: Zone,
  fam: "NFPA" | "FMDC",
  messages: StatusInput[],
): ZoneRow[] {
  const acf = ACF_BY_ELEVATION[p.elevation] ?? 1.0;
  const t_design = designTimeMinForFamily(sys, zone, fam);

  return (zone.enclosures ?? []).map((enc) => {
    const V_ft3 = volToFt3(p, Number(enc.volumeFt3) || 0);
    const T_K = tempToKelvin(p, Number(enc.temperatureF) || 70);
    const ff = FLOODING_FACTOR[enc.designMethod] ?? 0.375;

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
          { name: enc.name, final: emitters_final, calc: emitters_calc },
        ),
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
          { name: enc.name, t_est: ceil2(t_est) },
        ),
      );
    }

    if (fam === "FMDC" && t_est > 0 && t_est < 3.5 - 1e-6) {
      messages.push(
        statusFromCode(
          "ENC.FMDC_MIN_DISCHARGE",
          { systemId: sys.id, zoneId: zone.id, enclosureId: enc.id },
          { t_actual: ceil2(t_est) }, // ceiling display
        ),
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
  messages: StatusInput[],
): ZoneRow[] {
  const acf = ACF_BY_ELEVATION[p.elevation] ?? 1.0;
  const t_design = designTimeMinForFamily(sys, zone, "FMTMS");

  return (zone.enclosures ?? []).map((enc) => {
    const V_ft3 = volToFt3(p, Number(enc.volumeFt3) || 0);
    const T_K = tempToKelvin(p, Number(enc.temperatureF) || 70);
    const ff = FLOODING_FACTOR[enc.designMethod] ?? 0.375;

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
          { name: enc.name, final: emitters_final, calc: emitters_calc },
        ),
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

/* -------------------------------------------------------------------------- */
/*                           SHARED ZONE SIZING                               */
/* -------------------------------------------------------------------------- */
function sizeStorageFromRows(
  p: Project,
  sys: System,
  zone: Zone,
  rows: ZoneRow[],
) {
  const opts = asEngineeredOptions(sys);
  const bulkOn = !!opts.usesBulkTubes;

  const QN2_zone_SCFM = rows.reduce((s, r) => s + r.Q_flow_enc_SCFM, 0);

  // controlling time = highest enclosure estimated discharge time
  const td_highest_est_min = rows.reduce(
    (m, r) => Math.max(m, r.t_est_min || 0),
    0,
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
  },
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
    const dischargeLabel = suppressDischargeTime
      ? "—"
      : r.t_est_min > 0
        ? `${ceil2(r.t_est_min)} min`
        : "—";

    return {
      ...r.enc,
      requiredNozzleCount: r.emitters_final,
      estimatedDischargeDuration: dischargeLabel,
      estimatedFinalOxygenPercent: Number.isFinite(o2_final)
        ? `${ceil2(o2_final)} %`
        : "—",
      flowCartridge: flowLabel,
      waterFlowRateGpm: r.qWater_GPM,
      totalWaterFlowRateGpm: r.qWater_GPM * r.emitters_final,
    } as Enclosure;
  });

  return { encsOut };
}

function computeZoneWaterAndTank(
  p: Project,
  zone: Zone,
  encsOut: Enclosure[],
  t_flow_zone_min: number,
) {
  const qWaterPeak_GPM = sum(
    encsOut,
    (e) => Number(e.totalWaterFlowRateGpm) || 0,
  );
  const zoneWaterDischarge_GAL = qWaterPeak_GPM * t_flow_zone_min;

  // UI shows gal/L; pipeVolumeToGallons converts metric L -> gal
  const pipeVolGal = pipeVolumeToGallons(p, zone.pipeVolumeGal);
  const zoneTankMin_GAL = (zoneWaterDischarge_GAL + pipeVolGal) * SAFETY_FACTOR;

  return {
    qWaterPeak_GPM,
    zoneWaterDischarge_GAL,
    zoneTankMin_GAL,
  };
}

function sizePanelsFromZoneFlow(
  sys: System,
  zoneTotalFlow_SCFM: number,
): {
  bore: "1in" | "1.5in";
  capacity: 1800 | 4500;
  qty: number;
  style: "ar" | "dc";
} {
  const opts = asEngineeredOptions(sys);

  const bore: "1in" | "1.5in" = zoneTotalFlow_SCFM <= 1800 ? "1in" : "1.5in";
  const capacity: 1800 | 4500 = bore === "1in" ? 1800 : 4500;
  const qty =
    zoneTotalFlow_SCFM > 0 ? Math.ceil(zoneTotalFlow_SCFM / capacity) : 0;
  const style: "ar" | "dc" = opts.panelStyle === "dc" ? "dc" : "ar";

  return { bore, capacity, qty, style };
}

/* -------------------------------------------------------------------------- */
/*                          UNIFIED ZONE CALCULATION                          */
/* -------------------------------------------------------------------------- */
function calcZone_EngineeredUnified(
  p: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[],
): Zone {
  const encs = zone.enclosures ?? [];
  if (encs.length === 0) return zone;

  const families = new Set(encs.map((e) => methodFamily(e.designMethod)));

  if (families.size > 1) {
    return {
      ...zone,
      enclosures: encs.map((e) => ({
        ...e,
        estimatedDischargeDuration: "—",
        estimatedFinalOxygenPercent: "—",
      })),

      nitrogenRequiredScf: 0,
      nitrogenDeliveredScf: 0,
      requiredCylinderCount: 0,

      peakNitrogenFlowRateScfm: 0,
      peakWaterFlowRateGpm: 0,
      waterDischargeVolumeGal: 0,
      minWaterTankCapacityGal: 0,

      panelSizing: { bore: "1in", capacity: 1800, qty: 0, style: "ar" },
      panelSizingByPressure: [],
      designLabel: "spec_hazards",
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

  const bulkOn = !!opts.usesBulkTubes;

  let Wprov_zone_SCF = 0;
  let t_flow_zone_min = 0;
  let cyl_final = 0;
  let minCylinders = 0;

  // Track nitrogen calc error → suppress discharge time display
  let n2CalcError = false;

  if (bulkOn) {
    const requiredOpenMin = t_display_min;

    const isEditingOpen = !!zone.isBulkValveOpenTimeOverridden;

    const userOpenRaw = Number(zone.bulkValveOpenTimeMin);
    const userOpen = Number.isFinite(userOpenRaw)
      ? userOpenRaw
      : requiredOpenMin;

    // Clamp to at least required time; store CEIL to 2 decimals
    const tOpen = ceil2(
      isEditingOpen ? Math.max(requiredOpenMin, userOpen) : requiredOpenMin,
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
      Math.ceil(Wreq_zone_SCF / Math.max(1, caps.total)),
    );
    cyl_final = hasCustomCyl(zone) ? getCustomCyl(zone) : minCylinders;

    if (hasCustomCyl(zone)) {
      pushNote(zone.enclosures?.[0], "Custom cylinder count applied.");
      messages.push(
        statusFromCode(
          "ZONE.CUSTOM_CYLINDERS",
          { systemId: sys.id, zoneId: zone.id },
          { actual: cyl_final, recommended: minCylinders },
        ),
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
        },
      ),
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
          },
        ),
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
    },
  );

  // Water + tank (use actual flow time derived from provided nitrogen)
  const water = computeZoneWaterAndTank(p, zone, encsOut, t_flow_zone_min);

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
        { psiList },
      ),
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

    nitrogenRequiredScf: ceil2(Wreq_zone_SCF),
    nitrogenDeliveredScf: ceil2(Wprov_zone_SCF),

    requiredCylinderCount: bulkOn ? 0 : cyl_final,
    ...(bulkOn ? { minTotalTubes: zone.minTotalTubes } : {}),

    peakNitrogenFlowRateScfm: QN2_zone_SCFM,
    peakWaterFlowRateGpm: water.qWaterPeak_GPM,
    waterDischargeVolumeGal: water.zoneWaterDischarge_GAL,
    minWaterTankCapacityGal: water.zoneTankMin_GAL,

    panelSizing,
    panelSizingByPressure,
    designLabel,
  };
}

/* -------------------------------------------------------------------------- */
/*                             SYSTEM CALCULATION                             */
/* -------------------------------------------------------------------------- */
function calcSystem_TotalFloodNFPA(
  project: Project,
  sys: System,
  messages: StatusInput[],
): System {
  if (sys.type !== "engineered") return sys;

  // Unified zone calc replaces legacy branching
  const zones = sys.zones.map((z) =>
    calcZone_EngineeredUnified(project, sys, z, messages),
  );

  // Water tank selection (strict matching to chosen certification)
  const zoneNeeds = zones
    .map((z) => Number(z.minWaterTankCapacityGal) || 0)
    .filter((g) => g > 0);
  const maxReqGal = zoneNeeds.length ? Math.max(...zoneNeeds) : 0;

  const opts = sys.options as EngineeredOptions;
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
          },
        ),
      );
    }
  }

  opts.requiredWaterTankCapacityGal = maxReqGal;
  opts.waterTankCertification = cert;
  opts.selectedWaterTankPartCode = pickCodes;
  opts.selectedWaterTankPartDesc = pickDesc;

  // 3) Engineered estimates (panels, primaries, hoses, batteries, FACP)
  const maxCylAcrossZones = Math.max(
    0,
    ...zones.map((z) => Number(z.requiredCylinderCount || 0)),
  );

  const totalN2 = zones.reduce(
    (s, z) => s + (Number(z.nitrogenRequiredScf) || 0),
    0,
  );
  opts.isBulkTubesEligible = totalN2 > 10000;

  const bulkSelected = !!opts.usesBulkTubes;
  const zonesUsed = zones;

  const totalPanelQty = zonesUsed.reduce(
    (s, z) => s + (z.panelSizing?.qty ?? 0),
    0,
  );

  if (opts.kind === "engineered") {
    opts.primariesPlan = buildPrimariesPlanFromZones(zonesUsed, {
      bulkSelected: !!opts.usesBulkTubes,
      maxBankSize: 24,
    });
  }

  const primaryReleaseAssembliesComputed =
    opts.primariesPlan?.primariesUsed ?? (bulkSelected ? 0 : 0);
  const adjacentRackHoseComputed = estimateAdjacentRackHosesFromZones(
    bulkSelected ? 0 : maxCylAcrossZones,
  );
  const doubleStackedRackHoseComputed = estimateDoubleStackedRackHoseFromZones(
    bulkSelected ? 0 : maxCylAcrossZones,
  );
  const batteryBackupsComputed = Math.ceil((totalPanelQty || 0) / 2);

  const prevEst = (opts.estimates ?? {}) as Partial<EngineeredEstimates>;

  const primaryReleaseAssemblies = persistEditable(
    prevEst.primaryReleaseAssemblies,
    bulkSelected ? 0 : primaryReleaseAssembliesComputed,
    useUserFor(sys, "primaryReleaseAssemblies"),
  );
  const adjacentRackHose = persistEditable(
    prevEst.adjacentRackHose,
    bulkSelected ? 0 : adjacentRackHoseComputed,
    useUserFor(sys, "adjacentRackHose"),
  );
  const doubleStackedRackHose = persistEditable(
    prevEst.doubleStackedRackHose,
    bulkSelected ? 0 : doubleStackedRackHoseComputed,
    useUserFor(sys, "doubleStackedRackHose"),
  );
  const batteryBackups = persistEditable(
    prevEst.batteryBackups,
    batteryBackupsComputed,
    useUserFor(sys, "batteryBackups"),
  );

  const waterTankPresent = !!opts.selectedWaterTankPartCode; // use code presence as proxy for now, or cert?
  // Actually, usage below implies we just need to know if a tank is part of the system for FACP counts.
  // In app-model, waterTankCertification is always set (default ASME/FM).
  // But selectedWaterTankPartCode is undefined if not required.
  // Let's use selectedWaterTankPartCode.
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
    useUserFor(sys, "releasePoints"),
  );
  const monitorPoints = persistEditable(
    prevEst.monitorPoints,
    facp.supervisory + facp.alarm,
    useUserFor(sys, "monitorPoints"),
  );

  opts.estimates = {
    primaryReleaseAssemblies,
    adjacentRackHose,
    doubleStackedRackHose,
    batteryBackups,
    releasePoints,
    monitorPoints,
    refillAdapters: 0, // placeholder, computed after cylinder counts are known
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
    const cyl = Math.max(0, Number(z.requiredCylinderCount || 0));
    if (cyl > nums.cylMax) {
      nums.cylMax = cyl;
      nums.cylZoneId = z.id;
    }

    const n2Req = Math.max(0, Number(z.nitrogenRequiredScf || 0));
    const n2Del = Math.max(0, Number(z.nitrogenDeliveredScf || 0));

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
    nums.panelsSum += Math.max(0, z.panelSizing?.qty ?? 0);
    nums.flowSum += Math.max(0, Number(z.peakNitrogenFlowRateScfm || 0));

    const tank = Math.max(0, Number(z.minWaterTankCapacityGal || 0));
    if (tank > nums.waterTankMax) {
      nums.waterTankMax = tank;
      nums.waterTankZoneId = z.id;
    }

    nums.waterReqMax = Math.max(
      nums.waterReqMax,
      Math.max(0, Number(z.waterDischargeVolumeGal || 0)),
    );
  }

  // Refill adapters: computed from max cylinder count, overridable by user
  const computedRefillAdapters = bulkSelected ? nums.tubeMax : nums.cylMax;
  const refillAdapters = persistEditable(
    prevEst.refillAdapters,
    computedRefillAdapters,
    useUserFor(sys, "refillAdapters" as EstKey),
  );
  opts.estimates = { ...opts.estimates, refillAdapters };

  const systemTotals = {
    governingNitrogenZoneId: nums.n2ZoneId,
    governingWaterZoneId: nums.waterTankZoneId,

    systemCylinderCount: bulkSelected ? nums.tubeMax : nums.cylMax,

    nitrogenRequiredScf: Math.round(nums.n2ReqMax),
    nitrogenDeliveredScf: Math.round(nums.n2DelMax),
    dischargePanelCount: nums.panelsSum,
    requiredWaterTankCapacityGal: Math.ceil(nums.waterTankMax),
    waterRequirementGal: round2(nums.waterReqMax),

    estimatedReleasePoints: Number(opts.estimates?.releasePoints || 0),
    estimatedMonitorPoints: Number(opts.estimates?.monitorPoints || 0),
    estimatedBatteryBackups: Number(opts.estimates?.batteryBackups || 0),
  };

  return { ...sys, zones: zonesUsed, options: opts, systemTotals };
}

/* -------------------------------------------------------------------------- */
/*                                PUBLIC API                                  */
/* -------------------------------------------------------------------------- */
/**
 * Main entry point for Engineered System calculations.
 * Processes all engineered systems in the project, performing zone calculations,
 * water tank selection, and estimating parts (panels, batteries, etc.).
 *
 * @param p - The full Project model.
 * @returns Updated project with calculation results and a list of validation messages.
 */
export function calculateEngineered(p: Project): {
  project: Project;
  messages: StatusInput[];
} {
  const messages: StatusInput[] = [];
  const systems = p.systems.map((sys) =>
    sys.type === "engineered"
      ? calcSystem_TotalFloodNFPA(p, sys, messages)
      : sys,
  );
  return { project: { ...p, systems }, messages };
}
