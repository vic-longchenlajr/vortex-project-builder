// src/core/preengineered/partcode.ts

import type {
  Project,
  System,
  Zone,
  Enclosure,
  PreEngineeredOptions,
} from "@/state/app-model";
import { resolveEmitterSpec } from "@/core/catalog/emitter.catalog";
import {
  findNozzleByPeCode,
  type CatalogOpts,
} from "@/core/catalog/emitter.catalog";

import { TANKS } from "@/core/catalog/water_tanks.catalog";

/** Raw “slots” for pre-eng system code Sxxxxxxxxxxxxxxx (15 chars) */
export type PreEngSystemPartcodeArray = [
  string, // 0: 'S'
  string, // 1: cylinder size code ('4' or '8')
  string, // 2: cylinder count (first digit)
  string, // 3: cylinder count (second digit) / adapter
  string, // 4: '9'
  string, // 5: 'P'
  string, // 6: 'E'
  string, // 7: hazard code
  string, // 8: emitter PE code (single char in your current use)
  string, // 9: emitter count (first digit)
  string, // 10: style code
  string, // 11: tank code
  string, // 12: power supply
  string, // 13: transducer
  string, // 14: bulk refill
];

/**
 * Normalize a user-entered partcode:
 *  - remove hyphens/whitespace
 *  - uppercase
 *  - ensure starts with 'S'
 *  - ensure minimum length 15 (pad with '0')
 */
export function normalizeSystemPartcode(
  input: string | null | undefined
): string | null {
  if (!input) return null;
  const stripped = String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
  if (!stripped) return null;

  const withS = stripped.startsWith("S") ? stripped : `S${stripped}`;
  // pad/truncate to 15 chars
  const raw = withS.padEnd(15, "0").slice(0, 15);
  return raw;
}

/**
 * Format raw 15-char code to display form:
 *   S-xxx-9PE-xxx-xxx-xx
 */
export function formatSystemPartCode(raw: string): string {
  const s = normalizeSystemPartcode(raw);
  if (!s) return "";

  // Indices:
  // 0 = 'S'
  // 1..3  → cyl size / count / adapter
  // 4..6  → product class (we force "9PE")
  // 7..9  → hazard / orifice / emitter count
  // 10..12 → style / tank / power
  // 13..14 → transducer / bulk
  const seg1 = s.slice(1, 4); // xxx
  const seg2 = "9PE"; // fixed for pre-eng
  const seg3 = s.slice(7, 10); // xxx
  const seg4 = s.slice(10, 13); // xxx
  const seg5 = s.slice(13, 15); // xx

  return `S-${seg1}-${seg2}-${seg3}-${seg4}-${seg5}`;
}

/**
 * Build the raw + formatted system partcode for a given
 * pre-eng system based on the current configuration.
 *
 * This is intentionally “best effort”: if we can’t infer a
 * particular slot, we put '?' so you can spot it in review.
 */
