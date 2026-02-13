// src/core/preengineered/partcode.ts
//
// Pre-engineered system partcode encode/decode + strict validation.
//
// Key rules (as confirmed):
// - 15 total characters, alphanumeric only (hyphens/spaces allowed in input but stripped)
// - Digits 2–3 encode cylinder size + count:
//     * '4' + '1'..'4'  => 49L, 1–4 cylinders
//     * '8' + '1'..'8'  => 80L, 1–8 cylinders
//   (Builder never produces 49L counts 5+; it would switch to 80L.)
// - Digit mapping elsewhere matches your existing behavior.
//
// IMPORTANT:
// - "Loose" normalization is ONLY for formatting / best-effort display.
// - "Strict" normalization is used for validate/decode (no padding/truncation).

import type {
  Project,
  System,
  Zone,
  Enclosure,
  PreEngineeredOptions,
} from "@/state/app-model";

import {
  resolveEmitterSpec,
  findNozzleByPeCode,
} from "@/core/catalog/emitter.catalog";
import { TANKS } from "@/core/catalog/water_tanks.catalog";
import type { Codes } from "@/core/catalog/parts.constants";

/* ──────────────────────────────────────────────────────────────
   Indices & types
   ────────────────────────────────────────────────────────────── */

const PC_LEN = 15 as const;

const IDX = {
  PRODUCT: 0, // 'S'
  CYL_SIZE: 1, // '4' or '8'
  CYL_COUNT: 2, // '1'..'4' or '1'..'8' depending on size
  REFILL_ADAPTER: 3, // '1' or '2'
  FIX_9: 4, // '9'
  FIX_P: 5, // 'P'
  FIX_E: 6, // 'E'
  HAZARD: 7, // 'A'|'B'|'F'
  NOZZLE_CODE: 8, // your "pe_code"/orifice-ish char used by findNozzleByPeCode
  EMITTER_COUNT: 9, // '1'..'8' (single digit)
  STYLE: 10, // 'S'|'E'|'P' (plus special rule for FM)
  TANK: 11, // tank code (pe_code from TANKS)
  POWER: 12, // '1'|'2'
  TRANSDUCER: 13, // 'S'|'E'
  BULK_REFILL: 14, // '0'|'1'
} as const;

type DecodePartcodeErrorReason =
  | "empty"
  | "length"
  | "digit"
  | "conflict"
  | "invalid";

export type DecodePartcodeResult =
  | {
    ok: false;
    reason: DecodePartcodeErrorReason;
    digit?: string | number;
    message?: string;
  }
  | { ok: true; decoded: DecodedPreEngConfig };

export interface DecodedPreEngConfig {
  raw: string; // strict 15-char code
  formatted: string; // S-xxx-9PE-xxx-xxx-xx
  prePatch: Partial<PreEngineeredOptions>;
  zonePatch: Partial<Zone>;
  enclosurePatch: Partial<Enclosure>;
}

/* ──────────────────────────────────────────────────────────────
   Normalization / formatting
   ────────────────────────────────────────────────────────────── */

/**
 * Remove hyphens/whitespace/anything non-alphanumeric, uppercase.
 * If missing leading 'S', prefix it.
 * Pad/truncate to 15.
 *
 * USE CASE: display / formatting only.
 */
export function normalizeSystemPartcodeLoose(
  input: string | null | undefined,
): string | null {
  if (!input) return null;

  const stripped = String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  if (!stripped) return null;

  const withS = stripped.startsWith("S") ? stripped : `S${stripped}`;
  return withS.padEnd(PC_LEN, "0").slice(0, PC_LEN);
}

/**
 * Strict normalize: strip non-alphanumeric and uppercase, but
 * DO NOT pad/truncate. Must be exactly 15 characters.
 *
 * USE CASE: validation / decoding (sales admin verification).
 */
export function normalizeSystemPartcodeStrict(
  input: string | null | undefined,
): string | null {
  if (!input) return null;

  const stripped = String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  if (!stripped) return null;
  if (stripped.length !== PC_LEN) return null;
  return stripped;
}

/**
 * Format raw 15-char code to display form:
 *   S-xxx-9PE-xxx-xxx-xx
 */
