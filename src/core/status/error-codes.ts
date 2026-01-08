// src/core/status/errorCodes.ts
import type { Severity } from "@/state/app-model";

export type ErrorCode =
  | "PROJ.MISSING_FIELDS"
  | "SYS.MISSING_NAME"
  | "SYS.INVALID_CHARS"
  | "SYS.NO_ZONES"
  | "SYS.PANEL_MISMATCH"
  | "SYS.FM_TANK_REQ"
  | "SYS.DUPLICATE_NAME"
  | "SYS.TANK_CAPACITY"
  | "SYS.INVALID_PARTCODE"
  | "ZONE.MISSING_NAME"
  | "ZONE.INVALID_CHARS"
  | "ZONE.NO_ENCLOSURES"
  | "ZONE.DUPLICATE_NAME"
  | "ZONE.DM_MISMATCH"
  | "ZONE.CUSTOM_CYLINDERS"
  | "ZONE.MULTI_OP_PSI"
  | "ZONE.SHORT_VALVE_OPEN_TIME"
  | "ZONE.N2_NOT_MET"
  | "ZONE.BULK_N2_CAPACITY_LIMIT"
  // | "ZONE.BULK_N2_CAPACITY_MISSING"
  | "ENC.MISSING_NAME"
  | "ENC.INVALID_CHARS"
  | "ENC.DUPLICATE_NAME"
  | "ENC.TEMP_REQUIRED"
  | "ENC.TEMP_RANGE"
  | "ENC.VOLUME_EMPTY"
  | "ENC.FMDC_VOLUME_LIMIT"
  | "ENC.FM_VOLUME_LIMIT"
  | "ENC.CUSTOM_NOZZLES"
  | "ENC.NFPA_MAX_DISCHARGE"
  | "ENC.FMDC_MIN_DISCHARGE"
  | "ENC.N2_NOT_MET"
  | "ENC.CYL_LIMIT"
  | "ENC.O2_HIGH"
  | "ENC.TIME_CONSTRAINT"
  | "ENC.NOZZLE_STYLE"
  | "ENC.HEIGHT_LIMIT"
  | "ENC.FM_SPACING"
  | "ENC.O2_LOW_MOD"
  | "ENC.O2_LOW_SUB"
  | "ENC.O2_VERY_LOW";

export type ErrorDoc = {
  severity: Severity;
  title: string;
  appearsWhen: string;
  meaning: string;
  /** Build a display message for Status; accepts dynamic params */
  message: (p?: Record<string, any>) => string;
  /** Short resolution, used in the Guide */
  resolution: string;
};

