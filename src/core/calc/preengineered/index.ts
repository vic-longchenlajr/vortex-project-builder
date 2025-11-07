// src/core/calc/preengineered/index.ts
import {
  Project,
  System,
  Zone,
  Enclosure,
  StatusInput,
  PreEngineeredOptions,
  Units,
} from "@/state/app-model";

import {
  selectWaterTankStrict,
  maxCapacityForCert,
  prettyCert,
  WaterTankCert,
} from "@/core/catalog/water_tanks.catalog";

import type { Codes } from "@/core/catalog/parts.constants";
import { statusFromCode } from "@/core/status/error-codes";

/** ─────────────────────────────────────────────────────────────
 *  OVERVIEW (Pre-Engineered)
 *  ─────────────────────────────────────────────────────────────
 *  This module is a pure calculator (no DOM). It mirrors legacy rules:
 *   • Start with 49L, fallback to 80L if (EUR/GBP) or (O₂ > 14.1%) or (>4×49L)
 *   • O₂ rounded to one decimal
 *   • Target times: 3.0 min (NFPA 770 A/C & B) and 3.5 min (FM DC)
 *   • Emitters: NFPA -> ceil, FM DC -> floor (via solver constraints)
 *   • ACF derived from elevation label (e.g. "0FT/0KM")
 *   • FM DC spacing & height checks produce messages
 *
 *  Flow:
 *   calculatePreEngineered(project)
 *     → calcSystem(project, system)
 *       → calcZone(project, system, zone)
 *         → calcEnclosure(project, system, zone, enclosure)
 *       → systemTotals + system-level water tank selection
 */

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────
export function calculatePreEngineered(p: Project): {
  project: Project;
  messages: StatusInput[];
} {
  const messages: StatusInput[] = [];

  const systems = p.systems.map((sys) =>
    sys.type === "preengineered" ? calcSystem(p, sys, messages) : sys
  );

  return { project: { ...p, systems }, messages };
}

// ─────────────────────────────────────────────────────────────
/** SYSTEM WALKER + SYSTEM TOTALS + WATER TANK PICK (STRICT) */
// ─────────────────────────────────────────────────────────────
function calcSystem(
  project: Project,
  sys: System,
  messages: StatusInput[]
): System {
  if (sys.options.kind !== "preengineered") return sys;

  // 1) Zones
  const zones = sys.zones.map((z) => calcZone(project, sys, z, messages));

  // 2) Estimates: simple, fixed values per your legacy behavior
  const prev = sys.options as PreEngineeredOptions;
  const rp = 1;
  const mp = 9;

  const optsAny = { ...(sys.options as any) };
  optsAny.estimates = {
    ...(prev.estimates || {}),
    releasePoints: rp,
    monitorPoints: mp,
  };

  // 3) System totals for the pre-eng panel
  const systemTotals = buildPreSystemTotals(
    project,
    { ...sys, options: optsAny } as System,
    zones
  );

  // 4) WATER TANK (system-level, strict exact cert)
  const zoneNeeds = zones
    .map((z: any) => Number(z.waterTankMin_gal) || 0)
    .filter((g) => g > 0);
  const maxReqGal = zoneNeeds.length ? Math.max(...zoneNeeds) : 0;

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

  optsAny.waterTankRequired_gal = maxReqGal;
  optsAny.waterTankCertification = cert;
  optsAny.waterTankPick = pickCodes
    ? { codes: pickCodes, description: pickDesc, cert }
    : null;

  return { ...sys, zones, systemTotals, options: { ...optsAny } };
}

