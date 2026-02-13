// src/core/calc/preengineered/guidance.ts
import { Enclosure, Project } from "@/state/app-model";

type SizeLabel = '3/8"' | '1/2"' | '5/8"';

export type Guidance = {
  openMaxFt2: number;
  openMinFt2: number;
  pendent: {
    size: SizeLabel;
    distBetween: string; // human text
    minToWallFt: number;
    minToWallM: number;
    foilToCeilingIn: [number, number]; // [min, max]
    foilToCeilingMm: [number, number];
  };
  sidewall?: {
    size: SizeLabel;
    distBetween: string; // human text
    minToAdjWallFt: number;
    minToAdjWallM: number;
  };
};

const FT2_TO_M2 = 0.092903;
const IN2_TO_MM = 25.4;

function toMeters(ft: number) {
  return +(ft * 0.3048).toFixed(1);
}
function toMm(inches: number) {
  return Math.round(inches * IN2_TO_MM);
}

/** NFPA 770 opening limits (per emitter) vary by size *and* pressure */
const NFPA_OPENINGS_BY_PSI: Record<
  SizeLabel,
  Record<25 | 50, { max: number; min: number }>
> = {
  '3/8"': { 50: { max: 1.1, min: 0.11 }, 25: { max: 0.71, min: 0.06 } },
  // If your legacy used 1.11 ft² minimum for 1/2" @ 25 psi, swap the min below.
  '1/2"': { 50: { max: 2.15, min: 0.18 }, 25: { max: 1.25, min: 0.18 } },
  '5/8"': { 50: { max: 2.75, min: 0.27 }, 25: { max: 2.15, min: 0.18 } },
};

/** FM DC opening limits (per emitter) */
const FMDC_OPENINGS: Record<'3/8"' | '5/8"', { max: number; min: number }> = {
  '3/8"': { max: 0.83, min: 0.11 },
  '5/8"': { max: 2.0, min: 0.27 },
};

const FOIL_TO_CEILING_IN: [number, number] = [4.5, 24];

/**
 * Helper to parse the solved bundle label like: `5/8" Cavity @ 50 psi`
 */
function parseSolvedBundleLabel(label?: string): {
  size?: SizeLabel;
  opPsi?: 25 | 50;
} {
  if (!label) return {};
  const m = label.match(/((?:3\/8|1\/2|5\/8)")\s+.*@\s+(25|50)\s*psi/i);
  if (!m) return {};
  const size = m[1] as SizeLabel;
  const op = Number(m[2]) as 25 | 50;
  return { size, opPsi: op };
}

/**
 * Build guidance directly from a solved selection (preferred).
 * You can call this from the calculator after solving.
 */
export function buildGuidanceFromSolution(params: {
  method: Enclosure["designMethod"];
  size: SizeLabel;
  opPsi: 25 | 50;
  emitters: number;
}): Guidance {
  const { method, size, opPsi, emitters } = params;

  // Per-emitter opening limits
  let perMax = 0,
    perMin = 0;
  if (method === "FM Data Centers") {
    const s = (size === '1/2"' ? '5/8"' : size) as '3/8"' | '5/8"';
    perMax = FMDC_OPENINGS[s].max;
    perMin = FMDC_OPENINGS[s].min;
  } else {
    perMax = NFPA_OPENINGS_BY_PSI[size][opPsi].max;
    perMin = NFPA_OPENINGS_BY_PSI[size][opPsi].min;
  }

  const openMaxFt2 = +(perMax * Math.max(emitters, 0)).toFixed(2);
  const openMinFt2 = +(perMin * Math.max(emitters, 0)).toFixed(2);

  // Pendent spacing text
  const pendent = {
    size,
    distBetween:
      method === "FM Data Centers"
        ? size === '5/8"'
          ? "Max 16 ft / Min 8 ft between; Max 16 ft / Min 3 ft to wall."
          : "Max 10 ft / Min 6 ft between; Max 10 ft / Min 2 ft to wall."
        : 'Evenly distributed throughout space following "Piping Layout Rules".',
    minToWallFt: size === '5/8"' ? 3 : size === '1/2"' ? 2.5 : 2,
    minToWallM: toMeters(size === '5/8"' ? 3 : size === '1/2"' ? 2.5 : 2),
    foilToCeilingIn: FOIL_TO_CEILING_IN,
    foilToCeilingMm: FOIL_TO_CEILING_IN.map(toMm) as [number, number],
  };

  // Sidewall: show explicit FM sidewall (20 ft) only for 5/8", else omit for FM.
  let sidewall: Guidance["sidewall"] | undefined;
  if (method !== "FM Data Centers") {
    sidewall = {
      size,
      distBetween:
        'Evenly distributed throughout space following "Piping Layout Rules".',
      minToAdjWallFt: size === '5/8"' ? 3 : size === '1/2"' ? 2.5 : 2,
      minToAdjWallM: toMeters(size === '5/8"' ? 3 : size === '1/2"' ? 2.5 : 2),
    };
  } else if (size === '5/8"') {
    sidewall = {
      size,
      distBetween:
        "Max 20 ft / Min 8 ft between; Max 20 ft / Min 3 ft to adjacent wall.",
      minToAdjWallFt: 3,
      minToAdjWallM: toMeters(3),
    };
  }

  return { openMaxFt2, openMinFt2, pendent, sidewall };
}

/**
 * Backward-compatible guidance builder that:
 *  - prefers solved bundle info (enc._emitterBundle & enc.minEmitters)
 *  - falls back to nozzle code heuristics and 50 psi if unsolved
 */
export function computePreEngGuidance(
  enc: Enclosure,
  _project: Project
): Guidance | null {
  if (!enc) return null;

  // Prefer solved guidance if calculator stored one
  // (You can store it at enc._guidance in your calc if desired.)
  const maybeGuidance = (enc as any)?._guidance as Guidance | undefined;
  if (maybeGuidance) return maybeGuidance;

  // Parse from solved bundle label if available
  const solved = parseSolvedBundleLabel((enc as any)?._emitterBundle);

  // Determine size (prefer solved; else infer from nozzle code; else 3/8")
  const inferredSize: SizeLabel =
    (solved.size as SizeLabel) ||
    ((enc.nozzleModel?.includes("5/8") || enc.nozzleModel?.includes("58")) &&
      '5/8"') ||
    ((enc.nozzleModel?.includes("1/2") || enc.nozzleModel?.includes("12")) &&
      '1/2"') ||
    '3/8"';

  // Determine op psi (prefer solved; else default 50 psi)
  const opPsi: 25 | 50 = solved.opPsi ?? 50;

  // Use the solved emitter count when available
  const emitters = Number.isFinite(enc.requiredNozzleCount as any)
    ? (enc.requiredNozzleCount as number)
    : 1;

  return buildGuidanceFromSolution({
    method: enc.designMethod,
    size: inferredSize,
    opPsi,
    emitters,
  });
}

export function fmtFt2AndM2(ft2: number) {
  const m2 = ft2 * FT2_TO_M2;
  return { ft2: ft2.toFixed(2), m2: m2.toFixed(2) };
}
