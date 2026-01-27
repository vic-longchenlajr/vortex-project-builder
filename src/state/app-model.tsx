// src/state/app-model.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";

import {
  pickDefaultNozzle,
  pickDefaultStyle,
  getStylesFor,
  MethodName,
  NozzleCode,
  EmitterStyleKey,
} from "@/core/catalog/emitter.catalog";
import { calculateEngineered } from "@/core/calc/engineered";
import { calculatePreEngineered } from "@/core/calc/preengineered";
import { saveAs } from "file-saver";

import {
  makeSnapshotV1,
  parseSnapshot,
  downloadTextFile,
  readFileAsText,
} from "@/core/io/project-io";

import { collectBOM } from "@/core/bom/collect-project";
import { buildWorkbookForProject } from "@/core/bom/excel";
import { fetchPriceIndex } from "@/core/bom/priceList";
import type { EngineeredBomBySystem, PriceIndex } from "@/core/bom/types";
import { syncPointsFromBOM } from "@/core/bom/facp-sync";
import {
  saveTextFileSmart,
  openTextFileSmart,
  saveBinaryFileSmart,
} from "@/core/io/file-bridge";

import type { ErrorCode } from "@/core/status/error-codes";
import { statusFromCode } from "@/core/status/error-codes";
import { decodeSystemPartcodeToConfig } from "@/core/calc/preengineered/partcode";
import type { Codes } from "@/core/catalog/parts.constants";
/* ─────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────── */
function makeId(prefix: string) {
  return (
    (globalThis.crypto?.randomUUID?.() as string) ||
    `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

export type SystemType = "engineered" | "preengineered";
export type Currency = "USD" | "EUR" | "GBP";
export type Units = "imperial" | "metric";
export type Severity = "error" | "warn" | "info";
export type StatusInput = Omit<StatusMessage, "id">;
export type PanelSizing = {
  bore: "1in" | "1.5in";
  capacity: 1800 | 4500;
  qty: number;
  style: "ar" | "dc";
};
export type DesignLabel = "data_proc" | "comb_turb" | "spec_hazards";

export type StatusMessage = {
  id: string;
  severity: Severity;
  text: string;
  code?: ErrorCode; // ← tighten the type
  systemId?: string;
  zoneId?: string;
  enclosureId?: string;
  field?: string;
};

export type Enclosure = {
  id: string;
  name: string;
  volume: number;
  tempF: number;
  method:
    | "NFPA 770 Class A/C"
    | "NFPA 770 Class B"
    | "FM Data Centers"
    | "FM Machine Spaces/Turbines";
  length?: number;
  width?: number;
  height?: number;

  nozzleCode?: NozzleCode;
  emitterStyle?: EmitterStyleKey;

  // results...
  minEmitters?: number;
  cylinderCount?: number;

  customMinEmitters?: number | null;
  _editEmitters?: boolean;

  estDischarge?: string;
  estFinalO2?: string;

  /** NEW: label for flow cartridge selection (from nozzle SCFM) */
  flowCartridge?: string;

  qWater_gpm?: number;
  qWaterTotal_gpm?: number;
  estWater_gal?: number;
  notes?: string[];
};

export type Zone = {
  id: string;
  name: string;
  enclosures: Enclosure[];

  // existing calc outputs
  minTotalCylinders?: number;
  totalNitrogenDelivered_scf?: number;
  totalNitrogenRequired_scf?: number;
  // NEW: user inputs
  pipeDryVolumeGal?: number;
  overrideCylinders?: number | null;

  // ui overrides (cylinders)
  customMinTotalCylinders?: number | null;
  _editCylinders?: boolean;

  // NEW: calc outputs for BOM/sizing
  q_n2_peak_scfm?: number;
  water_peak_gpm?: number;
  waterDischarge_gal?: number;
  waterTankMin_gal?: number;

  // NEW: make these official so zone.panelSizing works
  panelSizing?: PanelSizing;
  designLabel?: DesignLabel;

  bulkValveOpenTimeMin?: number;
  _editBulkValveOpenTimeMin?: boolean;
  bulkValveOpenTimeMinRequired?: number;
  minTotalTubes?: number;
};

export type System = {
  id: string;
  name: string;
  type: SystemType;
  zones: Zone[];
  options: SystemOptions;
  /** System-level summary for UI “System Totals” */
  systemTotals?: SystemTotals;
};

export type SystemTotals = {
  // Governing sources
  governingNitrogenZoneId?: string | null;
  governingWaterZoneId?: string | null;
  // Core totals
  totalCylinders?: number; // from zone with MOST cylinders
  totalNitrogenRequired_scf: number; // from zone with LARGEST N2 requirement
  totalNitrogenDelivered_scf: number;
  dischargePanels_qty: number; // sum of zone panelSizing.qty
  waterTankRequired_gal: number; // max zone waterTankMin_gal
  waterRequirement_gal: number; // max zone waterDischarge_gal
  waterTankPick?: Codes;
  // FACP estimates (already computed per system)
  estReleasePoints: number;
  estMonitorPoints: number;
  estBatteryBackups: number;
};

export type Project = {
  name: string;
  firstName: string;
  lastName: string;
  companyName: string;
  projectLocation: string;
  phone: string;
  email: string;
  currency: Currency;
  units: Units;
  elevation: string; // e.g. "-3000FT/-0.92KM"
  systems: System[];
  customerMultiplier: number;
};

type SystemAddOnsBase = {
  placardsAndSignage: boolean;
  doorCount: number;
  bulkRefillAdapter: boolean;
  expProofTransducer: boolean;
};

export type EngineeredEstimates = {
  primaryReleaseAssemblies: number;
  doubleStackedRackHose: number;
  adjacentRackHose: number;
  releasePoints: number;
  monitorPoints: number;
  batteryBackups: number;
};

export type PreEstimates = {
  releasePoints: number;
  monitorPoints: number;
};

export type PanelStyle = "ar" | "dc";
export type RefillAdapter = "CGA-580" | "CGA-677";
export type WaterTankCert = "ASME/FM" | "CE/ASME/FM" | "CE";
export type PowerSupply = "120" | "240";

export const FILL_PRESSURES = [
  "3000 PSI/206.8 BAR",
  "2900 PSI/199.9 BAR",
  "2800 PSI/193.1 BAR",
  "2700 PSI/186.2 BAR",
  "2640 PSI/182.0 BAR",
  "2600 PSI/179.3 BAR",
  "2500 PSI/172.4 BAR",
  "2400 PSI/165.5 BAR",
  "2300 PSI/158.6 BAR",
  "2200 PSI/151.7 BAR",
  "2100 PSI/144.8 BAR",
] as const;
export type FillPressure = (typeof FILL_PRESSURES)[number];

export const PRE_FILL_PRESSURES = [
  "3000 PSI/206.8 BAR",
  "2640 PSI/182.0 BAR",
] as const;
export type PreFillPressure = (typeof PRE_FILL_PRESSURES)[number];

export type EngineeredOptions = {
  kind: "engineered";
  fillPressure: FillPressure;
  refillAdapter: RefillAdapter | null;
  waterTank: WaterTankCert | null;
  powerSupply: PowerSupply | null;
  panelStyle: PanelStyle;
  bulkTubes: boolean;
  rundownTimeMin: number;
  estimatedPipeVolume?: number; // gal in US units, liters in metric UI (converted in calc)
  addOns: SystemAddOnsBase & {
    waterFlexLine: boolean;
    igsFlexibleHose48: boolean;
  };
  editValues: boolean; // UI knobs for overriding calc results
  _editEstimates?: Partial<Record<keyof EngineeredEstimates, boolean>>;
  estimates: EngineeredEstimates;
  // Bulk tube order form selections
  bulkTubeSize?: string | null; // key/id for selected size
  bulkTubeLabel?: string | null; // display label
  bulkTubeNitrogenSCF?: number | null; // capacity (assume qty=1 for now)
  waterTankRequired_gal?: number; // from calc (for BOM sync)
  waterTankPick?: Codes; // from calc (for BOM sync)
  waterTankPickDesc?: string;
  waterTankCertification?: WaterTankCert;
  bulkTubesEligible?: boolean;
};

export type PreEngineeredOptions = {
  kind: "preengineered";
  fillPressure: PreFillPressure;
  refillAdapter: RefillAdapter | null;
  waterTank: WaterTankCert | null;
  waterTankRequired_gal?: number; // from calc (for BOM sync)
  waterTankPick?: Codes; // from calc (for BOM sync)
  waterTankPickDesc?: string;
  waterTankCertification?: WaterTankCert;
  powerSupply: PowerSupply | null;
  addOns: SystemAddOnsBase;
  editValues: boolean;
  estimates: PreEstimates;
  _editEstimates?: Partial<Record<keyof PreEstimates, boolean>>;
  systemPartCode?: string | null; // last known partcode (raw or formatted)
  systemPartCodeLocked?: boolean | null; // true when checkbox is checked
};

export type SystemOptions = EngineeredOptions | PreEngineeredOptions;

/* ─────────────────────────────────────────────────────────────
   CONSTANTS / DEFAULTS
   ───────────────────────────────────────────────────────────── */

const DEFAULT_PROJECT: Project = {
  name: "Untitled Project",
  firstName: "",
  lastName: "",
  companyName: "",
  projectLocation: "",
  phone: "",
  email: "",
  currency: "USD",
  units: "imperial",
  elevation: "0FT/0KM",
  systems: [],
  customerMultiplier: 1.0,
};

export function makeEngineeredOptions(): EngineeredOptions {
  return {
    kind: "engineered",
    fillPressure: "3000 PSI/206.8 BAR",
    refillAdapter: "CGA-580",
    waterTank: "ASME/FM",
    waterTankCertification: undefined,
    powerSupply: "120",
    panelStyle: "ar",
    bulkTubes: false,
    rundownTimeMin: 0,
    estimatedPipeVolume: 0,
    addOns: {
      placardsAndSignage: true,
      doorCount: 1,
      bulkRefillAdapter: false,
      expProofTransducer: false,
      waterFlexLine: false,
      igsFlexibleHose48: false,
    },
    editValues: false,
    estimates: {
      primaryReleaseAssemblies: 0,
      doubleStackedRackHose: 0,
      adjacentRackHose: 0,
      releasePoints: 0,
      monitorPoints: 0,
      batteryBackups: 0,
    },
    bulkTubeSize: null,
    bulkTubeLabel: null,
    bulkTubeNitrogenSCF: null,
  };
}

export function makePreOptions(): PreEngineeredOptions {
  return {
    kind: "preengineered",
    fillPressure: "3000 PSI/206.8 BAR",
    refillAdapter: "CGA-580",
    waterTank: "ASME/FM",
    waterTankCertification: undefined,

    powerSupply: "120",
    addOns: {
      placardsAndSignage: true,
      doorCount: 1,
      bulkRefillAdapter: false,
      expProofTransducer: false,
    },
    editValues: false,
    estimates: { releasePoints: 0, monitorPoints: 0 },
    _editEstimates: {},
  };
}

/* ─────────────────────────────────────────────────────────────
   ID / SMALL UTILS
   ───────────────────────────────────────────────────────────── */

function newId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function containsInvalidCharacters(input: string) {
  const bad = ["*", "?", ":", "\\", "/", "[", "]"];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    for (let j = 0; j < bad.length; j++) {
      if (ch === bad[j]) return true;
    }
  }
  return false;
}

function makeDefaultPreEnclosure(idx = 1): Enclosure {
  const method: MethodName = "NFPA 770 Class A/C";
  const nozzle: NozzleCode = pickDefaultNozzle(method);
  const style: EmitterStyleKey | undefined = coerceStyle(method, nozzle);
  return {
    id: newId("enc"),
    name: `Enclosure ${idx}`,
    volume: 1000,
    tempF: 70,
    method,
    length: 10,
    width: 10,
    height: 10,
    nozzleCode: nozzle,
    emitterStyle: style,
    customMinEmitters: null,
    _editEmitters: false,
  };
}

export function makeDefaultPreZone(): Zone {
  return {
    id: newId("zone"),
    name: "Zone 1",
    enclosures: [makeDefaultPreEnclosure(1)],
    customMinTotalCylinders: null,
    _editCylinders: false,
  };
}

// --- add with your other default-makers --- //
export function makeDefaultEngEnclosure(idx = 1): Enclosure {
  const method: MethodName = "NFPA 770 Class A/C";
  const nozzle: NozzleCode = pickDefaultNozzle(method);
  const style: EmitterStyleKey | undefined = coerceStyle(method, nozzle);
  return {
    id: newId("enc"),
    name: `Enclosure ${idx}`,
    volume: 1000,
    tempF: 70,
    method,
    nozzleCode: nozzle,
    emitterStyle: style,
    customMinEmitters: null,
    _editEmitters: false,
  };
}

export function makeDefaultEngZone(idx = 0): Zone {
  return {
    id: newId("zone"),
    name: `Zone ${idx + 1}`,
    enclosures: [makeDefaultEngEnclosure(1)],
    customMinTotalCylinders: null,
    _editCylinders: false,
  };
}

/** Duplicate a zone for “copy last zone” UX. Clears calc outputs, keeps inputs. */
export function duplicateZoneForAdd(base: Zone, nextIndexNumber: number): Zone {
  const newZoneId = newId("zone");
  const zoneName =
    base?.name && /\d+$/.test(base.name)
      ? base.name.replace(/\d+$/, String(nextIndexNumber + 1))
      : `Zone ${nextIndexNumber + 1}`;

  const enclosures = (base.enclosures ?? []).map((e, j) => {
    const encName =
      e?.name && /\d+$/.test(e.name)
        ? e.name.replace(/\d+$/, String(j + 1))
        : `Enclosure ${j + 1}`;

    const {
      minEmitters,
      cylinderCount,
      estDischarge,
      estFinalO2,
      qWater_gpm,
      qWaterTotal_gpm,
      estWater_gal,
      ...rest
    } = e as Enclosure;

    const cleared: Enclosure = {
      ...rest,
      id: newId("enc"),
      name: encName,
      minEmitters: undefined,
      cylinderCount: undefined,
      estDischarge: undefined,
      estFinalO2: undefined,
      flowCartridge: undefined, // ← add this line
      qWater_gpm: undefined,
      qWaterTotal_gpm: undefined,
      estWater_gal: undefined,
    };

    return cleared;
  });

  const {
    minTotalCylinders,
    q_n2_peak_scfm,
    water_peak_gpm,
    waterDischarge_gal,
    waterTankMin_gal,
    panelSizing,
    designLabel,
    ...restZone
  } = base as any;

  return {
    ...(restZone as Zone),
    id: newZoneId,
    name: zoneName,
    enclosures,
    minTotalCylinders: undefined,
    q_n2_peak_scfm: undefined,
    water_peak_gpm: undefined,
    waterDischarge_gal: undefined,
    waterTankMin_gal: undefined,
    panelSizing: undefined,
    designLabel: restZone?.designLabel ?? undefined,
  };
}

function firstOrUndef<T>(arr: readonly T[]): T | undefined {
  return arr.length ? arr[0] : undefined;
}

function coerceStyle(
  method: MethodName,
  nozzle: NozzleCode,
  candidate?: EmitterStyleKey
): EmitterStyleKey | undefined {
  const styles = getStylesFor(method, nozzle); // EmitterStyleKey[]
  if (candidate && styles.includes(candidate)) return candidate;
  return firstOrUndef(styles);
}
type HasName = { name?: string | null };

/** Treat blank or "Zone 3" / "System 2" / "Enclosure 10" as default names. */
function isBlankOrDefaultIndexedName(
  name: string | null | undefined,
  base: string
) {
  const n = (name ?? "").trim();
  if (!n) return true;
  const re = new RegExp(`^${base}\\s+\\d+$`); // exact: "Zone 12"
  return re.test(n);
}

/** After deletions, rename only defaults ("Zone X") + blanks to match new index. */
function reindexDefaultNames<T extends HasName>(items: T[], base: string): T[] {
  return items.map((it, i) => {
    const nextDefault = `${base} ${i + 1}`;
    if (isBlankOrDefaultIndexedName(it.name, base)) {
      return { ...it, name: nextDefault };
    }
    return it; // keep custom names
  });
}
/* ─────────────────────────────────────────────────────────────
   VALIDATION (CALCULATION-FREE)
   ───────────────────────────────────────────────────────────── */

function validateProject(project: Project): StatusMessage[] {
  const msgs: StatusMessage[] = [];
  const id = () => newId("st");

  // Project meta
  const missingTop: string[] = [];
  if (!project.name) missingTop.push("Project Name");
  if (!project.companyName) missingTop.push("Company Name");
  if (!project.firstName) missingTop.push("First Name");
  if (!project.lastName) missingTop.push("Last Name");
  if (!project.phone) missingTop.push("Phone Number");
  if (!project.email) missingTop.push("Email Address");
  if (!project.projectLocation) missingTop.push("Project Location");
  if (missingTop.length) {
    msgs.push({
      id: id(),
      ...statusFromCode("PROJ.MISSING_FIELDS", {}, { fields: missingTop }),
    });
  }

  // Systems
  for (const sys of project.systems) {
    if (!sys.name) {
      msgs.push({
        id: id(),
        ...statusFromCode("SYS.MISSING_NAME", { systemId: sys.id }),
      });
    }
    if (containsInvalidCharacters(sys.name || "")) {
      msgs.push({
        id: id(),
        ...statusFromCode("SYS.INVALID_CHARS", { systemId: sys.id }),
      });
    }
    if (sys.zones.length === 0) {
      msgs.push({
        id: id(),
        ...statusFromCode("SYS.NO_ZONES", { systemId: sys.id }),
      });
    }

    // Advice: DC for multizone engineered
    if (
      sys.type === "engineered" &&
      sys.zones.length > 1 &&
      (sys.options as EngineeredOptions).panelStyle !== "dc"
    ) {
      msgs.push({
        id: id(),
        ...statusFromCode("SYS.PANEL_MISMATCH", { systemId: sys.id }),
      });
    }

    // FM methods require FM-capable tank
    const tank = sys.options.waterTank;
    const hasFMMethod = sys.zones.some((z) =>
      z.enclosures.some(
        (e) =>
          e.method === "FM Data Centers" ||
          e.method === "FM Machine Spaces/Turbines"
      )
    );
    if (hasFMMethod && tank === "CE") {
      msgs.push({
        id: id(),
        ...statusFromCode("SYS.FM_TANK_REQ", { systemId: sys.id }),
      });
    }
    if (sys.options.kind === "engineered") {
      if (sys.options.bulkTubes) {
        msgs.push({
          ...statusFromCode("SYS.BULK_TUBES_EXCLUDED", { systemId: sys.id }),
          id: id(),
        });
      }
    }
    // Detect whether this system contains any FM Machine Spaces/Turbines enclosure
    const hasFMMachine = sys.zones.some((z) =>
      z.enclosures.some((e) => e.method === "FM Machine Spaces/Turbines")
    );

    // Rundown time warning: value entered but no FM Machine Spaces/Turbines enclosures
    if (sys.options.kind === "engineered") {
      const rt = Number((sys.options as EngineeredOptions).rundownTimeMin ?? 0);
      const hasRt = Number.isFinite(rt) && rt > 0;

      if (hasRt && !hasFMMachine) {
        msgs.push({
          id: id(),
          ...statusFromCode(
            "SYS.RUNDOWN_TIME_UNUSED",
            { systemId: sys.id },
            {}
          ),
          field: "rundownTimeMin",
          systemId: sys.id, // redundant but explicit is fine
        });
      }
    }

    // Zones + enclosures
    for (const zone of sys.zones) {
      if (!zone.name) {
        msgs.push({
          id: id(),
          ...statusFromCode("ZONE.MISSING_NAME", {
            systemId: sys.id,
            zoneId: zone.id,
          }),
        });
      }
      if (containsInvalidCharacters(zone.name || "")) {
        msgs.push({
          id: id(),
          ...statusFromCode("ZONE.INVALID_CHARS", {
            systemId: sys.id,
            zoneId: zone.id,
          }),
        });
      }

      msgs.push(...checkUniqueEnclosureNamesInZone(zone, sys.id));
      msgs.push(...checkZoneDesignMethodCompatibility(zone, sys.id));

      if (zone.enclosures.length === 0) {
        msgs.push({
          id: id(),
          ...statusFromCode("ZONE.NO_ENCLOSURES", {
            systemId: sys.id,
            zoneId: zone.id,
          }),
        });
        continue;
      }

      for (const enc of zone.enclosures) {
        if (!enc.name || !enc.name.trim()) {
          msgs.push({
            id: id(),
            ...statusFromCode("ENC.MISSING_NAME", {
              systemId: sys.id,
              zoneId: zone.id,
              enclosureId: enc.id,
            }),
          });
        } else if (containsInvalidCharacters(enc.name)) {
          msgs.push({
            id: id(),
            ...statusFromCode("ENC.INVALID_CHARS", {
              systemId: sys.id,
              zoneId: zone.id,
              enclosureId: enc.id,
            }),
          });
        }

        const tMin = project.units === "imperial" ? 40 : 4.4;
        const tMax = project.units === "imperial" ? 130 : 54.4;
        const tRaw = enc.tempF;
        if (tRaw == null || Number.isNaN(tRaw)) {
          msgs.push({
            id: id(),
            ...statusFromCode("ENC.TEMP_REQUIRED", {
              systemId: sys.id,
              zoneId: zone.id,
              enclosureId: enc.id,
              field: "tempF",
            }),
          });
        } else {
          // 2) Range check only if it's actually a number
          if (tRaw < tMin || tRaw > tMax) {
            msgs.push({
              id: id(),
              ...statusFromCode("ENC.TEMP_RANGE", {
                systemId: sys.id,
                zoneId: zone.id,
                enclosureId: enc.id,
                field: "tempF",
              }),
            });
          }
        }
        if (sys.type === "engineered") {
          if (!enc.volume || enc.volume <= 0) {
            msgs.push({
              id: id(),
              ...statusFromCode("ENC.VOLUME_EMPTY", {
                systemId: sys.id,
                zoneId: zone.id,
                enclosureId: enc.id,
                field: "volume",
              }),
            });
          }
        } else {
          if (
            (enc.length ?? 0) <= 0 ||
            (enc.width ?? 0) <= 0 ||
            (enc.height ?? 0) <= 0
          ) {
            msgs.push({
              id: id(),
              ...statusFromCode("ENC.VOLUME_EMPTY", {
                systemId: sys.id,
                zoneId: zone.id,
                enclosureId: enc.id,
                field: "volume",
              }),
            });
          }
        }

        // FM-specific volume caps
        if (enc.method === "FM Data Centers") {
          const maxFt3 = 31350;
          const maxM3 = 2912.5;
          const exceeds =
            (project.units === "imperial" && (enc.volume || 0) > maxFt3) ||
            (project.units === "metric" && (enc.volume || 0) > maxM3);
          if (exceeds) {
            msgs.push({
              id: id(),
              ...statusFromCode("ENC.FMDC_VOLUME_LIMIT", {
                systemId: sys.id,
                zoneId: zone.id,
                enclosureId: enc.id,
              }),
            });
          }
        }

        if (enc.method === "FM Machine Spaces/Turbines") {
          const maxFt3 = 127525;
          const maxM3 = 3611.1;
          const exceeds =
            (project.units === "imperial" && (enc.volume || 0) > maxFt3) ||
            (project.units === "metric" && (enc.volume || 0) > maxM3);
          if (exceeds) {
            msgs.push({
              id: id(),
              ...statusFromCode("ENC.FM_VOLUME_LIMIT", {
                systemId: sys.id,
                zoneId: zone.id,
                enclosureId: enc.id,
              }),
            });
          }
        }
      }
    }

    // Zone name uniqueness inside a system
    const seen: Record<string, number> = {};
    for (const z of sys.zones) {
      const key = (z.name || "").trim().toLowerCase();
      if (!key) continue;
      seen[key] = (seen[key] || 0) + 1;
    }
    for (const z of sys.zones) {
      const key = (z.name || "").trim().toLowerCase();
      if (key && seen[key] > 1) {
        msgs.push({
          id: id(),
          ...statusFromCode(
            "ZONE.DUPLICATE_NAME",
            { systemId: sys.id, zoneId: z.id },
            { name: z.name }
          ),
        });
      }
    }
  }

  const seen: Record<string, number> = {};
  for (const s of project.systems) {
    const key = (s.name || "").trim().toLowerCase();
    if (!key) continue;
    seen[key] = (seen[key] || 0) + 1;
  }
  for (const s of project.systems) {
    const key = (s.name || "").trim().toLowerCase();
    if (key && seen[key] > 1) {
      msgs.push({
        id: id(),
        ...statusFromCode(
          "SYS.DUPLICATE_NAME",
          { systemId: s.id },
          { name: s.name }
        ),
      });
    }
  }

  return msgs;
}

export function checkUniqueEnclosureNamesInZone(
  zone: Zone,
  systemId: string
): StatusMessage[] {
  const seen: Record<string, number> = {};
  for (const enc of zone.enclosures) {
    const key = (enc.name || "").trim().toLowerCase();
    if (!key) continue;
    seen[key] = (seen[key] || 0) + 1;
  }

  const duplicates: StatusMessage[] = [];
  for (const enc of zone.enclosures) {
    const key = (enc.name || "").trim().toLowerCase();
    if (!key) continue;
    if (seen[key] > 1) {
      duplicates.push({
        id: newId("st"),
        ...statusFromCode(
          "ENC.DUPLICATE_NAME",
          { systemId, zoneId: zone.id, enclosureId: enc.id },
          { name: enc.name }
        ),
      });
    }
  }
  return duplicates;
}

/** A zone can mix A/C and B only; all other mixes invalid. */
export function checkZoneDesignMethodCompatibility(
  zone: Zone,
  systemId: string
): StatusMessage[] {
  if (!zone.enclosures || zone.enclosures.length <= 1) return [];
  const methods = new Set<Enclosure["method"]>();
  for (const enc of zone.enclosures) if (enc.method) methods.add(enc.method);
  if (methods.size <= 1) return [];

  const ALLOWED_MIX = new Set<Enclosure["method"]>([
    "NFPA 770 Class A/C",
    "NFPA 770 Class B",
  ]);
  const allAllowed = Array.from(methods).every((m) => ALLOWED_MIX.has(m));
  if (allAllowed) return [];

  return [
    {
      id: newId("st"),
      ...statusFromCode(
        "ZONE.DM_MISMATCH",
        { systemId, zoneId: zone.id },
        { methods: Array.from(methods) }
      ),
    },
  ];
}

/* ─────────────────────────────────────────────────────────────
   CONTEXT API
   ───────────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────────
// CONTEXT API (type Model) — add hasCalculated to the context value
// ─────────────────────────────────────────────────────────────
type Model = {
  project: Project;

  // Project meta
  updateProject: (patch: Partial<Project>) => void;

  // Create
  addSystem: (type: SystemType) => void;
  addZone: (systemId: string) => void;
  addEnclosure: (systemId: string, zoneId: string) => void;

  // Update
  updateSystem: (systemId: string, patch: Partial<System>) => void;
  updateSystemOptions: (
    systemId: string,
    patch: Partial<SystemOptions>
  ) => void;
  changeSystemType: (systemId: string, type: SystemType) => void;
  updateZone: (systemId: string, zoneId: string, patch: Partial<Zone>) => void;
  updateEnclosure: (
    systemId: string,
    zoneId: string,
    enclosureId: string,
    patch: Partial<Enclosure>
  ) => void;

  // Remove
  removeSystem: (systemId: string) => void;
  removeZone: (systemId: string, zoneId: string) => void;
  removeEnclosure: (
    systemId: string,
    zoneId: string,
    enclosureId: string
  ) => void;

  // Actions
  runCalculateEngineered: () => void;
  runCalculatePreEngineered: () => void;
  runCalculateAll: () => void;
  applyPreEngSystemPartcode: (systemId: string) => void;

  // Status
  status: StatusMessage[];
  addStatus: (m: StatusInput | StatusInput[]) => void;
  clearStatus: (scope?: {
    systemId?: string;
    zoneId?: string;
    enclosureId?: string;
  }) => void;
  runValidate: () => void;

  // Derived
  hasErrors: boolean;
  hasCalculated: boolean; // ✅ new

  // Import/Export
  exportProjectToFile: () => void;
  importProjectFromFile: (file: File) => Promise<void>;
  triggerImportFilePicker: () => void;

  // BOM/Price
  generateEngineeredBOM: () => Promise<void>;
  priceIndexReady: boolean;
  projectListPrice: number | null;

  // NEW
  clearProject: () => void;

  // Autosave control (used by tutorial temp mode)
  setAutosaveEnabled: (enabled: boolean) => void;

  // Restore a project snapshot (raw JSON from localStorage "vortex:autosave")
  restoreAutosaveFromRaw: (raw: string) => void;
};

const AppModelContext = createContext<Model | null>(null);

/* ─────────────────────────────────────────────────────────────
   PROVIDER
   ───────────────────────────────────────────────────────────── */

export const AppModelProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const [status, setStatus] = useState<StatusMessage[]>([]);

  // Price index + live price
  const [priceIndex, setPriceIndex] = useState<PriceIndex | null>(null);
  const [priceIndexReady, setPriceIndexReady] = useState(false);
  const [projectListPrice, setProjectListPrice] = useState<number | null>(null);

  // ✅ Calculation gating
  const [hasCalculated, setHasCalculated] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);

  const restoreAutosaveFromRaw: Model["restoreAutosaveFromRaw"] = (raw) => {
    try {
      const snap = parseSnapshot(raw);
      if (snap?.project) {
        setStatus([]);
        setProjectListPrice(null);
        setHasCalculated(false);
        setProject(snap.project as Project);
      }
    } catch {
      /* ignore */
    }
  };

  // ✅ Any input mutation should call this
  const markDirty = () => {
    setHasCalculated(false);
    setProjectListPrice(null);
  };

  // ✅ Helper wrappers to reduce repetition
  const mutateProject = (updater: (p: Project) => Project) => {
    markDirty();
    setProject(updater);
  };

  const mutateProjectNoDirty = (updater: (p: Project) => Project) => {
    // use for calculate paths (does NOT reset hasCalculated)
    setProject(updater);
  };

  /* ---------- Find helpers ---------- */
  const findSystemIndex = (sid: string) =>
    project.systems.findIndex((s) => s.id === sid);
  const findZoneIndex = (sidx: number, zid: string) =>
    project.systems[sidx].zones.findIndex((z) => z.id === zid);
  const findEnclosureIndex = (sidx: number, zidx: number, eid: string) =>
    project.systems[sidx].zones[zidx].enclosures.findIndex((e) => e.id === eid);

  /* ---------- Status helpers ---------- */
  const addStatus: Model["addStatus"] = (m) => {
    const arr = Array.isArray(m) ? m : [m];
    setStatus((prev) => [
      ...prev,
      ...arr.map((x) => ({ ...x, id: newId("st") })),
    ]);
  };

  const clearStatus: Model["clearStatus"] = (scope) => {
    if (!scope) return setStatus([]);
    setStatus((msgs) =>
      msgs.filter((m) => {
        const matchSystem = scope.systemId
          ? m.systemId === scope.systemId
          : true;
        const matchZone = scope.zoneId ? m.zoneId === scope.zoneId : true;
        const matchEnc = scope.enclosureId
          ? m.enclosureId === scope.enclosureId
          : true;
        return !(matchSystem && matchZone && matchEnc);
      })
    );
  };

  const runValidate = () => {
    setStatus(validateProject(project));
  };

  /* ---------- Project CRUD ---------- */
  const clearProject: Model["clearProject"] = () => {
    if (!confirm("Clear the entire project and reset all fields?")) return;

    try {
      localStorage.removeItem("vortex:autosave");
    } catch {
      /* ignore */
    }

    setStatus([]);
    setProjectListPrice(null);
    setHasCalculated(false);

    setProject(DEFAULT_PROJECT);
  };

  const updateProject: Model["updateProject"] = (patch) => {
    mutateProject((p) => ({ ...p, ...patch }));
  };

  const addSystem: Model["addSystem"] = (type) => {
    mutateProject((p) => ({
      ...p,
      systems: [
        ...p.systems,
        {
          id: newId("sys"),
          name: `System ${p.systems.length + 1}`,
          type,
          zones:
            type === "preengineered"
              ? [makeDefaultPreZone()]
              : [makeDefaultEngZone(0)],
          options:
            type === "engineered" ? makeEngineeredOptions() : makePreOptions(),
        },
      ],
    }));
  };

  const addZone: Model["addZone"] = (systemId) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;
      const sys = p.systems[sidx];

      // Pre-engineered: only one zone allowed
      if (sys.type === "preengineered" && sys.zones.length >= 1) return p;

      const nextZone =
        sys.type === "engineered"
          ? makeDefaultEngZone(sys.zones.length)
          : makeDefaultPreZone();

      const systems = [...p.systems];
      systems[sidx] = { ...sys, zones: [...sys.zones, nextZone] };
      return { ...p, systems };
    });
  };

  const addEnclosure: Model["addEnclosure"] = (systemId, zoneId) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;
      const zidx = p.systems[sidx].zones.findIndex((z) => z.id === zoneId);
      if (zidx < 0) return p;

      const sys = p.systems[sidx];
      const zone = sys.zones[zidx];

      if (sys.type === "preengineered" && zone.enclosures.length >= 1) return p;

      const m: MethodName = "NFPA 770 Class A/C";
      const nz: NozzleCode = pickDefaultNozzle(m);
      const st: EmitterStyleKey | undefined = coerceStyle(m, nz);

      const enc: Enclosure = {
        id: newId("enc"),
        name: `Enclosure ${zone.enclosures.length + 1}`,
        volume: 1000,
        tempF: 70,
        method: m,
        nozzleCode: nz,
        emitterStyle: st,
        customMinEmitters: null,
        _editEmitters: false,
      };

      const zones = [...sys.zones];
      zones[zidx] = { ...zone, enclosures: [...zone.enclosures, enc] };

      const systems = [...p.systems];
      systems[sidx] = { ...sys, zones };
      return { ...p, systems };
    });
  };

  const updateSystem: Model["updateSystem"] = (systemId, patch) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;
      const systems = [...p.systems];
      systems[sidx] = { ...systems[sidx], ...patch };
      return { ...p, systems };
    });
  };

  const updateSystemOptions: Model["updateSystemOptions"] = (
    systemId,
    patch
  ) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;

      const current = p.systems[sidx];
      const nextOptions = {
        ...(current.options as any),
        ...(patch as any),
      } as SystemOptions;

      // deep merge addOns if provided
      if ((patch as any)?.addOns) {
        (nextOptions as any).addOns = {
          ...(current.options as any).addOns,
          ...(patch as any).addOns,
        };
      }
      (nextOptions as any).kind = (current.options as any).kind; // preserve kind

      const systems = [...p.systems];
      systems[sidx] = { ...current, options: nextOptions };
      return { ...p, systems };
    });
  };

  const changeSystemType: Model["changeSystemType"] = (systemId, type) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;

      const current = p.systems[sidx];
      const nextZones =
        type === "preengineered" ? [makeDefaultPreZone()] : current.zones;

      const systems = [...p.systems];
      systems[sidx] = {
        ...current,
        type,
        zones: nextZones,
        options:
          type === "engineered" ? makeEngineeredOptions() : makePreOptions(),
      };
      return { ...p, systems };
    });
  };

  const updateZone: Model["updateZone"] = (systemId, zoneId, patch) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;
      const zidx = p.systems[sidx].zones.findIndex((z) => z.id === zoneId);
      if (zidx < 0) return p;

      const zones = [...p.systems[sidx].zones];
      zones[zidx] = { ...zones[zidx], ...patch };

      const systems = [...p.systems];
      systems[sidx] = { ...p.systems[sidx], zones };
      return { ...p, systems };
    });
  };

  const updateEnclosure: Model["updateEnclosure"] = (
    systemId,
    zoneId,
    eid,
    patch
  ) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;
      const zidx = p.systems[sidx].zones.findIndex((z) => z.id === zoneId);
      if (zidx < 0) return p;
      const eidx = p.systems[sidx].zones[zidx].enclosures.findIndex(
        (e) => e.id === eid
      );
      if (eidx < 0) return p;

      const zone = p.systems[sidx].zones[zidx];
      const old = zone.enclosures[eidx];
      let next: Enclosure = { ...old, ...patch };

      // 1) Method changed → reset nozzle & style to valid defaults
      if (patch.method && patch.method !== old.method) {
        const m = next.method as MethodName;
        const nz: NozzleCode = pickDefaultNozzle(m);
        next.nozzleCode = nz;
        next.emitterStyle = coerceStyle(m, nz);
      }

      // 2) Nozzle changed → ensure style is valid for (method, nozzle)
      if (patch.nozzleCode && patch.nozzleCode !== old.nozzleCode) {
        const m = (next.method as MethodName) ?? (old.method as MethodName);
        const nz = next.nozzleCode as NozzleCode;
        next.emitterStyle = coerceStyle(m, nz, next.emitterStyle);
      }

      // 3) Style changed → ensure it belongs to current (method, nozzle)
      if (patch.emitterStyle && patch.emitterStyle !== old.emitterStyle) {
        const m = (next.method as MethodName) ?? (old.method as MethodName);
        const nz =
          (next.nozzleCode as NozzleCode) ?? (old.nozzleCode as NozzleCode);
        next.emitterStyle = coerceStyle(
          m,
          nz,
          patch.emitterStyle as EmitterStyleKey
        );
      }

      const enclosures = [...zone.enclosures];
      enclosures[eidx] = next;

      const zones = [...p.systems[sidx].zones];
      zones[zidx] = { ...zone, enclosures };

      const systems = [...p.systems];
      systems[sidx] = { ...p.systems[sidx], zones };
      return { ...p, systems };
    });
  };

  /* ---------- Remove ---------- */
  const removeSystem: Model["removeSystem"] = (systemId) => {
    mutateProject((p) => {
      const nextRaw = p.systems.filter((s) => s.id !== systemId);
      const nextSystems = reindexDefaultNames(nextRaw, "System");
      return { ...p, systems: nextSystems };
    });
  };

  const removeZone: Model["removeZone"] = (systemId, zoneId) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;

      const sys = p.systems[sidx];
      const nextRawZones = sys.zones.filter((z) => z.id !== zoneId);
      const nextZones =
        sys.type === "engineered"
          ? reindexDefaultNames(nextRawZones, "Zone")
          : nextRawZones;

      const systems = [...p.systems];
      systems[sidx] = { ...sys, zones: nextZones };
      return { ...p, systems };
    });
  };

  const removeEnclosure: Model["removeEnclosure"] = (systemId, zoneId, eid) => {
    mutateProject((p) => {
      const sidx = p.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return p;

      const zidx = p.systems[sidx].zones.findIndex((z) => z.id === zoneId);
      if (zidx < 0) return p;

      const sys = p.systems[sidx];
      const zone = sys.zones[zidx];

      const nextRawEncs = zone.enclosures.filter((e) => e.id !== eid);
      const nextEncs =
        sys.type === "engineered"
          ? reindexDefaultNames(nextRawEncs, "Enclosure")
          : nextRawEncs;

      const zones = [...sys.zones];
      zones[zidx] = { ...zone, enclosures: nextEncs };

      const systems = [...p.systems];
      systems[sidx] = { ...sys, zones };
      return { ...p, systems };
    });
  };

  /* ---------- Pricing / BOM helpers ---------- */
  async function ensurePriceIndex(): Promise<PriceIndex> {
    if (priceIndex) return priceIndex;
    const idx = await fetchPriceIndex();
    setPriceIndex(idx);
    setPriceIndexReady(true);
    return idx;
  }

  async function computeProjectListPrice(p: Project): Promise<number> {
    const idx = await ensurePriceIndex();
    const bySystem: EngineeredBomBySystem = collectBOM(p);
    let total = 0;

    Object.values(bySystem).forEach(({ bom }) => {
      bom.forEach((line) => {
        const entry =
          idx[line.partcode] || (line.alt ? idx[line.alt] : undefined);
        const unit = entry?.listPrice ?? 0;
        total += unit * (line.qty || 0);
      });
    });

    return total;
  }

  async function recomputeProjectListPrice(p: Project) {
    try {
      const total = await computeProjectListPrice(p);
      setProjectListPrice(Number.isFinite(total) ? total : null);
    } catch {
      setProjectListPrice(null);
    }
  }

  /* ---------- Actions (Calculate) ---------- */
  const runCalculateEngineered: Model["runCalculateEngineered"] = () => {
    setStatus([]);
    const pre = validateProject(project);

    const { project: nextProject, messages: runtime = [] } =
      calculateEngineered(project);
    const reconciled = syncPointsFromBOM(nextProject);

    mutateProjectNoDirty(() => reconciled);

    const runtimeWithIds = runtime.map((m) => ({ ...m, id: newId("st") }));
    const msgs = [...pre, ...runtimeWithIds];
    setStatus(msgs);

    const blocked = msgs.some((m) => m.severity === "error");
    if (!blocked) void recomputeProjectListPrice(reconciled);
    else setProjectListPrice(null);

    setHasCalculated(!blocked); // ✅ FIX
  };
  const runCalculatePreEngineered: Model["runCalculatePreEngineered"] = () => {
    setStatus([]);

    // 0) Apply locked partcodes first (this can mutate effective inputs)
    const locked = applyAllLockedPreEngPartcodes(project);

    // 1) Validate the applied project (NOT the stale one)
    const pre = validateProject(locked.project);

    // 2) Run calc
    const { project: nextProject, messages: runtime = [] } =
      calculatePreEngineered(locked.project);

    // 3) Update project without marking dirty (calc results are not "user edits")
    mutateProjectNoDirty(() => nextProject);

    // 4) Merge messages
    const msgs = [
      ...pre,
      ...locked.messages.map((m) => ({ ...m, id: newId("st") })),
      ...runtime.map((m) => ({ ...m, id: newId("st") })),
    ];
    setStatus(msgs);

    // 5) Blocked?
    const blocked = msgs.some((m) => m.severity === "error");
    if (!blocked) void recomputeProjectListPrice(nextProject);
    else setProjectListPrice(null);

    // ✅ Only "calculated" if not blocked
    setHasCalculated(!blocked);
  };

  const runCalculateAll: Model["runCalculateAll"] = () => {
    setStatus([]);

    // 0) Apply locked pre-eng partcodes before anything else
    const applied = applyAllLockedPreEngPartcodes(project);

    // 1) Validate applied project
    const pre = validateProject(applied.project);

    // 2) Engineered then pre-engineered
    const eng = calculateEngineered(applied.project);
    const engSynced = syncPointsFromBOM(eng.project);
    const pree = calculatePreEngineered(engSynced);

    // 3) Update final project without marking dirty
    mutateProjectNoDirty(() => pree.project);

    // 4) Merge messages
    const msgs = [
      ...pre,
      ...applied.messages.map((m) => ({ ...m, id: newId("st") })),
      ...(eng.messages ?? []).map((m) => ({ ...m, id: newId("st") })),
      ...(pree.messages ?? []).map((m) => ({ ...m, id: newId("st") })),
    ];
    setStatus(msgs);

    // 5) Blocked?
    const blocked = msgs.some((m) => m.severity === "error");
    if (!blocked) void recomputeProjectListPrice(pree.project);
    else setProjectListPrice(null);

    // ✅ Only "calculated" if not blocked
    setHasCalculated(!blocked);
  };

  // ✅ Partcode apply is an input mutation → markDirty()
  const applyPreEngSystemPartcode = (systemId: string) => {
    const sys = project.systems.find((s) => s.id === systemId);
    if (!sys || sys.type !== "preengineered") return;

    clearStatus({ systemId });

    const opts = sys.options as PreEngineeredOptions;
    const rawInput = String(opts.systemPartCode ?? "").trim();

    if (!rawInput) {
      addStatus(
        statusFromCode(
          "SYS.INVALID_PARTCODE",
          { systemId },
          {
            message:
              "System partcode is empty. Enter a valid 15-character pre-engineered system code.",
          }
        )
      );
      return;
    }

    const decoded = decodeSystemPartcodeToConfig(rawInput);

    if (decoded.ok == false) {
      const { reason, digit } = decoded;
      let message = "Invalid system partcode.";
      if (reason === "empty") {
        message =
          "System partcode is empty. Enter a valid 15-character pre-engineered system code.";
      } else if (reason === "length") {
        message = `Invalid system partcode length. Expected 15 digits but received ${digit}.`;
      } else if (reason === "digit") {
        message = `Invalid system partcode at digit [${digit}]. Check the digit value(s), then try again.`;
      } else if (reason === "conflict") {
        message = `Invalid system partcode due to conflicting values at digit(s) [${digit}].`;
      }

      addStatus(
        statusFromCode("SYS.INVALID_PARTCODE", { systemId }, { message })
      );
      return;
    }

    const { prePatch, zonePatch, enclosurePatch, formatted } = decoded.decoded;

    mutateProject((prev) => {
      const sidx = prev.systems.findIndex((s) => s.id === systemId);
      if (sidx < 0) return prev;

      const oldSys = prev.systems[sidx];
      if (oldSys.type !== "preengineered") return prev;

      const oldZone = oldSys.zones[0] ?? makeDefaultPreZone();
      const oldEnc0 = oldZone.enclosures?.[0] ?? makeDefaultPreEnclosure(1);

      let nextEnc0: Enclosure = { ...oldEnc0, ...enclosurePatch };

      if (!nextEnc0.nozzleCode) {
        const m = nextEnc0.method as MethodName;
        const nz = pickDefaultNozzle(m, { systemType: "preengineered" } as any);
        nextEnc0.nozzleCode = nz;
      }
      if (nextEnc0.nozzleCode) {
        nextEnc0.emitterStyle = coerceStyle(
          nextEnc0.method as MethodName,
          nextEnc0.nozzleCode as NozzleCode,
          nextEnc0.emitterStyle
        );
      }

      const newZone0: Zone = {
        ...oldZone,
        ...zonePatch,
        enclosures: [nextEnc0],
      };

      const oldOpts = oldSys.options as PreEngineeredOptions;
      const mergedAddOns = {
        ...(oldOpts.addOns ?? {}),
        ...((prePatch as any).addOns ?? {}),
      };

      const newOptions: PreEngineeredOptions = {
        ...oldOpts,
        ...prePatch,
        addOns: mergedAddOns,
        systemPartCode: formatted,
        systemPartCodeLocked: true,
        kind: "preengineered",
      };

      const systems = [...prev.systems];
      systems[sidx] = { ...oldSys, zones: [newZone0], options: newOptions };
      return { ...prev, systems };
    });

    addStatus({
      severity: "info",
      systemId,
      text: `System configuration updated from partcode ${formatted}`,
    });
  };

  function applyAllLockedPreEngPartcodes(p: Project): {
    project: Project;
    messages: StatusInput[];
  } {
    const messages: StatusInput[] = [];

    const normalizeLockedSystem = (sys: System): System => {
      if (sys.type !== "preengineered") return sys;

      const opts = sys.options as PreEngineeredOptions;
      if (!opts.systemPartCodeLocked) return sys;

      const rawInput = String(opts.systemPartCode ?? "").trim();

      const pushInvalid = (message: string) => {
        messages.push(
          statusFromCode(
            "SYS.INVALID_PARTCODE",
            { systemId: sys.id },
            { message }
          )
        );
      };

      if (!rawInput) {
        pushInvalid(
          "System partcode is empty. Enter a valid 15-character pre-engineered system code."
        );
        return sys;
      }

      const decoded = decodeSystemPartcodeToConfig(rawInput);

      if (decoded.ok === false) {
        const { reason, digit } = decoded;
        let message = "Invalid system partcode.";

        if (reason === "empty") {
          message =
            "System partcode is empty. Enter a valid 15-character pre-engineered system code.";
        } else if (reason === "length") {
          message = `Invalid system partcode length. Expected 15 digits but received ${digit}.`;
        } else if (reason === "digit") {
          message = `Invalid system partcode at digit [${digit}]. Check the digit value(s), then try again.`;
        } else if (reason === "conflict") {
          message = `Invalid system partcode due to conflicting values at digit(s) [${digit}].`;
        }

        pushInvalid(message);
        return sys;
      }

      const { prePatch, zonePatch, enclosurePatch, formatted } =
        decoded.decoded;

      // Ensure zone + enclosure exist (pre-eng assumes 1)
      const oldZone = sys.zones[0] ?? makeDefaultPreZone();
      const oldEnc0 = oldZone.enclosures?.[0] ?? makeDefaultPreEnclosure(1);

      // Apply enclosure patch
      let nextEnc0: Enclosure = { ...oldEnc0, ...enclosurePatch };

      // Safety: enforce valid nozzle/style even if mapping is partial
      if (!nextEnc0.nozzleCode) {
        const m = nextEnc0.method as MethodName;
        const nz = pickDefaultNozzle(m, { systemType: "preengineered" } as any);
        nextEnc0.nozzleCode = nz;
      }
      if (nextEnc0.nozzleCode) {
        nextEnc0.emitterStyle = coerceStyle(
          nextEnc0.method as MethodName,
          nextEnc0.nozzleCode as NozzleCode,
          nextEnc0.emitterStyle
        );
      }

      // Apply zone patch, preserve other zone props
      const newZone0: Zone = {
        ...oldZone,
        ...zonePatch,
        enclosures: [nextEnc0],
      };

      // Merge addOns (patch addOns should override existing)
      const oldOpts = sys.options as PreEngineeredOptions;
      const mergedAddOns = {
        ...(oldOpts.addOns ?? {}),
        ...((prePatch as any).addOns ?? {}),
      };

      const newOptions: PreEngineeredOptions = {
        ...oldOpts,
        ...prePatch,
        addOns: mergedAddOns,
        systemPartCode: formatted, // normalize display
        systemPartCodeLocked: true,
        kind: "preengineered",
      };

      return {
        ...sys,
        zones: [newZone0],
        options: newOptions,
      };
    };

    const systems = p.systems.map(normalizeLockedSystem);
    return { project: { ...p, systems }, messages };
  }
  const hasErrors = status.some((m) => m.severity === "error");

  /* ---------- Import/Export ---------- */
  const exportProjectToFile: Model["exportProjectToFile"] = () => {
    const snap = makeSnapshotV1(project);
    const safeName = (project?.name || "Untitled").replace(/[^\w\-]+/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `VortexProject_${safeName}_${stamp}.json`;

    void saveTextFileSmart(filename, JSON.stringify(snap, null, 2), {
      filterJson: true,
    }).then((ok) => {
      if (!ok) {
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    });
  };

  const importProjectFromFile: Model["importProjectFromFile"] = async (
    file
  ) => {
    const text = await readFileAsText(file);
    try {
      const snap = parseSnapshot(text);
      if (!snap?.project || typeof snap.project !== "object") {
        throw new Error("Imported file has no project payload.");
      }

      // ✅ importing is an input mutation → dirty + clear statuses (optional)
      setStatus([]);
      setProjectListPrice(null);
      setHasCalculated(false);

      setProject(snap.project as Project);

      addStatus({
        severity: "info",
        text: `Imported project: ${(snap.project as any).name || "Untitled"}`,
      });
    } catch (err: any) {
      addStatus({
        severity: "error",
        text: err?.message || "Import failed. File may be incompatible.",
      });
      throw err;
    }
  };

  // Hidden file input (imperative trigger)
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const triggerImportFilePicker: Model["triggerImportFilePicker"] =
    async () => {
      const text = await openTextFileSmart({ filterJson: true });
      if (text) {
        try {
          const snap = parseSnapshot(text);
          if (!snap?.project || typeof snap.project !== "object") {
            throw new Error("Imported file has no project payload.");
          }

          setStatus([]);
          setProjectListPrice(null);
          setHasCalculated(false);

          setProject(snap.project as Project);

          addStatus({
            severity: "info",
            text: `Imported project: ${(snap.project as any).name || "Untitled"}`,
          });
          return;
        } catch (err: any) {
          addStatus({
            severity: "error",
            text: err?.message || "Import failed. File may be incompatible.",
          });
          // fall through to web picker
        }
      }
      hiddenInputRef.current?.click();
    };

  const HiddenFileInput = (
    <input
      ref={hiddenInputRef}
      type="file"
      accept="application/json"
      style={{ display: "none" }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        (async () => {
          try {
            await importProjectFromFile(file);
          } finally {
            input.value = "";
          }
        })();
      }}
    />
  );

  /* ---------- Autosave ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vortex:autosave");
      if (!raw) return;
      const snap = parseSnapshot(raw);
      if (snap?.project) {
        // ✅ restoring is “dirty” (must re-calc before BOM/submit)
        setStatus([]);
        setProjectListPrice(null);
        setHasCalculated(false);
        setProject(snap.project as Project);
      }
    } catch {
      /* ignore bad autosave */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!autosaveEnabled) return;

    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      try {
        const snap = makeSnapshotV1(project);
        localStorage.setItem("vortex:autosave", JSON.stringify(snap));
      } catch {
        /* ignore */
      }
    }, 400);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [project, autosaveEnabled]);

  /* ---------- BOM Excel generation ---------- */
  const projectNetPrice = useMemo(() => {
    const mult = Math.min(
      1,
      Math.max(0, Number(project.customerMultiplier ?? 1))
    );
    return projectListPrice == null ? null : projectListPrice * mult;
  }, [projectListPrice, project.customerMultiplier]);

  async function generateEngineeredBOM() {
    // Guard: must have a successful calculation AND no blocking errors
    if (!hasCalculated || hasErrors) return;

    const idx = await ensurePriceIndex();
    const wb = await buildWorkbookForProject({
      project,
      priceIndex: idx,
      options: {
        currency: project.currency,
        multiplier: Math.min(
          1,
          Math.max(0, Number(project.customerMultiplier ?? 1))
        ),
      },
    });

    const buffer = await wb.xlsx.writeBuffer();
    const fnameSafe = (project.name || "Project").replace(/[^\w\-]+/g, "_");
    const bytes = new Uint8Array(buffer as ArrayBuffer);

    const saved = await saveBinaryFileSmart(`${fnameSafe}.xlsx`, bytes, {
      filterXlsx: true,
    });
    if (!saved) {
      saveAs(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${fnameSafe}.xlsx`
      );
    }
  }

  /* ---------- Context value ---------- */
  const value = useMemo<Model>(
    () => ({
      project,

      updateProject,
      addSystem,
      addZone,
      addEnclosure,

      updateSystem,
      updateSystemOptions,
      changeSystemType,
      updateZone,
      updateEnclosure,

      removeSystem,
      removeZone,
      removeEnclosure,

      runCalculateEngineered,
      runCalculatePreEngineered,
      runCalculateAll,
      applyPreEngSystemPartcode,

      status,
      addStatus,
      clearStatus,
      runValidate,

      hasErrors,
      hasCalculated, // ✅ expose to UI

      exportProjectToFile,
      importProjectFromFile,
      triggerImportFilePicker,

      generateEngineeredBOM,
      priceIndexReady,
      projectListPrice,
      projectNetPrice,

      clearProject,

      setAutosaveEnabled,
      restoreAutosaveFromRaw,
    }),
    [
      project,
      status,
      hasErrors,
      hasCalculated,
      priceIndexReady,
      projectListPrice,
      projectNetPrice,
    ]
  );

  return (
    <AppModelContext.Provider value={value}>
      {HiddenFileInput}
      {children}
    </AppModelContext.Provider>
  );
};

/* ─────────────────────────────────────────────────────────────
   HOOK
   ───────────────────────────────────────────────────────────── */

export function useAppModel() {
  const ctx = useContext(AppModelContext);
  if (!ctx) throw new Error("useAppModel must be used inside AppModelProvider");
  return ctx;
}