/** Aggregate the small pre-eng summary block shown in your UI. */
function buildPreSystemTotals(project: Project, sys: System, zones: Zone[]) {
  const z = zones[0];
  // Enc #0 holds the derived numbers we expose
  const waterTankRequired_gal =
    z?.waterTankMin_gal != null ? Math.ceil(z.waterTankMin_gal) : null;

  // Estimates copied from options (already persisted above)
  const est = (sys.options as PreEngineeredOptions).estimates || {};
  const estReleasePoints =
    typeof (est as any).releasePoints === "number"
      ? (est as any).releasePoints
      : 0;
  const estMonitorPoints =
    typeof (est as any).monitorPoints === "number"
      ? (est as any).monitorPoints
      : 0;

  return {
    // pre-eng fields you show:
    governingNitrogenZoneId: z?.id ?? null,
    governingWaterZoneId: z?.id ?? null,
    totalCylinders: z?.minTotalCylinders ?? 0,
    waterTankRequired_gal,
    waterRequirement_gal: z?.waterDischarge_gal ?? null,
    waterTankPick: (sys.options as any).waterTankPick ?? null,

    estReleasePoints,
    estMonitorPoints,
  } as any;
}

// ─────────────────────────────────────────────────────────────
/** ZONE WALKER: sums cylinders/water across enclosure(s) */
// ─────────────────────────────────────────────────────────────
function calcZone(
  project: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const enclosures = zone.enclosures.map((e) =>
    calcEnclosure(project, sys, zone, e, messages)
  );

  // Cyl count = sum of enclosure cylinderCount
  const minTotalCylinders = enclosures.reduce(
    (s, e) => s + (e.cylinderCount ?? 0),
    0
  );
  const totalNitrogen = formatNitrogen(enclosures);

  // Peak enclosure water GPM, and total discharged gal (sum across encs)
  const water_peak_gpm = Math.max(
    0,
    ...enclosures.map((e: any) => Number(e.qWaterTotal_gpm) || 0)
  );
  const waterDischarge_gal = enclosures.reduce(
    (s, e: any) => s + (Number(e.estWater_gal) || 0),
    0
  );

  // Minimum tank (no pipe volume here): discharged water × 1.2
  const waterTankMin_gal = waterDischarge_gal * 1.2;

  return {
    ...zone,
    enclosures,
    minTotalCylinders,
    totalNitrogen,
    water_peak_gpm,
    waterDischarge_gal,
    waterTankMin_gal,
  };
}