export const ERROR_CODES: Record<ErrorCode, ErrorDoc> = {
  // ---------- Project ----------
  "PROJ.MISSING_FIELDS": {
    severity: "error",
    title: "Missing required project fields",
    appearsWhen: "On Validate / Before Calculate",
    meaning: "One or more required project fields are empty.",
    message: (p) =>
      `Some project fields are incomplete: ${p?.fields?.join(", ") ?? "?"}. Complete these before submission`,
    resolution: "Fill in all required project fields, then validate again.",
  },

  // ---------- System ----------
  "SYS.MISSING_NAME": {
    severity: "error",
    title: "System name is empty",
    appearsWhen: "On Validate",
    meaning: "A system has no name.",
    message: () => "System name is empty",
    resolution: "Enter a system name and validate again.",
  },
  "SYS.INVALID_CHARS": {
    severity: "error",
    title: "Invalid characters in system name",
    appearsWhen: "On Validate",
    meaning: "The system name includes restricted characters.",
    message: () => "System name may not include any of: * ? : \\ / [ ]",
    resolution: "Remove restricted characters from the system name.",
  },
  "SYS.NO_ZONES": {
    severity: "error",
    title: "No zones in system",
    appearsWhen: "On Validate",
    meaning: "The system has zero zones.",
    message: () => "No zones in this system",
    resolution: "Add at least one zone to this system.",
  },
  "SYS.PANEL_MISMATCH": {
    severity: "warn",
    title: "Panel style advisory",
    appearsWhen: "On Validate",
    meaning:
      "A multi-zone engineered system is using an Active Release (AR) panel.",
    message: () =>
      "Multi-zone engineered systems should use a Dry Contact (DC) panel. Consider switching panel style",
    resolution: "Switch panel style to DC for multi-zone engineered systems.",
  },
  "SYS.FM_TANK_REQ": {
    severity: "error",
    title: "FM tank required",
    appearsWhen: "On Validate",
    meaning: "FM methods are used with a non-FM tank selection.",
    message: () => "FM design methods require an FM-approved water tank",
    resolution: "Select an ASME/FM or CE/ASME/FM certified water tank.",
  },
  "SYS.DUPLICATE_NAME": {
    severity: "error",
    title: "Duplicate system name",
    appearsWhen: "On Validate",
    meaning: "Two systems share the same name.",
    message: (p) =>
      `System names must be unique across the project (duplicate: "${p?.name ?? "?"}")`,
    resolution: "Rename one of the systems so names are unique.",
  },
  "SYS.TANK_CAPACITY": {
    severity: "warn",
    title: "Water tank capacity exceeds catalog",
    appearsWhen: "On Calculate",
    meaning:
      "The required tank size exceeds the largest available for the selected certification.",
    message: (p) =>
      `Required water tank capacity (${p?.reqGal ?? "?"} gal) exceeds the maximum available for "${p?.certPretty ?? "?"}" (${p?.maxGal ?? "?"} gal). Supply a tank rated for at least ${p?.reqGal ?? "?"} gal`,
    resolution:
      "Choose a different certification, or supply your own water tank that meets the water requirement.",
  },
  "SYS.INVALID_PARTCODE": {
    severity: "error",
    title: "Invalid pre-engineered system partcode",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning:
      "The user-entered pre-engineered system partcode does not match the required format or allowed digit values.",
    message: (p) => p?.message ?? "Invalid pre-engineered system partcode",
    resolution:
      "Verify the system partcode against the pre-engineered catalog rules or unlock the field and let the configurator generate a code.",
  },

  // ---------- Zone ----------
  "ZONE.MISSING_NAME": {
    severity: "error",
    title: "Zone name is empty",
    appearsWhen: "On Validate",
    meaning: "A zone has no name.",
    message: () => "Zone name is empty",
    resolution: "Enter a zone name and validate again.",
  },
  "ZONE.INVALID_CHARS": {
    severity: "error",
    title: "Invalid characters in zone name",
    appearsWhen: "On Validate",
    meaning: "The zone name includes restricted characters.",
    message: () => "Zone name may not include any of: * ? : \\ / [ ]",
    resolution: "Remove restricted characters from the zone name.",
  },
  "ZONE.NO_ENCLOSURES": {
    severity: "error",
    title: "No enclosures in zone",
    appearsWhen: "On Validate",
    meaning: "The zone has zero enclosures.",
    message: () => "No enclosures in this zone",
    resolution: "Add at least one enclosure to this zone.",
  },
  "ZONE.DUPLICATE_NAME": {
    severity: "error",
    title: "Duplicate zone name",
    appearsWhen: "On Validate",
    meaning: "Two zones share the same name within the same system.",
    message: (p) =>
      `Zone names must be unique within a system (duplicate: "${p?.name ?? "?"}")`,
    resolution: "Rename zones so each zone name is unique within the system.",
  },
  "ZONE.DM_MISMATCH": {
    severity: "error",
    title: "Incompatible design methods mixed",
    appearsWhen: "On Validate",
    meaning:
      "The zone mixes design methods that cannot share a nitrogen source.",
    message: (p) =>
      `Enclosures sharing a nitrogen source must use compatible design methods. Incompatible: ${p?.methods?.join(", ") ?? "?"}`,
    resolution: "Split the zone or keep only NFPA 770 Class A/C + B together.",
  },
  "ZONE.CUSTOM_CYLINDERS": {
    severity: "warn",
    title: "Cylinder count modified from computed minimum",
    appearsWhen: "On Calculate",
    meaning:
      "The user override for cylinders is modified from the computed minimum.",
    message: (p) =>
      `Custom cylinder count set to ${p?.actual ?? "?"} (recommended minimum: ${p?.recommended ?? "?"})`,
    resolution: "Verify nitrogen requirement and final oxygen percentage.",
  },
  "ZONE.MULTI_OP_PSI": {
    severity: "warn",
    title: "Multiple operating pressures in zone",
    appearsWhen: "On Calculate",
    meaning:
      "Nozzles at different operating pressures require separate panel calculations.",
    message: (p) =>
      `This zone includes nozzles with different operating pressures (${p?.psiList ?? "?"}). Each pressure group requires a separate panel calculation, increasing total panel count`,
    resolution: "Harmonize nozzle operating pressures where possible.",
  },
  "ZONE.SHORT_VALVE_OPEN_TIME": {
    severity: "warn",
    title: "Bulk tube valve open time may be too short",
    appearsWhen: "On Calculate",
    meaning:
      "Bulk tube valve open time is less than the controlling enclosure discharge time, which can under-deliver nitrogen.",
    message: (p) =>
      `Bulk tube valve open time (${p?.tOpen ?? "?"} min) is less than the required controlling discharge time (${p?.tRequired ?? "?"} min). Increase valve open time`,
    resolution:
      "Increase valve open time to meet or exceed the controlling discharge time.",
  },
  "ZONE.N2_NOT_MET": {
    severity: "warn",
    title: "Zone nitrogen requirement not met",
    appearsWhen: "On Calculate",
    meaning:
      "Total delivered nitrogen for the zone is less than the zone's minimum required nitrogen.",
    message: (p) =>
      `Zone nitrogen requirement not met. Delivered ≈ ${p?.provided ?? "?"} SCF, required ≈ ${p?.required ?? "?"} SCF. Increase nitrogen supply (cylinders or bulk open time) or reduce nozzle flow`,
    resolution:
      "Increase nitrogen supply (cylinders or bulk open time) or reduce nozzle flow.",
  },
  "ZONE.BULK_N2_CAPACITY_LIMIT": {
    severity: "warn",
    title: "Bulk tube nitrogen capacity may be limiting",
    appearsWhen: "On Calculate",
    meaning:
      "The requested nitrogen delivery (flow × valve open time) exceeds the selected bulk tube storage capacity, so delivered nitrogen is capped.",
    message: (p) =>
      `Bulk tube capacity is limiting this zone. Requested ≈ ${p?.requested ?? "?"} SCF, capacity ≈ ${p?.cap ?? "?"} SCF, delivered ≈ ${p?.provided ?? "?"} SCF. Select a larger bulk tube, increase supply, or reduce flow`,
    resolution:
      "Select a larger bulk tube option (higher SCF), increase bulk supply, or reduce nozzle flow.",
  },
  // "ZONE.BULK_N2_CAPACITY_MISSING": {
  //   severity: "error",
  //   title: "Bulk tube capacity not selected",
  //   appearsWhen: "On Calculate",
  //   meaning:
  //     "Bulk tubes are enabled but no bulk tube size/capacity is selected, so available nitrogen capacity is unknown.",
  //   message: () =>
  //     "Bulk tubes are enabled, but no bulk tube size/capacity is selected. Select a bulk tube option to calculate nitrogen availability",
  //   resolution: "Select a bulk tube size/capacity, then recalculate.",
  // },

  // ---------- Enclosure ----------
  "ENC.MISSING_NAME": {
    severity: "error",
    title: "Enclosure name is empty",
    appearsWhen: "On Validate",
    meaning: "An enclosure has no name.",
    message: () => "Enclosure name is empty",
    resolution: "Enter a descriptive enclosure name.",
  },
  "ENC.INVALID_CHARS": {
    severity: "error",
    title: "Invalid characters in enclosure name",
    appearsWhen: "On Validate",
    meaning: "The enclosure name includes restricted characters.",
    message: () => "Enclosure name may not include any of: * ? : \\ / [ ]",
    resolution: "Remove restricted characters from the enclosure name.",
  },
  "ENC.DUPLICATE_NAME": {
    severity: "error",
    title: "Duplicate enclosure name",
    appearsWhen: "On Validate",
    meaning: "Two enclosures share the same name within the zone.",
    message: (p) =>
      `Enclosure names must be unique within a zone (duplicate: "${p?.name ?? "?"}")`,
    resolution: "Rename one of the enclosures so names are unique in the zone.",
  },
  "ENC.TEMP_REQUIRED": {
    severity: "error",
    title: "Temperature required",
    appearsWhen: "On Validate",
    meaning: "The enclosure temperature is missing.",
    message: () => "Temperature is required",
    resolution: "Enter the enclosure temperature within the allowed range.",
  },
  "ENC.TEMP_RANGE": {
    severity: "error",
    title: "Temperature out of range",
    appearsWhen: "On Validate",
    meaning: "The entered temperature is outside 40–130°F (4.4–54.4°C).",
    message: () => "Temperature must be within 40–130°F (4.4–54.4°C)",
    resolution: "Adjust the temperature to the valid range.",
  },
  "ENC.VOLUME_EMPTY": {
    severity: "error",
    title: "Volume/dimensions invalid",
    appearsWhen: "On Validate",
    meaning: "Volume or dimensions are zero or missing.",
    message: () => "Volume must be a positive, non-zero value",
    resolution: "Enter valid length, width, and height or a positive volume.",
  },
  "ENC.FMDC_VOLUME_LIMIT": {
    severity: "error",
    title: "FM Data Centers volume exceeds limit",
    appearsWhen: "On Validate",
    meaning: "The enclosure volume exceeds the FM Data Centers limit.",
    message: () =>
      "Volume for FM Data Centers may not exceed 31,350 ft³ (2,912.5 m³)",
    resolution: "Split the enclosure or change the design method.",
  },
  "ENC.FM_VOLUME_LIMIT": {
    severity: "error",
    title: "FM Turbines/Machine Spaces volume exceeds limit",
    appearsWhen: "On Validate",
    meaning:
      "The enclosure volume exceeds the FM Turbines/Machine Spaces limit.",
    message: () =>
      "Volume for FM Turbines/FM Machine Spaces may not exceed 127,525 ft³ (3,611.1 m³)",
    resolution: "Divide the enclosure or adjust the design method.",
  },
  "ENC.CUSTOM_NOZZLES": {
    severity: "warn",
    title: "Nozzle count modified from computed minimum",
    appearsWhen: "On Calculate",
    meaning:
      "The user override for nozzles is modified from the computed minimum.",
    message: (p) =>
      `Custom nozzle count set to ${p?.final ?? "?"} (recommended minimum: ${p?.calc ?? "?"})`,
    resolution: "Verify discharge time and final oxygen percentage.",
  },
  "ENC.NFPA_MAX_DISCHARGE": {
    severity: "warn",
    title: "Discharge time exceeds NFPA limit",
    appearsWhen: "On Calculate",
    meaning: "Estimated discharge time is greater than 3.0 minutes (NFPA).",
    message: (p) =>
      `Estimated discharge time ${p?.t_est ?? "?"} min exceeds 3.0 min for "${p?.name ?? "?"}". Increase nozzles or nitrogen flow`,
    resolution: "Increase nozzles or select a higher-flow nozzle.",
  },
  "ENC.FMDC_MIN_DISCHARGE": {
    severity: "error",
    title: "FM Data Centers minimum discharge time not met",
    appearsWhen: "On Calculate",
    meaning:
      "Calculated discharge time is below 3.5 minutes (FM Data Centers).",
    message: (p) =>
      `FM Data Centers minimum discharge time is 3.5 minutes (actual: ${p?.t_actual ?? "?"})`,
    resolution: "Add cylinders or reduce flow until time ≥ 3.5 minutes.",
  },
  "ENC.N2_NOT_MET": {
    severity: "warn",
    title: "Nitrogen requirement not met",
    appearsWhen: "On Calculate",
    meaning:
      "Delivered nitrogen is below required or final oxygen level exceeds the threshold.",
    message: (p) =>
      `Nitrogen requirement not met for "${p?.name ?? "?"}". Delivered ≈ ${p?.delivered ?? "?"} SCF, required ≈ ${p?.required ?? "?"} SCF. Discharge time is invalid; increase ${p?.bulkOn ? "bulk valve open time" : "cylinder count"} or reduce nozzle flow`,
    resolution:
      "Increase nitrogen supply (cylinders or bulk valve open time) or reduce nozzle flow, then recalculate.",
  },
  "ENC.CYL_LIMIT": {
    severity: "error",
    title: "Pre-engineered cylinder limit exceeded",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "More than 8 × 80L cylinders are required.",
    message: () =>
      "Cylinder quantity exceeds the limitation of 8 × 80L for pre-engineered systems",
    resolution: "Switch to engineered or reduce volume.",
  },
  "ENC.O2_HIGH": {
    severity: "error",
    title: "Final oxygen level too high",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "Final oxygen level exceeds 14.1%.",
    message: () =>
      "Oxygen level exceeds the allowable 14.1% required for extinguishment",
    resolution: "Add cylinders or use higher-pressure cylinders.",
  },
  "ENC.TIME_CONSTRAINT": {
    severity: "error",
    title: "No feasible nozzles/pressure",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "No valid integer nozzle count meets the time window.",
    message: (p) =>
      p?.method === "FM Data Centers"
        ? "Calculated discharge time does not meet FM requirements for any allowed nozzle/pressure. Try different size/pressure or cylinder set"
        : "Calculated discharge time cannot satisfy 2.1–3.0 minutes for any allowed nozzle/pressure. Try different size/pressure or cylinder set",
    resolution:
      "Try a different nozzle size, style, or fill pressure; or switch to engineered.",
  },
  "ENC.NOZZLE_STYLE": {
    severity: "error",
    title: "Nozzle style incompatible",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "The selected style is not allowed for the method/nozzle.",
    message: () =>
      "Selected nozzle style is incompatible with the design method/nozzle",
    resolution: "Select a style allowed for the chosen method/nozzle.",
  },
  "ENC.HEIGHT_LIMIT": {
    severity: "error",
    title: "FM ceiling height limit exceeded",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning:
      "Ceiling height exceeds the FM limit for the selected nozzle size.",
    message: () =>
      "Ceiling height exceeds maximum allowable for the selected nozzle size per FM approval",
    resolution: "Lower the height, change nozzle size, or redesign layout.",
  },
  "ENC.FM_SPACING": {
    severity: "error",
    title: "FM spacing violated",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "Enclosure dimensions violate FM nozzle spacing rules.",
    message: () =>
      "Enclosure dimensions violate FM requirements for nozzle spacing",
    resolution: "Increase nozzles, change size, or divide the enclosure.",
  },
  "ENC.O2_LOW_MOD": {
    severity: "warn",
    title: "Low oxygen level (moderate)",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "Final oxygen level is between 10% and 12%.",
    message: () =>
      "Oxygen level is lower than design values; recommended occupancy time is reduced (see NFPA 770 §4.3)",
    resolution: "Warn personnel and review occupancy limits.",
  },
  "ENC.O2_LOW_SUB": {
    severity: "warn",
    title: "Low oxygen level (substantial)",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "Final oxygen level is between 8% and 10%.",
    message: () =>
      "Oxygen level is substantially low; recommended occupancy time is substantially reduced (see NFPA 770 §4.3)",
    resolution: "Warn personnel and review occupancy limits.",
  },
  "ENC.O2_VERY_LOW": {
    severity: "warn",
    title: "Very low oxygen level",
    appearsWhen: "On Calculate (Pre-Eng)",
    meaning: "Final oxygen level is below 8%.",
    message: () =>
      "Oxygen level is very low; occupancy of the protected enclosure is not recommended (see NFPA 770 §4.3)",
    resolution: "Restrict access and review the design.",
  },
};

// Build a stable anchor id that matches the Guide's <tr id=...>
export const codeAnchorId = (code: ErrorCode) =>
  `err-${code.replace(/\./g, "-")}`;

// Build a full link to the Guide section
export const codeHref = (code: ErrorCode) => `/guide#${codeAnchorId(code)}`;

// Helper to create a StatusMessage from a code + params
export function statusFromCode(
  code: ErrorCode,
  ctx: Partial<{
    systemId: string;
    zoneId: string;
    enclosureId: string;
    field: string;
  }> = {},
  params: Record<string, any> = {}
) {
  const def = ERROR_CODES[code];
  return {
    severity: def.severity,
    code,
    text: def.message(params),
    ...ctx,
  } as const;
}
