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

/*
  Pre-Engineered calculator — pure, testable, no DOM.
  Mirrors legacy logic:
  - 49L first, then fallback to 80L (EUR/GBP, O2 > 14.1%, or >4 x 49L)
  - O2 rounded to one decimal
  - t_expected: 3.0 min (NFPA 770 A/C & B); 3.5 min (FM DC)
  - NFPA: ceil emitters; FM DC: floor emitters
  - ACF from elevation label (e.g. "0FT/0KM").
  - FM DC spacing & height checks issue messages
*/

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

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export function calculatePreEngineered(p: Project): {
  project: Project;
  messages: StatusInput[];
} {
  const messages: StatusInput[] = [];

  const systems = p.systems.map((sys) =>
    sys.type === "preengineered" ? calcSystem(p, sys, messages) : sys
  );

  const next: Project = { ...p, systems };
  return { project: next, messages };
}

// ─────────────────────────────────────────────────────────────
// System/Zone/Enclosure walkers
// ─────────────────────────────────────────────────────────────
function calcSystem(
  project: Project,
  sys: System,
  messages: StatusInput[]
): System {
  if (sys.options.kind !== "preengineered") return sys;
  const zones = sys.zones.map((z) => calcZone(project, sys, z, messages));
  const prev = sys.options as PreEngineeredOptions;
  const rp = 1;
  const mp = 9;

  return {
    ...sys,
    zones,
    options: {
      ...prev,
      estimates: { ...prev.estimates, releasePoints: rp, monitorPoints: mp },
    },
  };
}

function calcZone(
  project: Project,
  sys: System,
  zone: Zone,
  messages: StatusInput[]
): Zone {
  const encs = zone.enclosures;

  // Phase 1: quick preview to get base cylinder counts per enclosure
  const preview = encs.map((e) =>
    calcEnclosure(project, sys, zone, e, [], /* no forced */ undefined)
  );
  const baseCounts = preview.map((e) => clampInt(e.cylinderCount || 0, 0));
  const baseTotal = baseCounts.reduce((a, b) => a + b, 0);

  // Phase 2: compute forced cylinder distribution when zone override present
  let forcedPerEnc: number[] | null = null;
  if (hasCustomCyl(zone)) {
    const target = getCustomCyl(zone);

    if (encs.length <= 1) {
      forcedPerEnc = [target];
    } else {
      // proportional distribution across enclosures; fall back to even split
      const scale = baseTotal > 0 ? target / baseTotal : 0;
      let provisional = baseCounts.map((c) => Math.round(c * scale));
      let sum = provisional.reduce((a, b) => a + b, 0);

      // fix rounding drift on the last enclosure
      if (sum !== target) {
        provisional[provisional.length - 1] = Math.max(
          0,
          provisional[provisional.length - 1] + (target - sum)
        );
      }
      forcedPerEnc = provisional;
    }

    // Zone-level warning (one per zone)
    // messages.push({
    //   severity: "warn",
    //   systemId: sys.id,
    //   zoneId: zone.id,
    //   code: "ZONE.CUSTOM_CYLINDERS",
    //   text: `Custom zone cylinder count used: ${target}${
    //     baseTotal ? ` (calc: ${baseTotal})` : ""
    //   }.`,
    // });
  }

  // Phase 3: produce final enclosures with per-enc forces (cyl/emitters)
  const encsOut = encs.map((e, i) => {
    const cylForced = forcedPerEnc ? forcedPerEnc[i] : undefined;
    const emitForced = hasCustomEmitters(e) ? getCustomEmitters(e) : undefined;
    return calcEnclosure(
      project,
      sys,
      zone,
      e,
      messages,
      cylForced != null || emitForced != null
        ? { cylCount: cylForced, emitters: emitForced }
        : undefined
    );
  });

  // Totals
  const minTotalCylinders = encsOut.reduce(
    (s, e) => s + (e.cylinderCount ?? 0),
    0
  );
  const totalNitrogen = formatNitrogen(encsOut as any);

  // ✅ peak water (GPM) and total discharged water (gal)
  const water_peak_gpm = Math.max(
    0,
    ...encsOut.map((e: any) => Number(e.qWaterTotal_gpm) || 0)
  );
  const waterDischarge_gal = encsOut.reduce(
    (s, e: any) => s + (Number(e.estWater_gal) || 0),
    0
  );
  const waterTankMin_gal = waterDischarge_gal * 1.2;

  return {
    ...zone,
    enclosures: encsOut,
    minTotalCylinders,
    totalNitrogen,
    water_peak_gpm,
    waterDischarge_gal,
    waterTankMin_gal,
  };
}