// ─────────────────────────────────────────────────────────────
/** ENCLOSURE CALC: volume → cylinders → emitters/time → checks → water */
// ─────────────────────────────────────────────────────────────
function calcEnclosure(
  project: Project,
  sys: System,
  zone: Zone,
  enc: Enclosure,
  messages: StatusInput[]
): Enclosure {
  const sid = sys.id,
    zid = zone.id,
    eid = enc.id;
  const opts = sys.options as PreEngineeredOptions;

  // 1) Volume in ft³, derived from L/W/H if present
  const volFt3 = deriveVolumeFt3(enc, project.units);

  // 2) Expected time by method (NFPA 3.0, FM DC 3.5)
  const tExpected = getExpectedTime(enc.method);

  // 3) Cylinder pick: try 49L, conditionally fallback to 80L
  const cyl49 = getCylinderSpec("49L", opts.fillPressure);
  const cyl80 = getCylinderSpec("80L", opts.fillPressure);

  let chosen = pickCylinders(project, enc, volFt3, cyl49, {
    minForFM49L: enc.method === "FM Data Centers" ? 2 : 1,
  });

  // Fallback rules for 80L
  const currency = project.currency;
  if (
    chosen.size === "49L" &&
    (chosen.o2 > 14.1 ||
      chosen.count > 4 ||
      currency === "EUR" ||
      currency === "GBP")
  ) {
    chosen = pickCylinders(project, enc, volFt3, cyl80);

    if (chosen.count > 8) {
      messages.push(
        statusFromCode("ENC.CYL_LIMIT", {
          systemId: sid,
          zoneId: zid,
          enclosureId: eid,
        })
      );
    }
    if (chosen.o2 > 14.1) {
      messages.push(
        statusFromCode("ENC.O2_HIGH", {
          systemId: sid,
          zoneId: zid,
          enclosureId: eid,
        })
      );
    }
  }

  // 4) Emitter bundle selection + integer emitter solve to meet time window
  const solved = solveEmitters(enc, chosen);
  if (!solved.ok) {
    messages.push(
      statusFromCode(
        "ENC.TIME_CONSTRAINT",
        { systemId: sid, zoneId: zid, enclosureId: eid },
        { method: enc.method }
      )
    );
  }

  const bundle = solved.bundle;
  const emitters = solved.emitters;
  const tActual = solved.tActualMin;

  // (CLEANUP) Deduped: style compatibility check (was duplicated)
  if (enc.emitterStyle && !bundle.allowedStyles.includes(enc.emitterStyle)) {
    messages.push(
      statusFromCode("ENC.EMITTER_STYLE", {
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
        field: "emitterStyle",
      })
    );
  }

  // FM DC checks: height & spacing
  if (enc.method === "FM Data Centers") {
    const heightFt = toFeet(enc.height ?? 0, project.units);
    const heightLimit = bundle.sizeLabel === '5/8"' ? 24.5 : 16;
    if (heightFt > heightLimit) {
      messages.push(
        statusFromCode("ENC.HEIGHT_LIMIT", {
          systemId: sid,
          zoneId: zid,
          enclosureId: eid,
        })
      );
    }
    const spacingOk = checkFMSpacing(
      enc,
      emitters,
      bundle.sizeLabel,
      project.units
    );
    if (!spacingOk) {
      messages.push(
        statusFromCode("ENC.FM_SPACING", {
          systemId: sid,
          zoneId: zid,
          enclosureId: eid,
        })
      );
    }
  }

  // Occupancy advisories (same thresholds as legacy)
  if (chosen.o2 < 12 && chosen.o2 >= 10) {
    messages.push(
      statusFromCode("ENC.O2_LOW_MOD", {
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
      })
    );
  } else if (chosen.o2 < 10 && chosen.o2 >= 8) {
    messages.push(
      statusFromCode("ENC.O2_LOW_SUB", {
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
      })
    );
  } else if (chosen.o2 < 8) {
    messages.push(
      statusFromCode("ENC.O2_VERY_LOW", {
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
      })
    );
  }

  // 5) N2 requirement and water math for display
  const qN2Req = calcReqNitrogenFlow(
    volFt3,
    enc.tempF,
    project.units,
    project.elevation,
    tExpected
  );
  const perEmitterGpm = bundle.q_water;
  const totalGpm = perEmitterGpm * emitters;
  const totalWaterGal = totalGpm * tActual;

  // Cylinder labeling for UI
  const cylinderSize = chosen.size; // "49L" | "80L"
  const cylinderFillPressure =
    chosen.size === "49L"
      ? "2400 psi"
      : (sys.options as PreEngineeredOptions).fillPressure.includes("3000")
        ? "3000 psi"
        : "2640 psi";
  const cylinderLabel = `${cylinderSize} @ ${cylinderFillPressure}`;

  return {
    ...enc,
    volume: project.units === "imperial" ? volFt3 : volFt3 / 35.3147,
    minEmitters: emitters,
    cylinderCount: chosen.count,
    estDischarge: formatMinutes(tActual),
    estFinalO2: `${chosen.o2.toFixed(1)} %`,

    // Water numbers for collector
    qWater_gpm: perEmitterGpm,
    qWaterTotal_gpm: totalGpm,
    estWater_gal: totalWaterGal,

    // Extras used elsewhere
    _qN2Req: qN2Req,
    _water: totalWaterGal,
    _emitterBundle: bundle.label,

    // Cylinder “surface” fields
    _cylinderLabel: cylinderLabel,
    _cylinderSize: cylinderSize,
    _cylinderFillPSI: cylinderFillPressure,
  } as Enclosure;
}

// ─────────────────────────────────────────────────────────────
/** DOMAIN HELPERS: units, expected times, cylinders, O₂, ACF */
// ─────────────────────────────────────────────────────────────
function deriveVolumeFt3(enc: Enclosure, units: Units): number {
  if (enc.length && enc.width && enc.height) {
    const L = toFeet(enc.length, units);
    const W = toFeet(enc.width, units);
    const H = toFeet(enc.height, units);
    return Math.max(0, L * W * H);
  }
  // fallback: assume enc.volume in displayed units
  return units === "imperial" ? enc.volume : (enc.volume ?? 0) * 35.3147;
}

