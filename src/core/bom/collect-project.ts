import type {
  Project,
  System,
  Zone,
  Enclosure,
  EngineeredOptions,
  WaterTankCert,
  PreEngineeredOptions,
} from "@/state/app-model";
import { resolveEmitterSpec } from "@/core/catalog/emitter.catalog";
import {
  __eng_iom_manual,
  __warning_inside,
  __warning_outside,
  __placard_int_zone,
  __placard_ext_zone,
  __pilot_primary_80L,
  __pilot_secondary_80L,
  __x2_rack_hose,
  __adj_rack_hose,
  __refill_cga580,
  __refill_cga677,
  __80L_cylinder_n2,
  __80L_cylinder_n2_unfilled,
  __placard_manual,
  __placard_rack,
  __refill_bulk,
  __flexible_hose,
  __braided_hose_36,
  __n2_relief_valve,
  __tank_regulator_nor,
  __tank_regulator_hc,
  __panel1_1500ar,
  __panel1_1500dc,
  __panel15_1500ar,
  __panel15_1500dc,
  __manifold_15assembly,
  __manifold_1assembly,
  __vortex_data_proc,
  __vortex_comb_turb,
  __vortex_spec_hazards,
  __transducer_exp,
  __transducer_nor,
  __threaded_ball_valve,
  __backup_bat_115,
  __backup_bat_220,
  __cylinder_rack_1_4,
  __cylinder_rack_5_8,
  __cylinder_rack_9_12,
  __manifold_6x2,
  __manifold_2x2,
  __manifold_4x2,
  __manifold_plug,
  __49L_cylinder_n2,
  __pilot_primary_49L,
  __pilot_secondary_49L,
  __pre_1cyl,
  __pre_2cyl,
  __pre_3cyl,
  __pre_4cyl,
  __pre_5cyl,
  __pre_6cyl,
  __pre_7cyl,
  __pre_8cyl,
  __vortex_data_proc_pe,
  __preeng_iom_manual,
  __12_low_pressure_n2_switch,
  __tamper_resistance_kit, // ← ADD THIS
  type Codes,
} from "@/core/catalog/parts.constants";
import type { BomMap, BomLine, EngineeredBomBySystem } from "./types";
import {
  buildPreEngSystemPartcodeFromConfig,
  formatSystemPartCode, // if you want to keep any direct usage
} from "@/core/calc/preengineered/partcode";

// NEW: strict water-tank selector (exact cert match)
import {
  selectWaterTankStrict,
  TANKS,
} from "@/core/catalog/water_tanks.catalog";

// ---- FACP (Fire Alarm Control Points) support ----

export type FacpPointType =
  | "Monitor IDC - Supervisory"
  | "Monitor IDC - Alarm"
  | "24vdc Releasing Circuit";

export type FacpRow = {
  partcode: string; // primary code (BPCS)
  alt?: string; // alt code (M3)
  qty: number; // component quantity
  // You can fill description later in Excel by price lookup
  points: Array<{ type: FacpPointType; description: string }>;
};

export type FacpSystemBlock = {
  systemName: string;
  rows: FacpRow[];
  totals: { supervisory: number; alarm: number; releasing: number };
};

export type FacpBySystem = Record<string, FacpSystemBlock>;

// Build a Set of all codes for a [BPCS, M3] pair
const CODESET = (codes: Codes): Set<string> => {
  const s = new Set<string>();
  if (Array.isArray(codes)) for (const c of codes) if (c) s.add(c);
  return s;
};

// Assemble rule code sets (only using constants you already import here)
const PANEL_DC = new Set<string>([
  ...CODESET(__panel1_1500dc),
  ...CODESET(__panel15_1500dc),
  // Add more DC/ZDC/FDC variants here if you import them:
  // ...CODESET(__panel1_fdc), ...CODESET(__panel15_fdc), ...CODESET(__panel15_zdc), ...CODESET(__panel2_zdc),
]);

const PANEL_AR = new Set<string>([
  ...CODESET(__panel1_1500ar),
  ...CODESET(__panel15_1500ar),
]);

const PRE_SUBASSEMBLIES = new Set<string>([
  ...CODESET(__pre_1cyl),
  ...CODESET(__pre_2cyl),
  ...CODESET(__pre_3cyl),
  ...CODESET(__pre_4cyl),
  ...CODESET(__pre_5cyl),
  ...CODESET(__pre_6cyl),
  ...CODESET(__pre_7cyl),
  ...CODESET(__pre_8cyl),
]);