function calcEnclosure(
  project: Project,
  sys: System,
  zone: Zone,
  enc: Enclosure,
  messages: StatusInput[],
  forced?: { cylCount?: number; emitters?: number }
): Enclosure {
  const sid = sys.id;
  const zid = zone.id;
  const eid = enc.id;

  const opts = sys.options as PreEngineeredOptions;

  // 1) Derive volume (ft³) from L/W/H if provided; else use enc.volume
  const volFt3 = deriveVolumeFt3(enc, project.units);

  // 2) Expected discharge time by method
  const tExpected = getExpectedTime(enc.method);

  // 3) Cylinder sizing logic (start 49L; allow force)
  const cyl49 = getCylinderSpec("49L", opts.fillPressure);
  const cyl80 = getCylinderSpec("80L", opts.fillPressure);

  // helper to apply count to a spec and compute O2
  const makeChoice = (spec: CylinderSpec, count: number) => ({
    size: spec.size,
    count,
    o2: calcOxygen(
      enc,
      project,
      count,
      spec.w_cyl,
      volFt3,
      calcACF(project.elevation, project.units)
    ),
    label: spec.label,
    w_cyl: spec.w_cyl,
    w_usable: spec.w_usable,
  });

  let chosen =
    forced?.cylCount != null
      ? makeChoice(
          // if 49L would violate currency/fallback later, we may swap to 80L after checks
          cyl49,
          clampInt(forced.cylCount, 0)
        )
      : pickCylinders(project, enc, volFt3, cyl49, {
          minForFM49L: enc.method === "FM Data Centers" ? 2 : 1,
        });

  // Currency / O2 / capacity fallback to 80L if needed
  const currency = project.currency;
  const mustUse80 =
    chosen.size === "49L" &&
    (chosen.o2 > 14.1 ||
      chosen.count > 4 ||
      currency === "EUR" ||
      currency === "GBP");

  if (mustUse80) {
    const count80 =
      forced?.cylCount != null ? clampInt(forced.cylCount, 0) : undefined;

    chosen =
      count80 != null
        ? makeChoice(cyl80, count80)
        : pickCylinders(project, enc, volFt3, cyl80);

    if (chosen.count > 8) {
      messages.push({
        severity: "error",
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
        code: "ENC.CYL_LIMIT",
        text: "Cylinder quantity exceeds the limitation of 8 × 80L for pre-engineered systems.",
      });
    }

    if (chosen.o2 > 14.1) {
      messages.push({
        severity: "error",
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
        code: "ENC.O2_HIGH",
        text: "Oxygen level exceeds the allowable 14.1% required for extinguishment.",
      });
    }
  }

  // Warn when forced cylinders in effect
  if (forced?.cylCount != null) {
    messages.push({
      severity: "warn",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ZONE.CUSTOM_CYLINDERS",
      text: `Custom cylinder count used for "${enc.name || "Enclosure"}": ${forced.cylCount}.`,
    });
  }

  // 4) Emitter/flow-cartridge selection and count/time
  // old:
  // const bundle = pickEmitterBundle(enc);
  // const em = calcEmittersAndTime(enc.method, bundle, chosen);

  // new:
  let solved = solveEmitters(enc, chosen);

  // If user forces emitters, recompute tActual directly
  if (forced?.emitters != null) {
    const n = clampInt(forced.emitters, 0);
    const bundle = solved.bundle; // keep the best bundle chosen by solver (or its best attempt)
    const q = bundle.q_n2;
    const totalUsable = chosen.count * chosen.w_usable;
    const t = n > 0 ? totalUsable / (q * n) : 0;

    // emit a warning that custom emitters were applied
    messages.push({
      severity: "warn",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ENC.CUSTOM_EMITTERS",
      text: `Custom emitters used for "${enc.name || "Enclosure"}": ${n}.`,
    });

    solved = {
      ok:
        (enc.method === "FM Data Centers" &&
          n > 0 &&
          t >= getExpectedTime(enc.method)) ||
        (enc.method !== "FM Data Centers" &&
          n > 0 &&
          t >= 2.1 &&
          t <= getExpectedTime(enc.method)),
      bundle,
      emitters: n,
      tActualMin: t,
    } as SolveOk | SolveFail;

    // If outside constraints, keep messages like the original branch would
    if (!(solved as SolveOk).ok) {
      messages.push({
        severity: "error",
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
        code: "ENC.TIME_CONSTRAINT",
        text:
          enc.method === "FM Data Centers"
            ? "Calculated discharge time does not meet FM requirements for any allowed nozzle/pressure. Try a different size/pressure or cylinder set."
            : "Calculated discharge time cannot satisfy 2.1–3.0 minutes for any allowed nozzle/pressure. Try a different size/pressure or cylinder set.",
      });
    }
  }

  const bundle = solved.bundle;
  const emitters = solved.emitters;
  const tActual = solved.tActualMin;

  // style compatibility (already filtered but keep the message if user changes later)
  if (enc.emitterStyle && !bundle.allowedStyles.includes(enc.emitterStyle)) {
    messages.push({
      severity: "error",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ENC.EMITTER_STYLE",
      text: "Selected emitter style is incompatible with the design method/nozzle.",
      field: "emitterStyle",
    });
  }

  // Style compatibility check
  if (enc.emitterStyle && !bundle.allowedStyles.includes(enc.emitterStyle)) {
    messages.push({
      severity: "error",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ENC.EMITTER_STYLE",
      text: "Selected emitter style is incompatible with the design method/nozzle.",
      field: "emitterStyle",
    });
  }

  // FM DC spacing / height checks
  if (enc.method === "FM Data Centers") {
    const heightFt = toFeet(enc.height ?? 0, project.units);
    const heightLimit = bundle.sizeLabel === '5/8"' ? 24.5 : 16;
    if (heightFt > heightLimit) {
      messages.push({
        severity: "error",
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
        code: "ENC.HEIGHT_LIMIT",
        text: "Ceiling height exceeds maximum allowable for selected emitter size per FM approval.",
      });
    }

    const spacingOk = checkFMSpacing(
      enc,
      emitters,
      bundle.sizeLabel,
      project.units
    );
    if (!spacingOk) {
      messages.push({
        severity: "error",
        systemId: sid,
        zoneId: zid,
        enclosureId: eid,
        code: "ENC.FM_SPACING",
        text: "Room dimensions violate FM requirements for emitter spacing.",
      });
    }
  }

  // Occupancy-time advisories (same thresholds as legacy)
  if (chosen.o2 < 12 && chosen.o2 >= 10) {
    messages.push({
      severity: "warn",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ENC.O2_LOW_MOD",
      text: "Oxygen level is lower than design values; recommended occupancy time is reduced (see NFPA 770 §4.3).",
    });
  } else if (chosen.o2 < 10 && chosen.o2 >= 8) {
    messages.push({
      severity: "warn",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ENC.O2_LOW_SUB",
      text: "Oxygen level is substantially low; recommended occupancy time is substantially reduced (see NFPA 770 §4.3).",
    });
  } else if (chosen.o2 < 8) {
    messages.push({
      severity: "warn",
      systemId: sid,
      zoneId: zid,
      enclosureId: eid,
      code: "ENC.O2_VERY_LOW",
      text: "Oxygen level is very low; occupancy of the protected enclosure is not recommended (see NFPA 770 §4.3).",
    });
  }

  // 5) Required N2 flow and water
  const qN2Req = calcReqNitrogenFlow(
    volFt3,
    enc.tempF,
    project.units,
    project.elevation,
    tExpected
  );
  const water = bundle.q_water * emitters * tActual;
  const cylinderSize = chosen.size; // "49L" | "80L"
  const cylinderFillPressure =
    chosen.size === "49L"
      ? "2400 psi"
      : (sys.options as PreEngineeredOptions).fillPressure.includes("3000")
        ? "3000 psi"
        : "2640 psi";
  const cylinderLabel = `${cylinderSize} @ ${cylinderFillPressure}`;
  const perEmitterGpm = bundle.q_water;
  const totalGpm = perEmitterGpm * emitters;
  const totalWaterGal = perEmitterGpm * emitters * tActual; // what you call "water"

  // ...existing return object – add these props:
  return {
    ...enc,
    volume: project.units === "imperial" ? volFt3 : volFt3 / 35.3147,
    minEmitters: emitters,
    cylinderCount: chosen.count,
    estDischarge: formatMinutes(tActual),
    estFinalO2: `${chosen.o2.toFixed(1)} %`,

    // ✅ expose water numbers
    qWater_gpm: perEmitterGpm, // per-emitter GPM
    qWaterTotal_gpm: totalGpm, // enclosure total GPM
    estWater_gal: totalWaterGal, // gallons discharged

    // already present & useful for collector:
    _qN2Req: calcReqNitrogenFlow(
      volFt3,
      enc.tempF,
      project.units,
      project.elevation,
      getExpectedTime(enc.method)
    ),
    _water: totalWaterGal,
    _emitterBundle: bundle.label,

    // ✅ cylinder surface (already present in your code)
    _cylinderLabel: cylinderLabel,
    _cylinderSize: cylinderSize, // "49L" | "80L"
    _cylinderFillPSI: cylinderFillPressure, // "2400 psi" | "2640 psi" | "3000 psi"
  } as Enclosure;
}
// ─────────────────────────────────────────────────────────────
// Domain helpers
// ─────────────────────────────────────────────────────────────
function deriveVolumeFt3(enc: Enclosure, units: Units): number {
  if (enc.length && enc.width && enc.height) {
    const L = toFeet(enc.length, units);
    const W = toFeet(enc.width, units);
    const H = toFeet(enc.height, units);
    return Math.max(0, L * W * H);
  }
  // fallback: assume stored volume already in correct displayed units
  return units === "imperial" ? enc.volume : (enc.volume ?? 0) * 35.3147;
}