function toFeet(value: number, units: Units): number {
  return units === "imperial" ? value : value * 3.28084;
}

function getExpectedTime(method: Enclosure["method"]): number {
  return method === "FM Data Centers" ? 3.5 : 3.0;
}

type CylinderSpec = {
  size: "49L" | "80L";
  w_cyl: number; // legacy total per-cyl "weight" basis (lb) for calc
  w_usable: number; // usable mass per cylinder (lb)
  label: string; // UI label
};

function getCylinderSpec(
  size: "49L" | "80L",
  fillPressure: PreEngineeredOptions["fillPressure"]
): CylinderSpec {
  if (size === "49L") {
    return { size, w_cyl: 275, w_usable: 244, label: "49L @ 2400 psi" };
  }
  // 80L depends on fill pressure (2640 vs 3000)
  if (fillPressure === "2640 PSI/182.0 BAR") {
    return { size: "80L", w_cyl: 490, w_usable: 439, label: "80L @ 2640 psi" };
  }
  return { size: "80L", w_cyl: 549, w_usable: 498, label: "80L @ 3000 psi" };
}

/** Compute a “back-solve” cylinder count to reach ~14% O₂ (legacy approach). */
function pickCylinders(
  project: Project,
  enc: Enclosure,
  volFt3: number,
  spec: CylinderSpec,
  opts?: { minForFM49L?: number }
): {
  size: CylinderSpec["size"];
  count: number;
  o2: number;
  label: string;
  w_cyl: number;
  w_usable: number;
} {
  const T0 = 294.4;
  const T = toKelvin(enc.tempF, project.units);
  const acf = calcACF(project.elevation, project.units);

  // legacy target O₂ ≈ 14%
  const targetO2 = 14.0;
  const n = Math.ceil(
    Math.log(targetO2 / 20.95) * -((volFt3 * acf * T0) / (spec.w_cyl * T))
  );
  let count = Math.max(0, n);

  // FM DC with 49L ⇒ minimum 2 cylinders
  if (opts?.minForFM49L && spec.size === "49L")
    count = Math.max(count, opts.minForFM49L);

  const o2 = calcOxygen(enc, project, count, spec.w_cyl, volFt3, acf);
  return {
    size: spec.size,
    count,
    o2,
    label: spec.label,
    w_cyl: spec.w_cyl,
    w_usable: spec.w_usable,
  };
}

function toKelvin(tempF: number, units: Units): number {
  return units === "imperial"
    ? ((tempF - 32) * 5) / 9 + 273.15
    : tempF + 273.15;
}

function calcOxygen(
  enc: Enclosure,
  project: Project,
  nCyl: number,
  w_cyl: number,
  volFt3: number,
  acf: number
): number {
  const T0 = 294.4;
  const T = toKelvin(enc.tempF, project.units);
  const val = 20.95 * Math.exp(-((nCyl * w_cyl) / (volFt3 * acf)) * (T / T0));
  return Math.round(val * 10) / 10; // 1-decimal rounding
}

// ─────────────────────────────────────────────────────────────
/** EMITTER BUNDLES + REQUIRED N₂ FLOW (lb/min) */
// ─────────────────────────────────────────────────────────────
type Bundle = {
  method: Enclosure["method"];
  sizeLabel: '3/8"' | '1/2"' | '5/8"';
  foil: "Cavity" | "Dome";
  op_psi: 25 | 50;
  q_n2: number; // per-emitter N₂ rate (lb/min basis)
  q_water: number; // GPM per emitter
  allowedStyles: string[];
  label: string;
};