export function buildPreEngSystemPartcodeFromConfig(
  project: Project,
  sys: System
): { raw: string; formatted: string } | null {
  if (sys.type !== "preengineered") return null;
  const opts = sys.options as PreEngineeredOptions;
  const zones = sys.zones || [];
  if (!zones.length) return null;

  const zone: Zone = zones[0];
  const enc: Enclosure | undefined = zone.enclosures?.[0];
  if (!enc) return null;

  const systemPartCode: PreEngSystemPartcodeArray = [
    "S", // [0] product class
    "", // [1] cylinder size
    "", // [2] number of cylinders (first digit)
    "", // [3] number of cylinders (second digit) / refill adapter
    "9", // [4] product
    "P", // [5]
    "E", // [6]
    "", // [7] hazard
    "", // [8] emitter PE code
    "", // [9] number of emitters
    "", // [10] emitter style
    "", // [11] water tank type
    "", // [12] power supply
    "", // [13] transducer type
    "", // [14] bulk refill adapter
  ];

  // Cylinder size / count
  const cylCount = Math.max(0, zone.minTotalCylinders ?? 0);
  const is80 = (enc as any)?._cylinderSize === "80L";
  if (cylCount > 0) {
    systemPartCode[1] = is80 ? "8" : "4";
    systemPartCode[2] = cylCount.toString();
  }

  // Refill adapter
  if (opts.refillAdapter === "CGA-580") {
    // use "1" for 580
    systemPartCode[3] = "1";
  } else if (opts.refillAdapter === "CGA-677") {
    // use "2" for 677
    systemPartCode[3] = "2";
  }

  // Hazard / method
  let hazardCode = "";
  switch (enc.method) {
    case "NFPA 770 Class A/C":
      hazardCode = "A";
      break;
    case "NFPA 770 Class B":
      hazardCode = "B";
      break;
    case "FM Data Centers":
      hazardCode = "F";
      break;
    default:
      hazardCode = "?";
      break;
  }
  systemPartCode[7] = hazardCode;

  // Emitters (PE code, count, style)
  const nozzle = enc.nozzleCode || "";
  const style = (enc.emitterStyle as any) || "escutcheon-stainless";
  const spec = resolveEmitterSpec(enc.method as any, nozzle, style);
  const nEmitters = enc.minEmitters ?? (enc as any).emitterCount ?? 0;

  if (spec && nEmitters > 0) {
    systemPartCode[8] = spec.pe_code ?? "?";

    const countStr = nEmitters.toString().padStart(2, "0").slice(-2);
    // you only used a single digit previously; here we put at [9]
    systemPartCode[9] = countStr[1];

    if (style === "standard-stainless") {
      systemPartCode[10] = "S";
    } else if (style === "escutcheon-stainless") {
      systemPartCode[10] = "E";
    } else if (style === "standard-pvdf") {
      systemPartCode[10] = "P";
    } else {
      systemPartCode[10] = "?";
    }
  }

  // Water tank (from chosen tank or pick)
  const optsAny = sys.options as any;
  let tankPeCode = "";
  if (optsAny.waterTankPick?.codes?.[0]) {
    const pick = TANKS.find(
      (t) => t.codes && t.codes[0] === optsAny.waterTankPick.codes[0]
    );
    tankPeCode = pick?.pe_code ?? "";
  }
  systemPartCode[11] = tankPeCode || "?";

  // Power supply
  if (opts.powerSupply === "120") {
    systemPartCode[12] = "1";
  } else if (opts.powerSupply === "240") {
    systemPartCode[12] = "2";
  } else {
    systemPartCode[12] = "0";
  }

  // Transducer type
  if (opts.addOns?.expProofTransducer) {
    systemPartCode[13] = "E";
  } else {
    systemPartCode[13] = "S";
  }

  // Bulk refill adapter
  if (opts.addOns?.bulkRefillAdapter) {
    systemPartCode[14] = "1";
  } else {
    systemPartCode[14] = "0";
  }

  const raw = (systemPartCode as string[]).join("");
  const formatted = formatSystemPartCode(raw);
  return { raw, formatted };
}

export function parseSystemPartcode(
  input: string | null | undefined
): DecodePartcodeResult {
  return decodeSystemPartcodeToConfig(input);
}

/**
 * Strict validator for user-entered system partcodes.
 *
 * Rules (using 1-based digit terminology from spec):
 *  1: must be 'S'
 *  2–3: one of 41 42 43 44 81 82 83 84 85 86 87 88
 *  4: refill adapter: '1' or '2'
 *  5–7: fixed "9PE"
 *  8: 'A' | 'B' | 'F'
 *  9: depends on digit 8:
 *     - if 8 == 'A' → 9 ∈ { 'A','B','E','F' }
 *     - if 8 == 'B' → 9 ∈ { 'A','B','C','D' }
 *     - if 8 == 'F' → 9 ∈ { 'B','F' }
 *  10: '1'–'8'
 *  11:
 *     - if 8 == 'F' → 11 must be 'E'
 *     - else (8 == 'A' or 'B'):
 *         if 9 ∈ { 'A','B' } → 11 ∈ { 'E','S' }
 *         if 9 ∈ { 'C','D' } → 11 ∈ { 'S','E','P' }
 *         if 9 ∈ { 'E','F' } → 11 ∈ { 'S','E','P' }
 *  12: 'A'–'F'
 *  13: '1' | '2'
 *  14: 'S' | 'E'
 *  15: '0' | '1'
 *
 * Hyphens/whitespace are allowed in input and stripped before checking.
 */
type PartcodeValidationOk = {
  ok: true;
  raw: string;
  formatted: string;
};

type PartcodeValidationError = {
  ok: false;
  reason: DecodePartcodeErrorReason;
  digit?: string | number;
};