const PILOT_PRIMARY_80L = CODESET(__pilot_primary_80L);
const PILOT_PRIMARY_49L = CODESET(__pilot_primary_49L);

const MANIFOLD_ASM = new Set<string>([
  ...CODESET(__manifold_1assembly),
  ...CODESET(__manifold_15assembly),
]);
const THREADED_BALL_VALVE = CODESET(__threaded_ball_valve);
const BATT_115 = CODESET(__backup_bat_115);
const BATT_220 = CODESET(__backup_bat_220);

const LOW_PRESS_N2_SWITCH = CODESET(__12_low_pressure_n2_switch);

// Water tank codes from catalog (match any tank we select into the BOM)
const WATER_TANK_CODES = new Set<string>(
  TANKS.flatMap((t) => t.codes).filter(Boolean)
);

// Fixed point payloads
const P_MON_SUP = "Monitor IDC - Supervisory" as const;
const P_MON_ALM = "Monitor IDC - Alarm" as const;
const P_REL24 = "24vdc Releasing Circuit" as const;

const PANEL_DC_POINTS = [
  { type: P_MON_SUP, description: "Vortex Panel Fault" },
  { type: P_MON_ALM, description: "Vortex Panel Discharge" },
  { type: P_REL24, description: "ARV Contact" },
] as const;

const PANEL_AR_POINTS = [
  { type: P_MON_SUP, description: "Vortex Panel Fault" },
  { type: P_MON_ALM, description: "Vortex Panel Discharge" },
] as const;

const PRE_POINTS = [
  { type: P_MON_SUP, description: "Vortex Panel Fault" },
  { type: P_MON_ALM, description: "Vortex Panel Discharge" },
  { type: P_MON_SUP, description: "Water ISO Valve Tamper" },
  { type: P_MON_SUP, description: "Nitrogen ISO Valve Tamper" },
] as const;

const PILOT_PRIMARY_POINTS = [
  { type: P_MON_SUP, description: "Coil Tamper" },
  { type: P_MON_SUP, description: "Cylinder Low Pressure" },
  { type: P_REL24, description: "Cylinder Solenoid" },
] as const;

const MANIFOLD_POINTS = [
  { type: P_MON_SUP, description: "N2 ISO Valve Tamper" },
] as const;

const TANK_POINTS = [
  { type: P_MON_SUP, description: "Water Tank Level" },
] as const;

const ISO_WATER_VALVE_POINTS = [
  { type: P_MON_SUP, description: "Water ISO Valve Tamper" },
] as const;

const BATTERY_POINTS = [
  { type: P_MON_SUP, description: "Battery Fault" },
  { type: P_MON_SUP, description: "AC Fault" },
] as const;

const DISCHARGE_VERIF_POINTS = [
  { type: P_MON_ALM, description: "Discharge Verification" },
] as const;
function getTankPickFromOptions(opts: { waterTankPick?: Codes | null }) {
  const pick = opts.waterTankPick ?? null;
  return pick && Array.isArray(pick) && pick[0] ? pick : null;
}