const BUNDLES: Bundle[] = [
  // NFPA 770 Class A/C
  {
    method: "NFPA 770 Class A/C",
    sizeLabel: '5/8"',
    foil: "Cavity",
    op_psi: 50,
    q_n2: 369,
    q_water: 0.53,
    allowedStyles: ["escutcheon-stainless", "standard-pvdf"],
    label: '5/8" Cavity @ 50 psi',
  },
  {
    method: "NFPA 770 Class A/C",
    sizeLabel: '5/8"',
    foil: "Cavity",
    op_psi: 25,
    q_n2: 230,
    q_water: 0.26,
    allowedStyles: ["escutcheon-stainless", "standard-pvdf"],
    label: '5/8" Cavity @ 25 psi',
  },
  {
    method: "NFPA 770 Class A/C",
    sizeLabel: '3/8"',
    foil: "Cavity",
    op_psi: 50,
    q_n2: 130,
    q_water: 0.13,
    allowedStyles: ["escutcheon-stainless", "standard-stainless"],
    label: '3/8" Cavity @ 50 psi',
  },
  {
    method: "NFPA 770 Class A/C",
    sizeLabel: '3/8"',
    foil: "Cavity",
    op_psi: 25,
    q_n2: 82,
    q_water: 0.13,
    allowedStyles: ["escutcheon-stainless", "standard-stainless"],
    label: '3/8" Cavity @ 25 psi',
  },

  // NFPA 770 Class B
  {
    method: "NFPA 770 Class B",
    sizeLabel: '1/2"',
    foil: "Dome",
    op_psi: 50,
    q_n2: 235,
    q_water: 1.59,
    allowedStyles: [
      "escutcheon-stainless",
      "standard-stainless",
      "standard-pvdf",
    ],
    label: '1/2" Dome @ 50 psi',
  },
  {
    method: "NFPA 770 Class B",
    sizeLabel: '1/2"',
    foil: "Dome",
    op_psi: 25,
    q_n2: 145,
    q_water: 1.06,
    allowedStyles: [
      "escutcheon-stainless",
      "standard-stainless",
      "standard-pvdf",
    ],
    label: '1/2" Dome @ 25 psi',
  },
  {
    method: "NFPA 770 Class B",
    sizeLabel: '3/8"',
    foil: "Dome",
    op_psi: 50,
    q_n2: 130,
    q_water: 0.79,
    allowedStyles: ["escutcheon-stainless", "standard-stainless"],
    label: '3/8" Dome @ 50 psi',
  },
  {
    method: "NFPA 770 Class B",
    sizeLabel: '3/8"',
    foil: "Dome",
    op_psi: 25,
    q_n2: 82,
    q_water: 0.53,
    allowedStyles: ["escutcheon-stainless", "standard-stainless"],
    label: '3/8" Dome @ 25 psi',
  },

  // FM Data Centers (50 psi only)
  {
    method: "FM Data Centers",
    sizeLabel: '5/8"',
    foil: "Cavity",
    op_psi: 50,
    q_n2: 369,
    q_water: 0.53,
    allowedStyles: ["escutcheon-stainless"],
    label: '5/8" Cavity @ 50 psi',
  },
  {
    method: "FM Data Centers",
    sizeLabel: '3/8"',
    foil: "Cavity",
    op_psi: 50,
    q_n2: 130,
    q_water: 0.13,
    allowedStyles: ["escutcheon-stainless"],
    label: '3/8" Cavity @ 50 psi',
  },
];

/** Required N₂ rate (lb/min) to meet forward-flow over tExpected. */
function calcReqNitrogenFlow(
  volFt3: number,
  tempF: number,
  units: Units,
  elevation: string,
  tExpectedMin: number
): number {
  const T0 = 294.4;
  const T = toKelvin(tempF, units);
  const acf = calcACF(elevation, units);
  const FF = 0.375; // flooding factor baseline for pre-eng
  const SF = 1.2;
  const wN2Req = volFt3 * (T0 / T) * acf * FF * SF; // lb
  return wN2Req / tExpectedMin; // lb/min
}

function formatMinutes(mins: number): string {
  return !isFinite(mins) || mins <= 0 ? "" : `${mins.toFixed(1)} min`;
}