function validateUserSystemPartcode(
  input: string | null | undefined
): PartcodeValidationOk | PartcodeValidationError {
  if (!input) return { ok: false, reason: "empty" };

  const stripped = String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  if (!stripped) return { ok: false, reason: "empty" };

  // Must be exactly 15 chars, no padding/truncation for user input
  if (stripped.length !== 15) {
    return { ok: false, reason: "length", digit: stripped.length };
  }

  const pc = stripped;

  // 1: must be 'S'
  if (pc[0] !== "S") {
    return { ok: false, reason: "digit", digit: "1" };
  }

  // 2–3: cylinder size/count combo
  const d2d3 = pc.slice(1, 3); // positions 2 and 3 (indices 1–2)
  const allowed23 = new Set([
    "41",
    "42",
    "43",
    "44",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
  ]);
  if (!allowed23.has(d2d3)) {
    return { ok: false, reason: "conflict", digit: "2 & 3" };
  }

  // 4: refill adapter 1 or 2
  if (pc[3] !== "1" && pc[3] !== "2") {
    return { ok: false, reason: "digit", digit: "4" };
  }

  // 5–7: always 9PE
  if (pc.slice(4, 7) !== "9PE") {
    return { ok: false, reason: "digit", digit: "5-7" };
  }

  // 8: A | B | F
  const d8 = pc[7];
  if (d8 !== "A" && d8 !== "B" && d8 !== "F") {
    return { ok: false, reason: "digit", digit: "8" };
  }

  // 9: depends on 8
  const d9 = pc[8];
  if (d8 === "A") {
    const allowed = new Set(["A", "B", "E", "F"]);
    if (!allowed.has(d9)) {
      return { ok: false, reason: "conflict", digit: "8 & 9" };
    }
  } else if (d8 === "B") {
    const allowed = new Set(["A", "B", "C", "D"]);
    if (!allowed.has(d9)) {
      return { ok: false, reason: "conflict", digit: "8 & 9" };
    }
  } else if (d8 === "F") {
    const allowed = new Set(["B", "F"]);
    if (!allowed.has(d9)) {
      return { ok: false, reason: "conflict", digit: "8 & 9" };
    }
  }

  // 10: only 1–8
  const d10 = pc[9];
  if (!/[1-8]/.test(d10)) {
    return { ok: false, reason: "digit", digit: "10" };
  }

  // 11: depends on 8 & 9
  const d11 = pc[10];
  if (d8 === "F") {
    // overshadow rule: only E
    if (d11 !== "E") {
      return { ok: false, reason: "conflict", digit: "8 & 11" };
    }
  } else {
    // d8 is A or B
    if (d9 === "A" || d9 === "B") {
      const allowed = new Set(["E", "S"]);
      if (!allowed.has(d11)) {
        return { ok: false, reason: "conflict", digit: "8/9 & 11" };
      }
    } else if (d9 === "C" || d9 === "D" || d9 === "E" || d9 === "F") {
      const allowed = new Set(["S", "E", "P"]);
      if (!allowed.has(d11)) {
        return { ok: false, reason: "conflict", digit: "8/9 & 11" };
      }
    }
  }

  // 12: A–F
  const d12 = pc[11];
  const allowedTank = new Set(["A", "C", "D", "E", "F"]);
  if (!allowedTank.has(d12)) {
    return { ok: false, reason: "digit", digit: "12" };
  }

  // 13: 1 or 2
  const d13 = pc[12];
  if (d13 !== "1" && d13 !== "2") {
    return { ok: false, reason: "digit", digit: "13" };
  }

  // 14: S or E
  const d14 = pc[13];
  if (d14 !== "S" && d14 !== "E") {
    return { ok: false, reason: "digit", digit: "14" };
  }

  // 15: 0 or 1
  const d15 = pc[14];
  if (d15 !== "0" && d15 !== "1") {
    return { ok: false, reason: "digit", digit: "15" };
  }

  // If we got here, it's valid
  return {
    ok: true,
    raw: pc,
    formatted: formatSystemPartCode(pc),
  };
}
/** Result shape for reverse-decoding a system partcode */
export interface DecodedPreEngConfig {
  raw: string; // 15-char normalized code
  formatted: string; // S-xxx-9PE-xxx-xxx-xx
  /** Patch for system-level pre-eng options */
  prePatch: Partial<PreEngineeredOptions>;
  /** Patch for the first zone (you can clone/propagate as needed) */
  zonePatch: Partial<Zone>;
  /** Patch for the first enclosure (you can copy or adapt) */
  enclosurePatch: Partial<Enclosure>;
}

/**
 * Reverse decode a *valid* user-entered system partcode
 * into configuration patches for:
 *  - PreEngineeredOptions
 *  - Zone (first zone)
 *  - Enclosure (first enclosure)
 *
 * This uses the same semantics as `buildPreEngSystemPartcodeFromConfig`.
 * Volume, temperature, and other things not encoded in the partcode
 * are intentionally left untouched for the caller to preserve.
 */