function getTankReqFromOptions(opts: {
  waterTankRequired_gal?: number | null;
}) {
  const n = Number(opts.waterTankRequired_gal);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function facpPointsFor(
  partcode: string,
  alt?: string
): Array<{ type: FacpPointType; description: string }> | null {
  const cands = [partcode, alt].filter(Boolean) as string[];

  const inSet = (set: Set<string>) => cands.some((c) => set.has(c));

  if (cands.some((c) => WATER_TANK_CODES.has(c))) return [...TANK_POINTS];
  if (inSet(PRE_SUBASSEMBLIES)) return [...PRE_POINTS];
  if (inSet(PANEL_DC)) return [...PANEL_DC_POINTS];
  if (inSet(PANEL_AR)) return [...PANEL_AR_POINTS];
  if (inSet(PILOT_PRIMARY_80L)) return [...PILOT_PRIMARY_POINTS];
  if (inSet(PILOT_PRIMARY_49L)) return [...PILOT_PRIMARY_POINTS];

  if (inSet(THREADED_BALL_VALVE)) return [...ISO_WATER_VALVE_POINTS];
  if (inSet(BATT_115) || inSet(BATT_220)) return [...BATTERY_POINTS];
  if (inSet(LOW_PRESS_N2_SWITCH)) return [...DISCHARGE_VERIF_POINTS];
  if (inSet(MANIFOLD_ASM)) return [...MANIFOLD_POINTS];

  return null;
}

function buildFacpBlockForSystem(
  systemName: string,
  bom: BomMap
): FacpSystemBlock {
  const rows: FacpRow[] = [];
  let supervisory = 0,
    alarm = 0,
    releasing = 0;

  for (const line of bom.values()) {
    const pts = facpPointsFor(line.partcode, line.alt);
    if (!pts || pts.length === 0) continue;

    // count totals (each point type × component qty)
    for (const p of pts) {
      if (p.type === "Monitor IDC - Supervisory") supervisory += line.qty;
      else if (p.type === "Monitor IDC - Alarm") alarm += line.qty;
      else if (p.type === "24vdc Releasing Circuit") releasing += line.qty;
    }

    rows.push({
      partcode: line.partcode,
      alt: line.alt,
      qty: line.qty,
      points: pts.map((p) => ({ type: p.type, description: p.description })),
    });
  }

  return {
    systemName,
    rows,
    totals: { supervisory, alarm, releasing },
  };
}

export function collectFACP(project: Project): FacpBySystem {
  const result: FacpBySystem = {};
  const eng = collectEngineeredBOM(project);
  const pre = collectPreEngineeredBOM(project);

  for (const [sysId, block] of Object.entries({ ...eng, ...pre })) {
    result[sysId] = buildFacpBlockForSystem(block.systemName, block.bom);
  }
  return result;
}

function keyFor(scopeKey: string, partcode: string) {
  return `${scopeKey}::${partcode}`;
}

function add(
  bom: BomMap,
  part: Codes | null,
  qty: number,
  scope: BomLine["scope"]
) {
  // reject empty/null parts and invalid qty
  const code = part?.[0];
  const alt = part?.[1];
  if (!code || qty <= 0) return;

  const partcode = String(code);
  const altcode = typeof alt === "string" ? alt : undefined;

  const scopeKey =
    typeof scope === "string"
      ? scope
      : scope.enclosureId
        ? `enc:${scope.zoneId}/${scope.enclosureId}`
        : `zone:${scope.zoneId}`;

  const k = keyFor(scopeKey, partcode);
  const prev = bom.get(k);
  if (prev) prev.qty += qty;
  else bom.set(k, { partcode, alt: altcode, qty, scope });
}

// ─────────────────────────────────────────────────────────────
// Unified collector: engineered + pre-engineered
// (keeps your existing Engineered collector 100% intact)
// ─────────────────────────────────────────────────────────────
export function collectBOM(project: Project): EngineeredBomBySystem {
  const merged: EngineeredBomBySystem = {};
  const eng = collectEngineeredBOM(project);
  const pre = collectPreEngineeredBOM(project);
  for (const [k, v] of Object.entries(eng)) merged[k] = v;
  for (const [k, v] of Object.entries(pre)) merged[k] = v;
  return merged;
}
// ─────────────────────────────────────────────────────────────
// PRE-ENGINEERED COLLECTOR (single zone, single enclosure)
// Reuses the same Map/add/scoping + emitter signage rules,
// but avoids engineered-only options (panels, water flex line, etc.).
// ─────────────────────────────────────────────────────────────

export function collectPreEngineeredBOM(
  project: Project
): EngineeredBomBySystem {
  const out: EngineeredBomBySystem = {};

  for (const sys of project.systems) {
    if (sys.type !== "preengineered") continue;
    const bom: BomMap = new Map();
    const opts = sys.options as PreEngineeredOptions;
    const zones = sys.zones || [];
    if (!zones.length) {
      out[sys.id] = { systemName: sys.name, bom };
      continue;
    }

    const zone = zones[0]; // pre-E: single zone
    const enc = (zone.enclosures || [])[0]; // pre-E: single enclosure
    if (!enc) {
      out[sys.id] = { systemName: sys.name, bom };
      continue;
    }
    add(bom, __preeng_iom_manual, 1, "supply");
    //============================================CYLINDER SIZE============================================//
    const cylCount = Math.max(0, zone.minTotalCylinders ?? 0);
    const is80 = (enc as any)?._cylinderSize === "80L";
    const useFilledCyl = (project.currency ?? "USD") === "USD";
    //============================================NUMBER OF CYLINDERS============================================//
    if (cylCount > 0) {
      if (is80) {
        add(
          bom,
          useFilledCyl ? __80L_cylinder_n2 : __80L_cylinder_n2_unfilled,
          cylCount,
          "supply"
        );
        add(bom, __pilot_primary_80L, 1, "supply");
        add(bom, __pilot_secondary_80L, cylCount - 1, "supply");
      } else {
        add(bom, __49L_cylinder_n2, cylCount, "supply");
        add(bom, __pilot_primary_49L, 1, "supply");
        add(bom, __pilot_secondary_49L, cylCount - 1, "supply");
      }
    }
    let subassembly: Codes | null = null;
    switch (cylCount) {
      case 1:
        subassembly = __pre_1cyl;
        break;
      case 2:
        subassembly = __pre_2cyl;
        break;
      case 3:
        subassembly = __pre_3cyl;
        break;
      case 4:
        subassembly = __pre_4cyl;
        break;
      case 5:
        subassembly = __pre_5cyl;
        break;
      case 6:
        subassembly = __pre_6cyl;
        break;
      case 7:
        subassembly = __pre_7cyl;
        break;
      case 8:
        subassembly = __pre_8cyl;
        break;
    }
    add(bom, subassembly, 1, "supply");
    //============================================EMITTER SELECTION============================================//
    const nozzle = enc.nozzleCode || "";
    const style = (enc.emitterStyle as any) || "escutcheon-stainless";
    const spec = resolveEmitterSpec(enc.method as any, nozzle, style);
    const nEmitters = enc.minEmitters ?? 0;

    if (spec && nEmitters > 0) {
      add(bom, spec.emitterPart, nEmitters, {
        zoneId: zone.id,
        zoneName: zone.name,
        enclosureId: enc.id,
        enclosureName: enc.name,
      });
      add(bom, spec.flowCartridge, nEmitters, {
        zoneId: zone.id,
        zoneName: zone.name,
        enclosureId: enc.id,
        enclosureName: enc.name,
      });

      // Relief valve rule: enclosure flow ≤ 150 SCFM
      if ((spec.q_n2 || 0) * nEmitters <= 150) {
        add(bom, __n2_relief_valve, 1, {
          zoneId: zone.id,
          zoneName: zone.name,
          enclosureId: enc.id,
          enclosureName: enc.name,
        });
      }
    }
    //============================================REFILL ADAPTER============================================//
    if (opts.refillAdapter === "CGA-580") {
      add(bom, __refill_cga580, cylCount, "supply");
    } else if (opts.refillAdapter === "CGA-677") {
      add(bom, __refill_cga677, cylCount, "supply");
    }
    add(bom, __braided_hose_36, nEmitters, {
      zoneId: zone.id,
      zoneName: zone.name,
      enclosureId: enc.id,
      enclosureName: enc.name,
    });
    if (opts.addOns.bulkRefillAdapter) {
      add(bom, __refill_bulk, 1, "supply");
    } else {
    }
    // ============================================WATER TANK============================================ //
    add(bom, __tamper_resistance_kit, 1, "supply");
    const reqGal =
      Math.ceil(getTankReqFromOptions(opts)) ||
      Math.ceil(Number((zone as any).waterTankMin_gal) || 0);
    const pickFromCalc = getTankPickFromOptions(opts);

    if (pickFromCalc) {
      add(bom, pickFromCalc, 1, "supply");
    } else {
      const cert = opts.waterTankCertification;
      if (cert && reqGal > 0) {
        const chosen = selectWaterTankStrict(cert, reqGal);
        if (chosen?.codes) add(bom, chosen.codes, 1, "supply");
      }
    }
    //============================================POWER SUPPLY============================================//
    if (opts.powerSupply === "120") {
      add(bom, __backup_bat_115, 1, "supply");
    } else if (opts.powerSupply === "240") {
      add(bom, __backup_bat_220, 1, "supply");
    }
    //============================================TRANSDUCER TYPE============================================//
    if (opts.addOns?.expProofTransducer) {
      add(bom, __transducer_exp, 1, {
        zoneId: zone.id,
        zoneName: zone.name,
        enclosureId: enc.id,
        enclosureName: enc.name,
      });
    } else {
      add(bom, __transducer_nor, 1, {
        zoneId: zone.id,
        zoneName: zone.name,
        enclosureId: enc.id,
        enclosureName: enc.name,
      });
    }
    //============================================LABELS============================================//
    add(bom, __warning_inside, 3, "supply");
    add(bom, __warning_outside, 3, "supply");
    add(bom, __placard_manual, 3, "supply");
    let designLabel: Codes | null = null;
    let hazardCode = "";
    switch (enc.method) {
      case "NFPA 770 Class A/C":
        hazardCode = "A";
        designLabel = __vortex_spec_hazards;
        break;
      case "NFPA 770 Class B":
        hazardCode = "B";
        designLabel = __vortex_spec_hazards;
        break;
      case "FM Data Centers":
        hazardCode = "F";
        designLabel = __vortex_data_proc_pe;
        break;
    }
    add(bom, designLabel, 1, "supply");
    add(bom, __placard_rack, 1, "supply");
    const pc = buildPreEngSystemPartcodeFromConfig(project, sys);
    const formatted = pc?.formatted ?? "";

    out[sys.id] = {
      systemName: sys.name,
      bom,
      systemPartCode: formatted, // formatted “S-xxx-9PE-xxx-xxx-xx”
    };
  }
  return out;
}

export function collectEngineeredBOM(project: Project): EngineeredBomBySystem {
  const out: EngineeredBomBySystem = {};

  for (const sys of project.systems) {
    if (sys.type !== "engineered") continue;

    const bom: BomMap = new Map();

    // One-time per engineered system
    add(bom, __eng_iom_manual, 1, "supply");

    // Read estimates the calc layer should have produced
    const opts = sys.options as EngineeredOptions;
    const est = opts.estimates;
    const maxCyl = Math.max(
      0,
      ...sys.zones.map((z) => z.minTotalCylinders || 0)
    );

    // Supply-side items you already estimate
    add(bom, __pilot_primary_80L, est.primaryReleaseAssemblies, "supply");
    // NOTE: secondary PRI count needs max cylinders (see TODO below)
    add(
      bom,
      __pilot_secondary_80L,
      Math.max(0, maxCyl - est.primaryReleaseAssemblies),
      "supply"
    );
    add(bom, __x2_rack_hose, est.doubleStackedRackHose, "supply");
    add(bom, __adj_rack_hose, est.adjacentRackHose, "supply");

    if (opts.addOns.placardsAndSignage) {
      add(bom, __placard_rack, est.doubleStackedRackHose, "supply");
      if (opts.addOns.doorCount > 0) {
        add(bom, __placard_manual, opts.addOns.doorCount, "supply");
      }
    }
    if (opts.addOns.bulkRefillAdapter) {
      add(bom, __refill_bulk, 1, "supply");
    }
    if (opts.addOns.igsFlexibleHose48) {
      add(bom, __flexible_hose, 1, "supply");
    }
    add(bom, __tamper_resistance_kit, 1, "supply");

    // Per zone/enclosure
    let waterRates: number[] = [];
    for (const zone of sys.zones) {
      // Pull decisions made in calc layer
      const zAny = zone as any;
      const zPanel = zAny.panelSizing as
        | {
            bore: "1in" | "1.5in";
            capacity: 1800 | 4500;
            qty: number;
            style: "ar" | "dc";
          }
        | undefined;
      const zLabel =
        (zAny.designLabel as
          | "data_proc"
          | "comb_turb"
          | "spec_hazards"
          | undefined) ?? "spec_hazards";

      // Safety: if somehow panelSizing missing, fall back to 1" × 1
      const panelBore = zPanel?.bore ?? "1in";
      const panelStyle = zPanel?.style ?? opts.panelStyle; // default to system option if absent

      // Enclosures
      for (const enc of zone.enclosures) {
        let braidedQty = 0;

        // 1) Signage / placards

        if (enc.method === "FM Machine Spaces") {
          add(bom, __placard_int_zone, opts.addOns.doorCount, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });
          add(bom, __placard_ext_zone, opts.addOns.doorCount, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });
          braidedQty = enc.minEmitters ?? 0;
        } else {
          add(bom, __warning_inside, opts.addOns.doorCount, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });
          add(bom, __warning_outside, opts.addOns.doorCount, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });
          braidedQty = enc.minEmitters ?? 0;
        }
        if (enc.emitterStyle != "standard-pvdf") {
          add(bom, __braided_hose_36, braidedQty, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });
        }

        // 2) Emitters + flow cartridges
        const nozzle = enc.nozzleCode || "";
        const style = (enc.emitterStyle as any) || "escutcheon-stainless";
        const spec = resolveEmitterSpec(enc.method as any, nozzle, style);
        const nEmitters = enc.minEmitters ?? 0;

        if (spec && nEmitters > 0) {
          add(bom, spec.emitterPart, nEmitters, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });
          add(bom, spec.flowCartridge, nEmitters, {
            zoneId: zone.id,
            zoneName: zone.name,
            enclosureId: enc.id,
            enclosureName: enc.name,
          });

          // Relief valve rule: enclosure flow ≤ 150 SCFM
          if ((spec.q_n2 || 0) * nEmitters <= 150) {
            add(bom, __n2_relief_valve, 1, {
              zoneId: zone.id,
              zoneName: zone.name,
              enclosureId: enc.id,
              enclosureName: enc.name,
            });
          }

          // Track water peak across system
          waterRates.push((spec.q_water || 0) * nEmitters);
        } else {
          // still push 0 to keep waterRates defined
          waterRates.push(0);
        }
      }

      // 3) Panel + manifold kits + design label (use calc outputs)
      const panelPartcode =
        panelBore === "1in"
          ? panelStyle === "ar"
            ? __panel1_1500ar
            : __panel1_1500dc
          : panelStyle === "ar"
            ? __panel15_1500ar
            : __panel15_1500dc;

      const assemblyKit =
        panelBore === "1in" ? __manifold_1assembly : __manifold_15assembly;

      const panelQty = zPanel?.qty ?? 0;

      // and only add panel-related parts if panelQty > 0
      if (panelQty > 0) {
        add(bom, panelPartcode, panelQty, {
          zoneId: zone.id,
          zoneName: zone.name,
        });
        add(bom, assemblyKit, panelQty, {
          zoneId: zone.id,
          zoneName: zone.name,
        });

        const designLabelParts =
          zLabel === "data_proc"
            ? __vortex_data_proc
            : zLabel === "comb_turb"
              ? __vortex_comb_turb
              : __vortex_spec_hazards;

        add(bom, designLabelParts, panelQty, {
          zoneId: zone.id,
          zoneName: zone.name,
        });

        if (sys.options.addOns.expProofTransducer) {
          add(bom, __transducer_exp, panelQty, {
            zoneId: zone.id,
            zoneName: zone.name,
          });
        } else {
          add(bom, __transducer_nor, panelQty, {
            zoneId: zone.id,
            zoneName: zone.name,
          });
        }

        add(bom, __threaded_ball_valve, panelQty, {
          zoneId: zone.id,
          zoneName: zone.name,
        });
      }
    }

    // Choose tank regulator at system level based on peak water rate seen
    if (Math.max(...waterRates) <= 32) {
      add(bom, __tank_regulator_nor, 1, "supply");
    } else {
      add(bom, __tank_regulator_hc, 1, "supply");
    }
    // ─────────────────────────────────────────────────────────────
    // WATER TANK (system-level, EXACT cert, one per system)
    // Prefer the selection produced by the calc layer (opts.waterTankPick).
    // If absent, compute it here once using the exact cert + max zone requirement.
    // ─────────────────────────────────────────────────────────────
    const reqGal =
      Math.ceil(getTankReqFromOptions(opts)) ||
      Math.ceil(
        Math.max(
          0,
          ...sys.zones.map((z) => Number((z as any).waterTankMin_gal) || 0)
        )
      );

    const pickFromCalc = getTankPickFromOptions(opts);

    if (pickFromCalc) {
      add(bom, pickFromCalc, 1, "supply");
    } else {
      const cert = opts.waterTankCertification; // WaterTankCert | undefined
      if (cert && reqGal > 0) {
        const chosen = selectWaterTankStrict(cert, reqGal);
        if (chosen?.codes) add(bom, chosen.codes, 1, "supply");
      }
    }
    // ─────────────────────────────────────────────────────────────

    // Refill adapters, cylinders (system-level)

    if (opts.refillAdapter === "CGA-580")
      add(bom, __refill_cga580, maxCyl, "supply");
    if (opts.refillAdapter === "CGA-677")
      add(bom, __refill_cga677, maxCyl, "supply");

    const useFilledCyl = (project.currency ?? "USD") === "USD";
    add(
      bom,
      useFilledCyl ? __80L_cylinder_n2 : __80L_cylinder_n2_unfilled,
      maxCyl,
      "supply"
    );

    // Cylinder Storage
    let cylinderRackRange = maxCyl % 12;
    let rackSelection: Codes | null = null;
    let manifoldSelection: Codes | null = null;
    let plugCount = 0;

    if (maxCyl > 12) {
      add(bom, __cylinder_rack_9_12, Math.floor(maxCyl / 12), "supply");
      add(bom, __manifold_6x2, Math.floor(maxCyl / 12), "supply");
    }

    if (cylinderRackRange > 0 && cylinderRackRange <= 4) {
      rackSelection = __cylinder_rack_1_4;
      manifoldSelection = __manifold_2x2;
      plugCount = 4 - cylinderRackRange;
    } else if (cylinderRackRange > 4 && cylinderRackRange <= 8) {
      rackSelection = __cylinder_rack_5_8;
      manifoldSelection = __manifold_4x2;
      plugCount = 8 - cylinderRackRange;
    } else if (cylinderRackRange > 8 && cylinderRackRange <= 12) {
      rackSelection = __cylinder_rack_9_12;
      manifoldSelection = __manifold_6x2;
      plugCount = 12 - cylinderRackRange;
    }

    // Only add if a real selection was made
    if (rackSelection) add(bom, rackSelection, 1, "supply");
    if (manifoldSelection) add(bom, manifoldSelection, 1, "supply");
    if (plugCount > 0) add(bom, __manifold_plug, plugCount, "supply");

    // 6) TODO: Battery backup, transducers (use opts.estimates + addOns)
    if (est.batteryBackups > 0) {
      if (opts.powerSupply === "120") {
        add(bom, __backup_bat_115, est.batteryBackups, "supply");
      } else if (opts.powerSupply === "240") {
        add(bom, __backup_bat_220, est.batteryBackups, "supply");
      }
    }
    out[sys.id] = { systemName: sys.name, bom };
  }

  return out;
}