function toFeet(value: number, units: Units): number {
  // In your UI, L/W/H are in feet (imperial) or meters (metric)
  if (units === "imperial") return value;
  return value * 3.28084;
}

function getExpectedTime(method: Enclosure["method"]): number {
  switch (method) {
    case "FM Data Centers":
      return 3.5; // minutes
    case "NFPA 770 Class A/C":
    case "NFPA 770 Class B":
    default:
      return 3.0;
  }
}

type CylinderSpec = {
  size: "49L" | "80L";
  w_cyl: number; // total mass/cylinder (lb) used in legacy equations
  w_usable: number; // usable mass per cylinder (lb)
  label: string; // e.g., "80L @ 3000 psi" or "49L @ 2400 psi"
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
  const T0 = 294.4; // K
  const T = toKelvin(enc.tempF, project.units);
  const acf = calcACF(project.elevation, project.units);

  // legacy: target o2_actual used to back-compute cylinder count is 14.0%
  const targetO2 = 14.0;
  const n = Math.ceil(
    Math.log(targetO2 / 20.95) * -((volFt3 * acf * T0) / (spec.w_cyl * T))
  );
  let count = Math.max(0, n);

  // special rule: FM DC with 49L → minimum 2 cylinders
  if (opts?.minForFM49L && spec.size === "49L") {
    count = Math.max(count, opts.minForFM49L);
  }

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
  if (units === "imperial") {
    // F → K
    return ((tempF - 32) * 5) / 9 + 273.15;
  }
  // tempF in model is actually °F; but if metric UI later stores °C, switch here
  return tempF + 273.15;
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
  // round to one decimal (matches legacy)
  return Math.round(val * 10) / 10;
}