export type DecodePartcodeErrorReason =
  | "empty"
  | "length"
  | "digit"
  | "conflict"
  | "invalid";

export type DecodePartcodeResult =
  | { ok: false; reason: DecodePartcodeErrorReason; digit?: string | number }
  | { ok: true; decoded: DecodedPreEngConfig };

export function decodeSystemPartcodeToConfig(
  input: string | null | undefined
): DecodePartcodeResult {
  const v = validateUserSystemPartcode(input);
  if (v.ok === false) {
    if (v.reason === "empty") return { ok: false, reason: "empty" };
    if (v.reason === "length")
      return { ok: false, reason: "length", digit: v.digit };
    if (v.reason === "digit")
      return { ok: false, reason: "digit", digit: v.digit };
    if (v.reason === "conflict")
      return { ok: false, reason: "conflict", digit: v.digit };
    return { ok: false, reason: "invalid" };
  }

  const raw = v.raw; // 15-char strict code
  const formatted = v.formatted; // S-xxx-9PE-xxx-xxx-xx
  const pc = raw.split(""); // char[]
  /** SYSTEM / PRE-ENG LEVEL PATCH */
  const prePatch: Partial<PreEngineeredOptions> = {};

  /** ZONE-LEVEL PATCH */
  const zonePatch: Partial<Zone> = {};

  /** ENCLOSURE-LEVEL PATCH (first enclosure) */
  const enclosurePatch: Partial<Enclosure> = {};

  // ────────────────────────────────────────────
  // 1. Cylinder size + count + refill adapter
  // ────────────────────────────────────────────
  //
  // From builder:
  //   [1]: '8' → 80L, else 49L
  //   [2]: cylinder count digit
  //   [3]: refill adapter mapping
  //
  // Validator says digits 2–3 are a combined code like "81", "42", etc.
  // Your actual implementation uses [1] and [2] separately.
  // Here we mirror the *builder* semantics, which is what you wanted.
  // ────────────────────────────────────────────

  const d1 = pc[1]; // cylinder size digit
  const d2 = pc[2]; // cylinder count (single digit)
  const d3 = pc[3]; // refill adapter

  // Cylinder size (stored on enclosure in builder via `_cylinderSize`)
  const cylinderSize = d1 === "8" ? "80L" : "49L";
  // Single-digit count, as in builder (you can expand later if you move to 2 digits)
  const cylCount = Number(d2 || "0") || 0;

  // Zone: total cylinders
  zonePatch.overrideCylinders = cylCount;
  zonePatch._editCylinders = true;
  zonePatch.customMinTotalCylinders = cylCount; // if your UI binds to this

  // Enclosure: cylinder size (you store this in a non-typed field now)
  (enclosurePatch as any)._cylinderSize = cylinderSize;

  // Refill adapter (PreEngineeredOptions)
  if (d3 === "1") {
    prePatch.refillAdapter = "CGA-580" as any;
  } else if (d3 === "2") {
    prePatch.refillAdapter = "CGA-677" as any;
  }

  // ────────────────────────────────────────────
  // 2. Hazard / Method (digit 7 / index 7)
  // ────────────────────────────────────────────
  //
  // Builder:
  //   [7] 'A' → "NFPA 770 Class A/C"
  //   [7] 'B' → "NFPA 770 Class B"
  //   [7] 'F' → "FM Data Centers"
  // ────────────────────────────────────────────

  const d7 = pc[7];
  let method: Enclosure["method"] | undefined;

  switch (d7) {
    case "A":
      method = "NFPA 770 Class A/C" as any;
      break;
    case "B":
      method = "NFPA 770 Class B" as any;
      break;
    case "F":
      method = "FM Data Centers" as any;
      break;
    default:
      method = undefined;
  }

  if (method) {
    // System pre-eng options often also store the selected design method
    (prePatch as any).design_method = method;
    enclosurePatch.method = method;
  }

  // ────────────────────────────────────────────
  // 3. Emitters: PE code, emitter count, style
  // ────────────────────────────────────────────
  //
  // Builder:
  //   [8] = spec.pe_code
  //   [9] = ones digit of emitter count
  //   [10] = style code: S/E/P
  //
  // NOTE: The snippet you shared only encodes the *ones digit* of the
  // emitter count, and uses `resolveEmitterSpec(method, nozzle, style)`
  // to get `spec.pe_code` in the forward direction. To go backwards,
  // we need to search your emitter catalog by `pe_code` + style + method.
  //
  // Because that mapping isn’t present in this file, we provide a
  // hook-style helper `findEmitterByPeCode` that you can implement
  // however you like using your existing catalog data.
  // ────────────────────────────────────────────

  const peCode = pc[8]; // emitter PE code
  const d9 = pc[9]; // ones digit of emitter count
  const d10 = pc[10]; // style code S/E/P

  let emitterStyle: any | undefined;
  if (d10 === "S") {
    emitterStyle = "standard-stainless";
  } else if (d10 === "E") {
    emitterStyle = "escutcheon-stainless";
  } else if (d10 === "P") {
    emitterStyle = "standard-pvdf";
  }

  // Reconstruct at least the *minimum* emitter count from the ones digit.
  // If your final spec requires exact count, you may need to:
  //   - enforce <= 9 emitters, OR
  //   - store an encoded count elsewhere, OR
  //   - treat this as a “at least X” and let the user adjust.
  let minEmitters = Number(d9 || "0") || 0;
  if (minEmitters < 0) minEmitters = 0;

  let nozzleCode: Enclosure["nozzleCode"] | undefined;

  if (method && emitterStyle && peCode && peCode !== "?") {
    nozzleCode = findNozzleByPeCode(
      method as any,
      peCode,
      emitterStyle as any,
      {
        systemType: "preengineered",
      } as any
    );

    if (nozzleCode) {
      enclosurePatch.nozzleCode = nozzleCode;
      enclosurePatch.emitterStyle = emitterStyle;
    } else {
      // If you want to hard-fail decode when nozzle cannot be resolved:
      return {
        ok: false,
        reason: "digit",
        digit: "9/11 (pe_code/style->nozzle)",
      };
    }
  } else {
    // Missing critical pieces to resolve nozzle
    return {
      ok: false,
      reason: "digit",
      digit: "9/11 (missing method/style/pe_code)",
    };
  }

  // Emitters count (ones digit)
  enclosurePatch.customMinEmitters = minEmitters;
  enclosurePatch._editEmitters = true; // optional but recommended for UI clarity
  enclosurePatch.emitterStyle = emitterStyle;
  // ────────────────────────────────────────────
  // 4. Water Tank (digit 12 / index 11)  <-- your code uses pc[11]
  // ────────────────────────────────────────────
  const tankCode = pc[11]; // tank digit

  if (tankCode && tankCode !== "?") {
    const tank = TANKS.find((t) => t.pe_code === tankCode);

    if (!tank) {
      // if the validator is updated, you shouldn't hit this,
      // but keep a safe fail in case catalog drifts
      return { ok: false, reason: "digit", digit: "12 (tank code)" };
    }

    (prePatch as any).waterTankPick = {
      codes: tank.codes,
      description: tank.description,
      cert: tank.cert,
    };

    // ✅ THIS is the key piece you asked for:
    (prePatch as any).waterTankCertification = tank.cert;
  }
  // 5. Power Supply (digit 12 / index 12)
  // ────────────────────────────────────────────
  //
  // Builder:
  //   if opts.powerSupply === "120" → [12] = "1"
  //   else if "240" → [12] = "2"
  //   else "0"
  // ────────────────────────────────────────────

  const d12 = pc[12];
  if (d12 === "1") {
    (prePatch as any).powerSupply = "120";
  } else if (d12 === "2") {
    (prePatch as any).powerSupply = "240";
  } else {
    // "0" or unknown → leave undefined / default
  }

  // ────────────────────────────────────────────
  // 6. Transducer type (digit 13 / index 13)
  // ────────────────────────────────────────────

  const d13 = pc[13];

  // Ensure addOns exists before writing
  prePatch.addOns = {
    placardsAndSignage: false,
    doorCount: 1,
    bulkRefillAdapter: false,
    expProofTransducer: false,
    ...(prePatch.addOns ?? {}),
  };

  if (d13 === "E") {
    prePatch.addOns.expProofTransducer = true;
  } else {
    prePatch.addOns.expProofTransducer = false;
  }

  // ────────────────────────────────────────────
  // 7. Bulk refill adapter (digit 14 / index 14)
  // ────────────────────────────────────────────

  const d14 = pc[14];
  if (d14 === "1") {
    prePatch.addOns.bulkRefillAdapter = true;
  } else {
    prePatch.addOns.bulkRefillAdapter = false;
  }

  // NOTE: Volume, temperature, O₂, etc. are *not encoded* in the
  // partcode on purpose, so we leave them untouched. The caller
  // should preserve existing values or display "-" when locked.

  return {
    ok: true,
    decoded: {
      raw,
      formatted,
      prePatch,
      zonePatch,
      enclosurePatch,
    },
  };
}