function formatNitrogen(encs: Enclosure[]): string {
  const vals = (encs as any[])
    .map((e) => e._qN2Req)
    .filter((x) => typeof x === "number");
  if (!vals.length) return "";
  const sum = vals.reduce((a: number, b: number) => a + b, 0);
  return `${sum.toFixed(1)} lb/min`;
}

// ─────────────────────────────────────────────────────────────
/** ACF (Altitude Correction Factor) & elevation parsing */
// ─────────────────────────────────────────────────────────────
const ACF_TABLE = [
  { ft: -3000, acf: 1.11 },
  { ft: -2000, acf: 1.07 },
  { ft: -1000, acf: 1.04 },
  { ft: 0, acf: 1.0 },
  { ft: 1000, acf: 0.96 },
  { ft: 2000, acf: 0.93 },
  { ft: 3000, acf: 0.89 },
  { ft: 4000, acf: 0.86 },
  { ft: 5000, acf: 0.82 },
  { ft: 6000, acf: 0.78 },
  { ft: 7000, acf: 0.75 },
  { ft: 8000, acf: 0.72 },
  { ft: 9000, acf: 0.69 },
  { ft: 10000, acf: 0.66 },
];

function parseElevationFeet(label: string, _units: Units): number | null {
  // Expected like "5000FT/1.52KM" or "-3000FT/-0.92KM"
  if (!label) return null;
  const upper = label.toUpperCase();
  const ftIdx = upper.indexOf("FT");
  if (ftIdx > 0) {
    const num = parseFloat(upper.slice(0, ftIdx));
    return isFinite(num) ? num : null;
  }
  // Fallback: parse KM after slash
  const slashIdx = label.indexOf("/");
  const kmIdx = upper.indexOf("KM");
  if (slashIdx >= 0 && kmIdx > slashIdx) {
    const km = parseFloat(label.slice(slashIdx + 1, kmIdx));
    if (isFinite(km)) return km * 3280.84;
  }
  return null;
}

export function calcACF(elevationLabel: string, units: Units): number {
  const ft = parseElevationFeet(elevationLabel, units);
  if (ft == null) return 1.0;
  // nearest neighbor lookup
  let best = ACF_TABLE[0],
    bestErr = Math.abs(ft - best.ft);
  for (const row of ACF_TABLE) {
    const err = Math.abs(ft - row.ft);
    if (err < bestErr) {
      best = row;
      bestErr = err;
    }
  }
  return best.acf;
}