// Minimal pre-engineered emitter table (from legacy):
// A/C & B have 25/50 psi options; FM DC has 50 psi only; values are per-emitter.
// q_n2 in SCFM-equivalent mass basis (legacy uses lb/min via w_usable / time — here we use given table values)

type Bundle = {
  method: Enclosure["method"];
  sizeLabel: '3/8"' | '1/2"' | '5/8"';
  foil: "Cavity" | "Dome";
  op_psi: 25 | 50;
  q_n2: number; // per-emitter N2 flow (lb/min equivalent)
  q_water: number; // GPM per emitter
  allowedStyles: string[]; // UI style keys
  label: string; // pretty string for UI
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
  const hHybrid = 0.375; // flooding factor for pre-eng (A/C baseline)
  const SF = 1.2;
  const wN2Req = volFt3 * (T0 / T) * acf * hHybrid * SF; // lb
  return wN2Req / tExpectedMin; // lb/min (required)
}

function formatMinutes(mins: number): string {
  if (!isFinite(mins) || mins <= 0) return "";
  return `${mins.toFixed(1)} min`;
}

function formatNitrogen(encs: Enclosure[]): string {
  // If you kept _qN2Req above, you can sum that; else leave blank
  const vals = (encs as any[])
    .map((e) => e._qN2Req)
    .filter((x) => typeof x === "number");
  if (!vals.length) return "";
  const sum = vals.reduce((a: number, b: number) => a + b, 0);
  return `${sum.toFixed(1)} lb/min`;
}

// ─────────────────────────────────────────────────────────────
// ACF (Altitude Correction Factor)
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

function parseElevationFeet(label: string, units: Units): number | null {
  // Expected formats like "0FT/0KM", "5000FT/1.52KM", "-3000FT/-0.92KM"
  // We will prefer FT component before the slash.
  if (!label) return null;
  const ftIdx = label.toUpperCase().indexOf("FT");
  if (ftIdx > 0) {
    const num = parseFloat(label.slice(0, ftIdx));
    return isFinite(num) ? num : null;
  }
  // fallback: parse KM after slash
  const slashIdx = label.indexOf("/");
  const kmIdx = label.toUpperCase().indexOf("KM");
  if (slashIdx >= 0 && kmIdx > slashIdx) {
    const km = parseFloat(label.slice(slashIdx + 1, kmIdx));
    if (isFinite(km)) return km * 3280.84;
  }
  return null;
}