export function o2StringToDecimal(input: unknown): number | null {
  if (input == null) return null;
  let s = String(input).trim();

  // Common "no value" marks
  if (s === "" || /^[-–—]+$/.test(s)) return null;

  // Grab first numeric token (supports "20.95", "20,95", etc.)
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;

  let numStr = m[0];

  // If only comma present, treat as decimal separator; if both, drop commas as thousands
  if (numStr.includes(",") && !numStr.includes(".")) {
    numStr = numStr.replace(",", ".");
  } else if (numStr.includes(",") && numStr.includes(".")) {
    numStr = numStr.replace(/,/g, "");
  }

  const pct = Number(numStr);
  if (!Number.isFinite(pct)) return null;

  return pct / 100;
}

export function numberStringToValue(input: unknown): number | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (s === "" || /^[-–—]+$/.test(s)) return null;

  const m = s.match(/-?\d[\d.,]*/);
  if (!m) return null;
  let tok = m[0];

  const hasComma = tok.includes(",");
  const hasDot = tok.includes(".");

  const threeGroup = (sep: string) =>
    new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`).test(tok);

  if (hasComma && hasDot) {
    // Decide thousands vs decimal by which appears last.
    const lastComma = tok.lastIndexOf(",");
    const lastDot = tok.lastIndexOf(".");
    if (lastDot > lastComma) {
      // 1,234.56 -> commas thousands, dot decimal
      tok = tok.replace(/,/g, "");
    } else {
      // 1.234,56 -> dots thousands, comma decimal
      tok = tok.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (hasComma && !hasDot) {
    // Only commas present
    tok = threeGroup(",") ? tok.replace(/,/g, "") : tok.replace(/,/g, ".");
  } else if (hasDot && !hasComma) {
    // Only dots present
    tok = threeGroup(".") ? tok.replace(/\./g, "") : tok; // dot is decimal unless 3-grouped
  }
  const n = Number(tok);
  return Number.isFinite(n) ? n : null;
}