// ─────────────────────────────────────────────────────────────
/** FM DATA CENTERS: simplified spacing/height rules */
// ─────────────────────────────────────────────────────────────
function checkFMSpacing(
  enc: Enclosure,
  nEmitters: number,
  sizeLabel: '5/8"' | '3/8"' | '1/2"',
  units: Units
): boolean {
  const L = toFeet(enc.length ?? 0, units);
  const W = toFeet(enc.width ?? 0, units);

  // Conservative bounds (mirroring your legacy)
  let dMax = 0,
    dMin = 0,
    dwMax = 0,
    dwMin = 0;
  if (sizeLabel === '5/8"') {
    dMax = 20;
    dMin = 8;
    dwMax = 20;
    dwMin = 3;
  } else {
    dMax = 10;
    dMin = 6;
    dwMax = 10;
    dwMin = 2;
  }

  const Wmax = Math.floor((W - 2 * dwMin) / dMin);
  const Lmax = Math.floor((L - 2 * dwMin) / dMin);
  const Wmin = Math.ceil((W - 2 * dwMax) / dMax);
  const Lmin = Math.ceil((L - 2 * dwMax) / dMax);

  const sanitize = (x: number) => (x < 0 ? 0 : x);
  const Emax = (sanitize(Wmax) + 1) * (sanitize(Lmax) + 1);
  const Emin = (sanitize(Wmin) + 1) * (sanitize(Lmin) + 1);

  if (
    L < 2 * dwMin ||
    W < 2 * dwMin ||
    L > 2 * dwMax + (nEmitters - 1) * dMax ||
    W > 2 * dwMax + (nEmitters - 1) * dMax ||
    nEmitters < Emin ||
    nEmitters > Emax
  ) {
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
/** EMITTER SOLVER: choose bundle & integer emitter count to meet time windows */
// ─────────────────────────────────────────────────────────────
type SolveOk = {
  ok: true;
  bundle: Bundle;
  emitters: number;
  tActualMin: number;
};
type SolveFail = {
  ok: false;
  bundle: Bundle;
  emitters: number;
  tActualMin: number;
  reason: "TOO_SHORT" | "TOO_LONG" | "ZERO_EMITTERS";
  gap: number;
};

function solveForBundle(
  method: Enclosure["method"],
  bundle: Bundle,
  totalUsableLb: number
): SolveOk | SolveFail {
  const tExp = getExpectedTime(method);
  const q = bundle.q_n2;

  if (method === "FM Data Centers") {
    // FM DC: floor emitters, must meet t >= 3.5
    const n = Math.floor(totalUsableLb / (q * tExp));
    const t = n > 0 ? totalUsableLb / (q * n) : 0;
    if (n > 0 && t >= tExp)
      return { ok: true, bundle, emitters: n, tActualMin: t };
    const reason = n <= 0 ? "ZERO_EMITTERS" : "TOO_SHORT";
    const gap = n <= 0 ? tExp : Math.max(0, tExp - t);
    return {
      ok: false,
      bundle,
      emitters: Math.max(0, n),
      tActualMin: t,
      reason,
      gap,
    };
  }

  // NFPA A/C or B: need integer n with 2.1 ≤ t ≤ tExp
  const tMin = 2.1;
  const nMin = Math.ceil(totalUsableLb / (q * tExp));
  const nMax = Math.floor(totalUsableLb / (q * tMin));

  if (nMin > 0 && nMax >= nMin) {
    const n = nMin; // smallest n that keeps t ≤ tExp
    const t = totalUsableLb / (q * n);
    return { ok: true, bundle, emitters: n, tActualMin: t };
  }

  // Infeasible: return nearest attempt toward tExp
  const nTry = Math.max(1, nMin);
  const tTry = totalUsableLb / (q * nTry);
  let reason: SolveFail["reason"],
    gap = 0;
  if (tTry < tMin) {
    reason = "TOO_SHORT";
    gap = tMin - tTry;
  } else if (tTry > tExp) {
    reason = "TOO_LONG";
    gap = tTry - tExp;
  } else {
    reason = "TOO_LONG";
    gap = 0;
  }
  return { ok: false, bundle, emitters: nTry, tActualMin: tTry, reason, gap };
}

function getMethodBundlesForEnclosure(enc: Enclosure): Bundle[] {
  const all = BUNDLES.filter((b) => b.method === enc.method);

  // If nozzle code implies size, pre-filter (e.g., "...58..." → 5/8")
  const code = (enc.nozzleCode || "").toLowerCase();
  const preferSize: Bundle["sizeLabel"] | undefined = code.includes("58")
    ? '5/8"'
    : code.includes("12")
      ? '1/2"'
      : code.includes("38")
        ? '3/8"'
        : undefined;

  let list = preferSize ? all.filter((b) => b.sizeLabel === preferSize) : all;
  if (enc.emitterStyle)
    list = list.filter((b) => b.allowedStyles.includes(enc.emitterStyle!));
  return list;
}

function solveEmitters(
  enc: Enclosure,
  chosen: { count: number; w_usable: number }
): SolveOk | SolveFail {
  const totalUsable = chosen.count * chosen.w_usable;
  const candidates = getMethodBundlesForEnclosure(enc);

  let bestMiss: SolveFail | null = null;
  for (const b of candidates) {
    const res = solveForBundle(enc.method, b, totalUsable);
    if (res.ok) return res;
    if ("gap" in res)
      bestMiss = !bestMiss || res.gap < bestMiss.gap ? res : bestMiss;
  }
  return (
    bestMiss ?? {
      ok: false,
      bundle: BUNDLES[0],
      emitters: 0,
      tActualMin: 0,
      reason: "ZERO_EMITTERS",
      gap: Infinity,
    }
  );
}