export function calcACF(elevationLabel: string, units: Units): number {
  const ft = parseElevationFeet(elevationLabel, units);
  if (ft == null) return 1.0;
  // nearest match in table
  let best = ACF_TABLE[0];
  let bestErr = Math.abs(ft - best.ft);
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
// FM spacing check (simplified mirror of legacy)
// ─────────────────────────────────────────────────────────────
function checkFMSpacing(
  enc: Enclosure,
  nEmitters: number,
  sizeLabel: '5/8"' | '3/8"' | '1/2"',
  units: Units
): boolean {
  const L = toFeet(enc.length ?? 0, units);
  const W = toFeet(enc.width ?? 0, units);

  // Distances in ft per legacy rules
  let dMax = 0,
    dMin = 0,
    dwMax = 0,
    dwMin = 0;
  if (sizeLabel === '5/8"') {
    dMax = 20; // FM sidewall table max between (we’ll be slightly conservative vs. pendent 16)
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
    L > 2 * dwMax + (nEmitters - 1) * dMax ||
    W < 2 * dwMin ||
    W > 2 * dwMax + (nEmitters - 1) * dMax ||
    nEmitters < Emin ||
    nEmitters > Emax
  ) {
    return false;
  }
  return true;
}
// --- Solver: pick bundle + emitter count that satisfies method constraints ---

type SolveOk = {
  ok: true;
  bundle: Bundle;
  emitters: number;
  tActualMin: number;
};
type SolveFail = {
  ok: false;
  bundle: Bundle;
  emitters: number; // best attempt for this bundle
  tActualMin: number;
  reason: "TOO_SHORT" | "TOO_LONG" | "ZERO_EMITTERS";
  gap: number; // absolute minutes away from the nearest bound
};

function solveForBundle(
  method: Enclosure["method"],
  bundle: Bundle,
  totalUsableLb: number
): SolveOk | SolveFail {
  const tExp = getExpectedTime(method);
  const q = bundle.q_n2;

  if (method === "FM Data Centers") {
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

  // NFPA 770 (A/C or B) — want integer n with 2.1 ≤ t ≤ tExp
  const tMin = 2.1;
  const nMin = Math.ceil(totalUsableLb / (q * tExp));
  const nMax = Math.floor(totalUsableLb / (q * tMin));

  if (nMin > 0 && nMax >= nMin) {
    const n = nMin; // smallest that still meets ≤ tExp
    const t = totalUsableLb / (q * n);
    return { ok: true, bundle, emitters: n, tActualMin: t };
  }

  // No feasible n for this bundle: choose the closest bound as “best attempt”
  // try toward meeting tExp first (smaller n), but never below 1
  const nTry = Math.max(1, nMin);
  const tTry = totalUsableLb / (q * nTry);
  let reason: SolveFail["reason"];
  let gap = 0;
  if (tTry < tMin) {
    reason = "TOO_SHORT";
    gap = tMin - tTry;
  } else if (tTry > tExp) {
    reason = "TOO_LONG";
    gap = tTry - tExp;
  } else {
    // theoretically shouldn't happen because we would be feasible
    reason = "TOO_LONG";
    gap = 0;
  }
  return { ok: false, bundle, emitters: nTry, tActualMin: tTry, reason, gap };
}

function getMethodBundlesForEnclosure(enc: Enclosure): Bundle[] {
  const all = BUNDLES.filter((b) => b.method === enc.method);
  // Filter by selected nozzle (if it implies a size) and by style
  const code = (enc.nozzleCode || "").toLowerCase();
  const preferSize: Bundle["sizeLabel"] | undefined = code.includes("58")
    ? '5/8"'
    : code.includes("12")
      ? '1/2"'
      : code.includes("38")
        ? '3/8"'
        : undefined;

  let list = preferSize ? all.filter((b) => b.sizeLabel === preferSize) : all;
  if (enc.emitterStyle) {
    list = list.filter((b) => b.allowedStyles.includes(enc.emitterStyle!));
  }
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

    // res is still a union; narrow using property check
    if ("gap" in res) {
      if (!bestMiss || res.gap < bestMiss.gap) bestMiss = res;
    }
  }

  if (bestMiss) return bestMiss;

  return {
    ok: false,
    bundle: BUNDLES[0],
    emitters: 0,
    tActualMin: 0,
    reason: "ZERO_EMITTERS",
    gap: Infinity,
  };
}