export function formatSystemPartCode(raw: string): string {
  const s = normalizeSystemPartcodeLoose(raw);
  if (!s) return "";

  const seg1 = s.slice(1, 4); // cyl size + cyl count + adapter
  const seg2 = "9PE";
  const seg3 = s.slice(7, 10); // hazard + nozzle code + emitter count
  const seg4 = s.slice(10, 13); // style + tank + power
  const seg5 = s.slice(13, 15); // transducer + bulk refill

  return `S-${seg1}-${seg2}-${seg3}-${seg4}-${seg5}`;
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function isDigitInRange(ch: string, min: number, max: number) {
  if (!/^\d$/.test(ch)) return false;
  const n = Number(ch);
  return Number.isFinite(n) && n >= min && n <= max;
}

function allowedCylinderPair(size: string, count: string): boolean {
  if (size === "4") return isDigitInRange(count, 1, 4);
  if (size === "8") return isDigitInRange(count, 1, 8);
  return false;
}

function methodFromHazard(h: string): Enclosure["designMethod"] | undefined {
  switch (h) {
    case "A":
      return "NFPA 770 Class A/C" as any;
    case "B":
      return "NFPA 770 Class B" as any;
    case "F":
      return "FM Data Centers" as any;
    default:
      return undefined;
  }
}

function hazardFromMethod(m: any): string {
  switch (m) {
    case "NFPA 770 Class A/C":
      return "A";
    case "NFPA 770 Class B":
      return "B";
    case "FM Data Centers":
      return "F";
    default:
      return "?";
  }
}

function styleCharFromEmitterStyle(style: any): string {
  if (style === "standard-stainless") return "S";
  if (style === "escutcheon-stainless") return "E";
  if (style === "standard-pvdf") return "P";
  return "?";
}

function emitterStyleFromStyleChar(ch: string): any | undefined {
  if (ch === "S") return "standard-stainless";
  if (ch === "E") return "escutcheon-stainless";
  if (ch === "P") return "standard-pvdf";
  return undefined;
}

function safeChar(ch: string | undefined, fallback: string) {
  if (!ch) return fallback;
  return String(ch).slice(0, 1);
}

function tankCodeAllowedSet(): Set<string> {
  // TANKS entries have .pe_code (single char). Build allowed set.
  const s = new Set<string>();
  for (const t of TANKS) {
    if (t?.pe_code) s.add(String(t.pe_code).slice(0, 1).toUpperCase());
  }
  return s;
}

/* ──────────────────────────────────────────────────────────────
   Validation
   ────────────────────────────────────────────────────────────── */

type ValidationOk = { ok: true; raw: string; formatted: string };
type ValidationErr = {
  ok: false;
  reason: DecodePartcodeErrorReason;
  digit?: string | number;
  message?: string;
};

function validateUserSystemPartcodeStrict(
  input: string | null | undefined,
): ValidationOk | ValidationErr {
  if (!input)
    return { ok: false, reason: "empty", message: "Partcode is empty." };

  const raw = normalizeSystemPartcodeStrict(input);
  if (!raw) {
    // differentiate empty vs length
    const stripped = String(input)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
    if (!stripped)
      return { ok: false, reason: "empty", message: "Partcode is empty." };
    return {
      ok: false,
      reason: "length",
      digit: stripped.length,
      message: `Partcode must be ${PC_LEN} characters.`,
    };
  }

  // 1: must be 'S'
  if (raw[IDX.PRODUCT] !== "S") {
    return {
      ok: false,
      reason: "digit",
      digit: "1",
      message: "Digit 1 must be 'S'.",
    };
  }

  // 2–3: cylinder size + count
  const d2 = raw[IDX.CYL_SIZE];
  const d3 = raw[IDX.CYL_COUNT];

  if (!allowedCylinderPair(d2, d3)) {
    return {
      ok: false,
      reason: "conflict",
      digit: "2 & 3",
      message: "Digits 2–3 must be 49L (41–44) or 80L (81–88).",
    };
  }

  // 4: refill adapter
  const d4 = raw[IDX.REFILL_ADAPTER];
  if (d4 !== "1" && d4 !== "2") {
    return {
      ok: false,
      reason: "digit",
      digit: "4",
      message: "Digit 4 must be '1' or '2'.",
    };
  }

  // 5–7: fixed 9PE
  if (raw.slice(IDX.FIX_9, IDX.FIX_E + 1) !== "9PE") {
    return {
      ok: false,
      reason: "digit",
      digit: "5-7",
      message: "Digits 5–7 must be '9PE'.",
    };
  }

  // 8: hazard
  const d8 = raw[IDX.HAZARD];
  if (d8 !== "A" && d8 !== "B" && d8 !== "F") {
    return {
      ok: false,
      reason: "digit",
      digit: "8",
      message: "Digit 8 must be 'A', 'B', or 'F'.",
    };
  }

  // 9: depends on hazard
  const d9 = raw[IDX.NOZZLE_CODE];
  if (d8 === "A") {
    const allowed = new Set(["A", "B", "E", "F"]);
    if (!allowed.has(d9)) {
      return {
        ok: false,
        reason: "conflict",
        digit: "8 & 9",
        message: "Digit 9 conflicts with Digit 8 (A-hazard).",
      };
    }
  } else if (d8 === "B") {
    const allowed = new Set(["A", "B", "C", "D"]);
    if (!allowed.has(d9)) {
      return {
        ok: false,
        reason: "conflict",
        digit: "8 & 9",
        message: "Digit 9 conflicts with Digit 8 (B-hazard).",
      };
    }
  } else if (d8 === "F") {
    const allowed = new Set(["B", "F"]);
    if (!allowed.has(d9)) {
      return {
        ok: false,
        reason: "conflict",
        digit: "8 & 9",
        message: "Digit 9 conflicts with Digit 8 (FM Data Centers).",
      };
    }
  }

  // 10: emitter count 1–8
  const d10 = raw[IDX.EMITTER_COUNT];
  if (!isDigitInRange(d10, 1, 8)) {
    return {
      ok: false,
      reason: "digit",
      digit: "10",
      message: "Digit 10 must be 1–8.",
    };
  }

  // 11: style code depends on hazard/nozzle code
  const d11 = raw[IDX.STYLE];

  if (d8 === "F") {
    // FM rule: must be E
    if (d11 !== "E") {
      return {
        ok: false,
        reason: "conflict",
        digit: "8 & 11",
        message: "For FM hazard, Digit 11 must be 'E'.",
      };
    }
  } else {
    // NFPA A/B
    if (d9 === "A" || d9 === "B") {
      const allowed = new Set(["E", "S"]);
      if (!allowed.has(d11)) {
        return {
          ok: false,
          reason: "conflict",
          digit: "8/9 & 11",
          message: "Digit 11 conflicts with hazard/nozzle selection.",
        };
      }
    } else if (d9 === "C" || d9 === "D" || d9 === "E" || d9 === "F") {
      const allowed = new Set(["S", "E", "P"]);
      if (!allowed.has(d11)) {
        return {
          ok: false,
          reason: "conflict",
          digit: "8/9 & 11",
          message: "Digit 11 conflicts with hazard/nozzle selection.",
        };
      }
    }
  }

  // 12: tank code must exist in TANKS catalog
  const d12 = raw[IDX.TANK];
  const allowedTanks = tankCodeAllowedSet();

  if (!allowedTanks.has(d12)) {
    return {
      ok: false,
      reason: "digit",
      digit: "12",
      message: "Digit 12 is not a valid tank code.",
    };
  }

  // 13: power supply
  const d13 = raw[IDX.POWER];
  if (d13 !== "1" && d13 !== "2") {
    return {
      ok: false,
      reason: "digit",
      digit: "13",
      message: "Digit 13 must be '1' (120V) or '2' (240V).",
    };
  }

  // 14: transducer
  const d14 = raw[IDX.TRANSDUCER];
  if (d14 !== "S" && d14 !== "E") {
    return {
      ok: false,
      reason: "digit",
      digit: "14",
      message: "Digit 14 must be 'S' or 'E'.",
    };
  }

  // 15: bulk refill
  const d15 = raw[IDX.BULK_REFILL];
  if (d15 !== "0" && d15 !== "1") {
    return {
      ok: false,
      reason: "digit",
      digit: "15",
      message: "Digit 15 must be '0' or '1'.",
    };
  }

  return { ok: true, raw, formatted: formatSystemPartCode(raw) };
}

/* ──────────────────────────────────────────────────────────────
   Forward build: config -> code
   ────────────────────────────────────────────────────────────── */

/**
 * Build the raw + formatted system partcode for a given
 * pre-eng system based on the current configuration.
 *
 * Best effort:
 * - If we can't infer a slot, we write '?'.
 * - We NEVER write multi-character values into a slot.
 */
export function buildPreEngSystemPartcodeFromConfig(
  project: Project,
  sys: System,
): { raw: string; formatted: string } | null {
  if (sys.type !== "preengineered") return null;

  const opts = sys.options as PreEngineeredOptions;
  const zone: Zone | undefined = sys.zones?.[0];
  const enc: Enclosure | undefined = zone?.enclosures?.[0];
  if (!zone || !enc) return null;

  const pc = Array<string>(PC_LEN).fill("0");

  pc[IDX.PRODUCT] = "S";
  pc[IDX.FIX_9] = "9";
  pc[IDX.FIX_P] = "P";
  pc[IDX.FIX_E] = "E";

  // Cylinder size & count
  const is80 = (enc as any)?._cylinderSize === "80L";
  const sizeDigit = is80 ? "8" : "4";

  // Prefer override/custom cylinder count if present; else computed minTotalCylinders
  const cylCountRaw =
    Number((zone as any).customCylinderCount) ||
    Number(zone.requiredCylinderCount) ||
    0;

  // Clamp to allowed for that size
  const maxCount = is80 ? 8 : 4;
  const cylCount = Math.max(0, Math.min(maxCount, Math.floor(cylCountRaw)));
  const countDigit = cylCount > 0 ? String(cylCount) : "0";

  pc[IDX.CYL_SIZE] = safeChar(sizeDigit, "?");
  pc[IDX.CYL_COUNT] = safeChar(countDigit, "?");

  // Refill adapter (system opts)
  if (opts.refillAdapter === "CGA-580") pc[IDX.REFILL_ADAPTER] = "1";
  else if (opts.refillAdapter === "CGA-677") pc[IDX.REFILL_ADAPTER] = "2";
  else pc[IDX.REFILL_ADAPTER] = "?";

  // Hazard/method
  pc[IDX.HAZARD] = safeChar(hazardFromMethod((enc as any).designMethod), "?");

  // Nozzle code + emitter count + style
  const method = (enc as any).designMethod;
  const nozzle = (enc as any).nozzleModel || "";
  const style = (enc as any).nozzleOrientation || "escutcheon-stainless";

  const spec = resolveEmitterSpec(method as any, nozzle, style as any);
  pc[IDX.NOZZLE_CODE] = safeChar(spec?.pe_code, "?");

  const nEmittersRaw =
    Number((enc as any).requiredNozzleCount) ||
    Number((enc as any).customNozzleCount) ||
    0;

  // Pre-eng expects 1–8 emitters; clamp for encoding
  const nEmitters = Math.max(0, Math.min(8, Math.floor(nEmittersRaw)));
  pc[IDX.EMITTER_COUNT] = nEmitters > 0 ? String(nEmitters) : "0";

  pc[IDX.STYLE] = safeChar(styleCharFromEmitterStyle(style), "?");

  // Tank code from waterTankPick if available; else try infer from cert/pick
  const optsAny = sys.options as any;
  let tankDigit = "";

  // waterTankPick is a Codes tuple (or null)
  const pickCode0 = (optsAny?.selectedWaterTankPartCode?.[0] ?? "") as string;
  if (pickCode0) {
    const pick = TANKS.find((t) => t.codes?.[0] === pickCode0);
    tankDigit = pick?.pe_code ?? "";
  } else if (optsAny?.selectedWaterTankPartDesc) {
    // fallback by exact description match
    const pick = TANKS.find((t) => t.description === optsAny.selectedWaterTankPartDesc);
    tankDigit = pick?.pe_code ?? "";
  }

  pc[IDX.TANK] = safeChar(tankDigit, "?");

  // Power supply
  if (opts.powerSupply === "120") pc[IDX.POWER] = "1";
  else if (opts.powerSupply === "240") pc[IDX.POWER] = "2";
  else pc[IDX.POWER] = "0";

  // Transducer
  pc[IDX.TRANSDUCER] = opts.addOns?.isExplosionProof ? "E" : "S";

  // Bulk refill adapter
  pc[IDX.BULK_REFILL] = opts.addOns?.hasBulkRefillAdapter ? "1" : "0";

  const raw = pc.join("");
  const formatted = formatSystemPartCode(raw);

  return { raw, formatted };
}

/* ──────────────────────────────────────────────────────────────
   Reverse decode: code -> config patches
   ────────────────────────────────────────────────────────────── */

export function decodeSystemPartcodeToConfig(
  input: string | null | undefined,
): DecodePartcodeResult {
  const v = validateUserSystemPartcodeStrict(input);
  if (v.ok === false) {
    return {
      ok: false,
      reason: v.reason,
      digit: v.digit,
      message: v.message,
    };
  }

  const raw = v.raw;
  const formatted = v.formatted;
  const pc = raw.split(""); // 15 chars

  const prePatch: Partial<PreEngineeredOptions> = {};
  const zonePatch: Partial<Zone> = {};
  const enclosurePatch: Partial<Enclosure> = {};

  // 1) Cylinder size + count
  const sizeDigit = pc[IDX.CYL_SIZE];
  const countDigit = pc[IDX.CYL_COUNT];

  const cylinderSize = sizeDigit === "8" ? "80L" : "49L";
  const cylCount = Number(countDigit) || 0;

  // Zone cylinder override (matches your UI pattern)
  (zonePatch as any).customCylinderCount = cylCount;
  (zonePatch as any).isCylinderCountOverridden = true;

  // Enclosure cylinder size (stored as non-typed field in your current model)
  (enclosurePatch as any)._cylinderSize = cylinderSize;

  // 2) Refill adapter
  const adapter = pc[IDX.REFILL_ADAPTER];
  if (adapter === "1") prePatch.refillAdapter = "CGA-580" as any;
  else if (adapter === "2") prePatch.refillAdapter = "CGA-677" as any;

  // 3) Hazard / Method
  const hazard = pc[IDX.HAZARD];
  const method = methodFromHazard(hazard);
  if (method) {
    (prePatch as any).designMethod = method; // wait, designMethod is on Enclosure, not options? methodFromHazard returns string.
    (enclosurePatch as any).designMethod = method;
  }

  // 4) Nozzle code + style => nozzleCode lookup
  const nozzlePeCode = pc[IDX.NOZZLE_CODE];
  const styleChar = pc[IDX.STYLE];
  const emitterStyle = emitterStyleFromStyleChar(styleChar);

  if (!method || !emitterStyle || !nozzlePeCode) {
    return {
      ok: false,
      reason: "digit",
      digit: "8-11",
      message: "Missing hazard/method, nozzle code, or style.",
    };
  }

  const nozzleCode = findNozzleByPeCode(
    method as any,
    nozzlePeCode,
    emitterStyle as any,
    {
      systemType: "preengineered",
    } as any,
  );

  if (!nozzleCode) {
    return {
      ok: false,
      reason: "digit",
      digit: "9/11",
      message: "Could not resolve nozzle from hazard + nozzle code + style.",
    };
  }

  (enclosurePatch as any).nozzleModel = nozzleCode;
  (enclosurePatch as any).nozzleOrientation = emitterStyle;

  // 5) Emitter count (single digit 1–8)
  const emitterCount = Number(pc[IDX.EMITTER_COUNT]) || 0;
  (enclosurePatch as any).customNozzleCount = emitterCount;
  (enclosurePatch as any).isNozzleCountOverridden = true;

  // 6) Tank
  const tankDigit = pc[IDX.TANK];
  const tank = TANKS.find((t) => String(t.pe_code).toUpperCase() === tankDigit);

  if (!tank) {
    return {
      ok: false,
      reason: "digit",
      digit: "12",
      message: "Tank code not found in catalog.",
    };
  }

  // set Codes tuple, description and certification
  (prePatch as any).selectedWaterTankPartCode = tank.codes as Codes;
  (prePatch as any).selectedWaterTankPartDesc = tank.description;
  (prePatch as any).waterTankCertification = tank.cert;

  // 7) Power supply
  const power = pc[IDX.POWER];
  if (power === "1") (prePatch as any).powerSupply = "120";
  if (power === "2") (prePatch as any).powerSupply = "240";

  // 8) Add-ons: transducer + bulk refill
  prePatch.addOns = {
    // keep defaults consistent with your model; callers can merge with existing
    hasPlacardsAndSignage: false,
    doorCount: 1,
    hasBulkRefillAdapter: false,
    isExplosionProof: false,
    hasWaterFlexLine: false,
    hasIgsFlexibleHose48: false,
    ...(prePatch.addOns ?? {}),
  } as any;

  const transducer = pc[IDX.TRANSDUCER];
  prePatch.addOns!.isExplosionProof = transducer === "E";

  const bulk = pc[IDX.BULK_REFILL];
  prePatch.addOns!.hasBulkRefillAdapter = bulk === "1";

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

/* ──────────────────────────────────────────────────────────────
   Back-compat alias (optional)
   ────────────────────────────────────────────────────────────── */

/**
 * If other code imports `parseSystemPartcode`, keep this for now.
 * You can delete it after you update imports to call decodeSystemPartcodeToConfig directly.
 */
export function parseSystemPartcode(
  input: string | null | undefined,
): DecodePartcodeResult {
  return decodeSystemPartcodeToConfig(input);
}
