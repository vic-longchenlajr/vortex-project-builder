// src/core/bom/excel.ts
import ExcelJS from "exceljs";
import type { Project, Currency } from "@/state/app-model";
import type { PriceIndex } from "./types";
import { collectBOM, collectFACP } from "./collect-project";
import {
  resolveEmitterSpec,
  getNozzleLabel,
} from "@/core/catalog/emitter.catalog";
import { calcACF } from "../calc/preengineered";

type BomLevel = "ENCLOSURE" | "ZONE_SUPPLY" | "SYSTEM_SUPPLY";

type BomLine = {
  description?: string;
  codes?: [string, string]; // [BPCS, M3]
  partCode?: string; // fallback
  partCodeM3?: string; // fallback
  qty: number;
  unitPrice?: number;
  level: BomLevel;
  scope: { systemId: string; zoneId?: string; enclosureId?: string };
};

type EnclosureInfo = {
  id: string;
  name: string;
  volume?: number;
  tempF?: number;
  method?: string;
  nozzle?: string;
  nozzleCode?: string;
  style?: string;
  minEmitters?: number;
  estDischarge?: string;
  estFinalO2?: string;
  minCylinders?: number;
};

type ZoneInfo = { id: string; name: string; enclosures: EnclosureInfo[] };
type SystemInfo = {
  id: string;
  name: string;
  type: "engineered" | "preengineered";
  zones: ZoneInfo[];
};

/* ─────────────────────────────────────────────────────────────
   Shaping helpers
   ───────────────────────────────────────────────────────────── */
function deriveSystemsFromProject(project: Project): SystemInfo[] {
  return (project.systems || []).map((s) => ({
    id: s.id,
    name: s.name || "System",
    type: s.type,
    zones: (s.zones || []).map((z) => ({
      id: z.id,
      name: z.name || "Zone",
      enclosures: (z.enclosures || []).map((e) => ({
        id: e.id,
        name: e.name || "Enclosure",
        volume: e.volume,
        tempF: e.tempF,
        method: e.method as any,
        nozzle: getNozzleLabel(e.method as any, e.nozzleCode as any),
        nozzleCode: (e as any).nozzleCode, // <-- keep raw code
        style: (e as any).emitterStyle as any,
        minEmitters: (e as any).minEmitters ?? (e as any).emitterCount,
        estDischarge: (e as any).estDischarge ?? (e as any).estimatedDischarge,
        estFinalO2: (e as any).estFinalO2 ?? (e as any).o2Final,
        minCylinders: (z as any).minTotalCylinders,
      })),
    })),
  }));
}

function makeOverviewRowsFromSystems(systems: SystemInfo[]) {
  const rows: Array<{
    systemType: string;
    systemName: string;
    zoneName: string;
    enclosureName: string;
    volume?: number;
    temp?: number;
    method?: string;
    nozzle?: string;
    style?: string;
    minEmitters?: number;
    estDischarge?: string;
    estFinalO2?: string;
    minCylinders?: number;
  }> = [];

  for (const sys of systems) {
    for (const z of sys.zones) {
      for (const e of z.enclosures) {
        rows.push({
          systemType:
            sys.type === "preengineered" ? "Pre-Engineered" : "Engineered",
          systemName: sys.name,
          zoneName: z.name,
          enclosureName: e.name,
          volume: e.volume,
          temp: e.tempF,
          method: e.method,
          nozzle: e.nozzle,
          style: e.style,
          minEmitters: e.minEmitters,
          estDischarge: e.estDischarge,
          estFinalO2: e.estFinalO2,
          minCylinders: e.minCylinders,
        });
      }
    }
  }
  return rows;
}

/* ─────────────────────────────────────────────────────────────
   Styling helpers (precise borders)
   ───────────────────────────────────────────────────────────── */
function setColWidthsForOverview(s0: ExcelJS.Worksheet) {
  // A..O
  s0.columns = [
    { header: "", key: "A", width: 20 }, // labels
    { header: "", key: "B", width: 30 }, // values
    { header: "", key: "C", width: 16 }, // System Type
    { header: "", key: "D", width: 16 }, // System Name
    { header: "", key: "E", width: 16 }, // Zone Name
    { header: "", key: "F", width: 14 }, // Min Cyl
    { header: "", key: "G", width: 15 }, // Enclosure Name
    { header: "", key: "H", width: 15 }, // Volume
    { header: "", key: "I", width: 13 }, // Temp
    { header: "", key: "J", width: 20 }, // Method
    { header: "", key: "K", width: 22 }, // Nozzle
    { header: "", key: "L", width: 20 }, // Style
    { header: "", key: "M", width: 13 }, // Min Emitters
    { header: "", key: "N", width: 18 }, // Est Discharge
    { header: "", key: "O", width: 12 }, // Est Final O2
  ];
}
function bold(cell: ExcelJS.Cell, text?: any) {
  if (text !== undefined) cell.value = text;
  cell.font = { ...(cell.font || {}), bold: true };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
}
function boldItalic(cell: ExcelJS.Cell, text?: any) {
  if (text !== undefined) cell.value = text;
  cell.font = { ...(cell.font || {}), bold: true, italic: true };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
}
function bottomLine(
  ws: ExcelJS.Worksheet,
  row: number,
  c1: number,
  c2: number,
  style: ExcelJS.BorderStyle = "thin"
) {
  for (let c = c1; c <= c2; c++) {
    const cell = ws.getCell(row, c);
    cell.border = { ...(cell.border || {}), bottom: { style } };
  }
}
function rightLine(
  ws: ExcelJS.Worksheet,
  col: number,
  r1: number,
  r2: number,
  style: ExcelJS.BorderStyle = "thin"
) {
  for (let r = r1; r <= r2; r++) {
    const cell = ws.getCell(r, col);
    cell.border = { ...(cell.border || {}), right: { style } };
  }
}

/* ─────────────────────────────────────────────────────────────
   Main builder
   ───────────────────────────────────────────────────────────── */
export async function buildWorkbookForProject(args: {
  project: Project;
  priceIndex: PriceIndex;
  options: { currency: Currency; multiplier: number };
}) {
  const { project, priceIndex, options } = args;

  // Systems + overview rows
  const systems = deriveSystemsFromProject(project);
  const overviewRows = makeOverviewRowsFromSystems(systems);

  const collected: any = collectBOM(project);
  const lines: BomLine[] = [];
  for (const sys of project.systems || []) {
    const entry = collected?.[sys.id]?.bom as Map<
      string,
      { partcode: string; alt?: string; qty: number; scope: any }
    >;
    if (!entry) continue;
    for (const v of entry.values()) {
      const codes: [string, string] = [
        v.partcode || "",
        v.alt || v.partcode || "",
      ];
      let level: BomLevel;
      let scope: BomLine["scope"];
      if (typeof v.scope === "string") {
        level = "SYSTEM_SUPPLY";
        scope = { systemId: sys.id };
      } else if (v.scope.enclosureId) {
        level = "ENCLOSURE";
        scope = {
          systemId: sys.id,
          zoneId: v.scope.zoneId,
          enclosureId: v.scope.enclosureId,
        };
      } else {
        level = "ZONE_SUPPLY";
        scope = { systemId: sys.id, zoneId: v.scope.zoneId };
      }
      lines.push({ description: "", codes, qty: v.qty || 0, level, scope });
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Victaulic Vortex Configurator";
  wb.created = new Date();

  const currencyFmt =
    options.currency === "USD"
      ? '"$"#,##0.00'
      : options.currency === "GBP"
        ? '"£"#,##0.00'
        : '"€"#,##0.00';

  // BPCS for USD, M3/alt for EUR/GBP
  const pluckCode = (ln: BomLine, currency: Currency) =>
    currency === "USD"
      ? (ln.codes?.[0] ?? (ln as any).partCode ?? (ln as any).partcode ?? "")
      : (ln.codes?.[1] ??
        (ln as any).partCodeM3 ??
        (ln as any).alt ??
        (ln as any).partcode ??
        "");

  // Keep this
  const priceFor = (code: string) => priceIndex[code]?.listPrice ?? 0;

  // New: choose the best code that actually exists in priceIndex.
  // Prefer currency-specific, but fall back to the other (or to any known alias).
  const bestPricedCodeFor = (ln: BomLine): string => {
    const c0 = ln.codes?.[0]; // BPCS
    const c1 = ln.codes?.[1]; // M3 / alt
    const aliases = [
      c0,
      c1,
      (ln as any).partCode,
      (ln as any).partCodeM3,
      (ln as any).partcode,
      (ln as any).alt,
    ].filter((x): x is string => !!x);

    // Currency preference first
    const preferred = (options.currency === "USD" ? [c0, c1] : [c1, c0]).filter(
      (x): x is string => !!x
    );
    for (const c of preferred) if (priceIndex[c]) return c;

    // Fallback: any alias that prices
    for (const c of aliases) if (priceIndex[c]) return c;

    return ""; // nothing priced
  };

  // Use bestPricedCodeFor for totals
  const listTotal = lines.reduce((sum, ln) => {
    const code = bestPricedCodeFor(ln);
    return sum + priceFor(code) * (ln.qty || 0);
  }, 0);

  const netTotal =
    listTotal * Math.min(1, Math.max(0, options.multiplier ?? 1));

  /* ─────────────────────────────────────────────────────────
     Overview sheet (left align + grouped display)
     ───────────────────────────────────────────────────────── */
  const s0 = wb.addWorksheet(`${project.name || "Untitled Project"} Overview`);
  setColWidthsForOverview(s0);

  // Section headers (bold/italic and LEFT)
  boldItalic(s0.getCell("A1"), "Pricing");
  boldItalic(s0.getCell("A6"), "Project Options");
  boldItalic(s0.getCell("C1"), "Project Summary");

  // Left labels (bold + LEFT)
  bold(s0.getCell("A2"), "System List Price");
  bold(s0.getCell("A3"), "System Net Price");
  bold(s0.getCell("A4"), "Multiplier");

  // Values (explicit LEFT alignment)
  s0.getCell("B2").value = listTotal;
  s0.getCell("B2").numFmt = currencyFmt;
  s0.getCell("B2").alignment = { horizontal: "left" };

  s0.getCell("B3").value = netTotal;
  s0.getCell("B3").numFmt = currencyFmt;
  s0.getCell("B3").alignment = { horizontal: "left" };

  s0.getCell("B4").value = Math.min(1, Math.max(0, options.multiplier ?? 1));
  s0.getCell("B4").alignment = { horizontal: "left" };

  const leftLabels: Array<[string, string, any]> = [
    ["A7", "Project", project.name || "Untitled Project"],
    ["A8", "Company Name", project.companyName || ""],
    [
      "A9",
      "Name",
      `${project.firstName || ""} ${project.lastName || ""}`.trim(),
    ],
    ["A10", "Phone Number", project.phone || ""],
    ["A11", "Email Address", project.email || ""],
    ["A12", "Location", project.projectLocation || ""],
    ["A13", "Date", new Date()],
    ["A14", "Elevation", project.elevation || "0FT/0KM"],
  ];
  for (const [addr, label, value] of leftLabels) {
    bold(s0.getCell(addr), label);
    const vcell = s0.getCell(addr.replace("A", "B"));
    vcell.value = value;
    vcell.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
  }

  // Header row for summary (LEFT aligned)
  const head = [
    "System Type",
    "System Name",
    "Zone Name",
    "Cylinders",
    "Enclosure Name",
    "Volume",
    "Temperature",
    "Design Method",
    "Nozzle Selection",
    "Style",
    "Emitters",
    "Est. Discharge Time",
    "Est. Final O2",
  ];
  const startRow = 2;
  const startCol = 3; // C
  head.forEach((h, i) => {
    const c = s0.getCell(startRow, startCol + i);
    c.value = h;
    c.font = { bold: true };
    c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  // Data rows (grouped display; left aligned)
  let rr = startRow + 1;
  for (let i = 0; i < overviewRows.length; i++) {
    const row = overviewRows[i];
    const prev = i > 0 ? overviewRows[i - 1] : null;

    const isFirstInSystem = !prev || prev.systemName !== row.systemName;
    const isFirstInZone =
      isFirstInSystem || !prev || prev.zoneName !== row.zoneName;

    const vals = [
      isFirstInSystem ? row.systemType : "", // C
      isFirstInSystem ? row.systemName : "", // D
      isFirstInZone ? row.zoneName : "", // E
      isFirstInZone ? (row.minCylinders ?? "") : "", // F
      row.enclosureName, // G
      row.volume ?? "", // H
      row.temp ?? "", // I
      row.method ?? "", // J
      row.nozzle ?? "", // K
      row.style ?? "", // L
      row.minEmitters ?? "", // M
      row.estDischarge ?? "", // N
      row.estFinalO2 ?? "", // O
    ];

    vals.forEach((v, j) => {
      const cell = s0.getCell(rr, startCol + j);
      cell.value = v as any;
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    });

    // Thin bottom across G..O each row
    bottomLine(s0, rr, 7, 15, "thin");
    rr++;
  }
  const dataStart = startRow + 1;
  const dataEnd = Math.max(dataStart, rr - 1);

  // Exact borders you specified earlier
  bottomLine(s0, 1, 1, 15, "thin"); // A1:O1
  bottomLine(s0, 6, 1, 2, "thin"); // A6:B6
  bottomLine(s0, 2, 3, 15, "thin"); // C2:O2
  bottomLine(s0, 14, 1, 2, "thin"); // A14:B14
  let sectionBorder = dataEnd;
  if (dataEnd < 14) {
    sectionBorder = 14;
  }

  rightLine(s0, 2, 1, sectionBorder, "thin"); // B1:B14
  rightLine(s0, 15, 2, dataEnd, "thin"); // O2:O(last)
  rightLine(s0, 4, 3, dataEnd, "thin"); // vertical rule @ D
  rightLine(s0, 6, 3, dataEnd, "thin"); // vertical rule @ F

  // Group boundaries (C–D at system, E–F at zone)
  for (let i = 0; i < overviewRows.length; i++) {
    const cur = overviewRows[i];
    const nxt = overviewRows[i + 1];
    const rowIdx = dataStart + i;

    const systemBoundary = !nxt || nxt.systemName !== cur.systemName;
    const zoneBoundary =
      !nxt ||
      nxt.systemName !== cur.systemName ||
      nxt.zoneName !== cur.zoneName;

    if (zoneBoundary) bottomLine(s0, rowIdx, 5, 6, "thin"); // E..F
    if (systemBoundary) bottomLine(s0, rowIdx, 3, 4, "thin"); // C..D
  }

  /* ─────────────────────────────────────────────────────────
   BOM sheets (nested rendering, no prices)
   ───────────────────────────────────────────────────────── */

  // currency-specific code (USD=BPCS, EUR/GBP=alt)
  const pluckCurrencyCode = (ln: BomLine) => pluckCode(ln, options.currency);
  const descFor = (code: string, fallback = "") =>
    priceIndex[code]?.description || fallback;

  type SimpleRow = { code: string; desc: string; qty: number };

  // consolidate by partcode
  function consolidateRows(data: BomLine[]): SimpleRow[] {
    const map = new Map<string, SimpleRow>();
    for (const ln of data) {
      const code = pluckCurrencyCode(ln);
      if (!code) continue;
      const prev = map.get(code);
      const qty = ln.qty || 0;
      if (prev) prev.qty += qty;
      else
        map.set(code, { code, desc: descFor(code, ln.description || ""), qty });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        (a.desc || "").localeCompare(b.desc || "") ||
        a.code.localeCompare(b.code)
    );
  }

  // column sets
  function setColsComplete(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { width: 18 }, // System Name
      { width: 18 }, // Category
      { width: 10 }, // Item #
      { width: 64 }, // Description
      { width: 12 }, // Qty
      { width: 20 }, // Partcode
    ];
  }
  function setColsEnclosure(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { width: 18 }, // System Name
      { width: 16 }, // Zone Name
      { width: 20 }, // Enclosure Name
      { width: 10 }, // Item #
      { width: 64 }, // Description
      { width: 12 }, // Qty
      { width: 20 }, // Partcode
    ];
  }

  // Choose your band thresholds (based on total water flow, gpm)
  type Band = "LOW" | "MID" | "HIGH";
  function pickBandForQwater(q: number): Band {
    if (q <= 500) return "LOW";
    if (q <= 1000) return "MID";
    return "HIGH";
  }

  // Compute total nitrogen flow for a system from emitter specs
  function computeSystemQn2Total(
    project: any,
    sys: SystemInfo,
    units: UnitCtx
  ): number {
    let v =
      units === "imperial"
        ? sys.zones[0].enclosures[0].volume
        : sys.zones[0].enclosures[0].volume * 35.3147;
    let t_0 = 294.4;
    let t =
      units === "imperial"
        ? (((sys.zones[0].enclosures[0].tempF ?? 70) - 32) * 5) / 9 + 273.15
        : sys.zones[0].enclosures[0].tempF + 273.15;
    let acf = calcACF(project.elevation, units);
    let h_hybrid = 0.375;
    let sf = 1.2;
    let w_n2_req = v * (t_0 / t) * acf * h_hybrid * sf;
    console.log(w_n2_req);
    console.log(sys.zones[0].enclosures[0].estDischarge);
    return (
      w_n2_req / parseNumberWithUnit(sys.zones[0].enclosures[0].estDischarge)
    );
  }

  function parseNumberWithUnit(
    label: string,
    unit: string = "min"
  ): number | null {
    if (!label) return null;
    const re = new RegExp(String.raw`(-?\d+(?:\.\d+)?)\s*${unit}\b`, "i");
    const m = label.match(re);
    return m ? parseFloat(m[1]) : null;
  }

  type UnitCtx = "imperial" | "metric";
  const U = (u: UnitCtx, imp: string, met: string) =>
    u === "metric" ? met : imp;

  // A tiny DSL for rows
  type ConstRow = { section: string; param: string; value: string };
  type BandedRow = {
    section: string;
    param: string;
    banded: { LOW: string; MID: string; HIGH: string };
  };
  type Row = ConstRow | BandedRow;

  // SINGLE-EMITTER rows (all constant)
  function singleEmitterRows(units: UnitCtx): ConstRow[] {
    return [
      {
        section: "Nitrogen Piping",
        param: "Pipe Size",
        value: "1 1/2-inch Sch. 10",
      },
      {
        section: "Nitrogen Piping",
        param:
          "Maximum Pipe Length from Victaulic Vortex™ Panel to Hybrid Emitter",
        value: U(units, "150 feet", "45.7 meters"),
      },
      {
        section: "Nitrogen Piping",
        param:
          "Minimum Pipe Length from Victaulic Vortex™ Panel to Hybrid Emitter",
        value: U(units, "20 feet", "6.1 meters"),
      },
      {
        section: "Nitrogen Piping",
        param: "Maximum Direction Changes",
        value: "10",
      },

      {
        section: "Water Piping",
        param: "Pipe Size for Elevation Changes of Less Than +/- 25 feet",
        value: "1-inch Sch. 10 or 40 (Type K)",
      },
      {
        section: "Water Piping",
        param: "Pipe Size for Elevation Changes of Greater Than +/- 25 feet",
        value: "3/4-inch Sch. 40 (Type K)",
      },

      {
        section: "Hybrid Emitter Drop",
        param: "Pipe Size",
        value: "1-inch Sch. 40",
      },
      {
        section: "Hybrid Emitter Drop",
        param:
          "Maximum Pipe Length from Nitrogen Piping Connection to Hybrid Emitter",
        value: U(units, "2 feet", "0.6 meters"),
      },
      {
        section: "Hybrid Emitter Drop",
        param: "Distance from Flow Cartridge to Hybrid Emitter",
        value: U(
          units,
          "The provided SS flex line is 36 inches in length",
          "The provided SS flex line is 914 millimeters in length"
        ),
      },
      {
        section: "Hybrid Emitter Drop",
        param:
          "Pipe Connection from 1-inch Nitrogen Drop to 3/4-inch FPT Hybrid Emitter Connection",
        value: U(
          units,
          "3/4-inch nipple shall not exceed 4 inches in length",
          "3/4-inch nipple shall not exceed 102 millimeters in length"
        ),
      },
    ];
  }

  /**
   * MULTI-EMITTER rows.
   * Only THREE rows below are banded — fill these with the correct values for LOW/MID/HIGH.
   * Everything else is constant and reused.
   */
  function multiEmitterRows(units: UnitCtx): Row[] {
    return [
      // (1) Banded: Nitrogen Feed Main Pipe Size
      {
        section: "Nitrogen Feed Main",
        param: "Pipe Size",
        banded: {
          LOW: "1 1/2-inch Sch. 10",
          MID: "2-inch Sch. 10",
          HIGH: "2 1/2-inch Sch. 10",
        },
      },
      {
        section: "Nitrogen Feed Main",
        param:
          "Maximum Pipe Length from Victaulic Vortex™ Panel to Cross Main",
        // constant across bands
        ...({ value: U(units, "150 feet", "45.7 meters") } as ConstRow),
      },
      {
        section: "Nitrogen Feed Main",
        param:
          "Minimum Pipe Length from Victaulic Vortex™ Panel to First Hybrid Emitter	",
        ...({ value: U(units, "20 feet", "6.1 meters") } as ConstRow),
      },
      {
        section: "Nitrogen Feed Main",
        param: "Maximum Direction Changes",
        value: "10",
      },

      {
        section: "Water Feed Main",
        param: "Pipe Size for Elevation Changes of Less Than +/- 25 feet",
        value: "1-inch Sch. 10 or 40 (Type K)",
      },
      {
        section: "Water Feed Main",
        param: "Pipe Size for Elevation Changes of Greater Than +/- 25 feet",
        value: "3/4-inch Sch. 40 (Type K)",
      },

      // (2) Banded: Nitrogen Cross Main Pipe Size
      {
        section: "Nitrogen Cross Main (Maximum of Four Branchlines)",
        param: "Pipe Size",
        banded: {
          LOW: "1 1/2-inch Sch. 10",
          MID: "2-inch Sch. 10",
          HIGH: "2 1/2-inch Sch. 10",
        },
      },
      {
        section: "Nitrogen Cross Main (Maximum of Four Branchlines)",
        param: "Maximum Direction Changes",
        value: "4",
      },
      {
        section: "Nitrogen Cross Main (Maximum of Four Branchlines)",
        param: "Maximum Distance Between Branchlines",
        value: U(
          units,
          "16 feet or Based on Maximum Hybrid Emitter Spacing",
          "4.9 meters or Based on Maximum Hybrid Emitter Spacing"
        ),
      },
      {
        section: "Nitrogen Cross Main (Maximum of Four Branchlines)",
        param: "Minimum Distance Between Branchlines",
        value: "Based on Minimum Hybrid Emitter Spacing",
      },

      // (3) Banded: Water Cross Main and Branchline Pipe Size
      {
        section: "Water Cross Main and Branchline",
        param: "Pipe Size",
        banded: {
          LOW: "3/4-inch Sch. 40 (Type K)",
          MID: "2-inch Sch. 40",
          HIGH: "2 1/2-inch Sch. 10",
        },
      },

      // The rest constant
      {
        section: "Nitrogen Branchlines (Maximum of Three Hybrid Emitter Drops)",
        param: "Pipe Size",
        value: "1 1/2-inch Sch. 40",
      },
      {
        section: "Nitrogen Branchlines (Maximum of Three Hybrid Emitter Drops)",
        param: "Maximum Direction Changes",
        value: "2",
      },
      {
        section: "Nitrogen Branchlines (Maximum of Three Hybrid Emitter Drops)",
        param: "Maximum Length to First Hybrid Emitter Drop",
        value: U(units, "24 feet", "7.3 meters"),
      },

      {
        section: "Hybrid Emitter Drops",
        param: "Pipe Size",
        value: "1-inch Sch. 40",
      },
      {
        section: "Hybrid Emitter Drops",
        param: "Maximum Length from Branchline Connections to Hybrid Emitter",
        value: U(units, "2 feet", "0.6 meters"),
      },
      {
        section: "Hybrid Emitter Drops",
        param: "Distance from Flow Cartridge to Hybrid Emitter",
        value: U(
          units,
          "The provided SS flex line is 36 inches in length",
          "The provided SS flex line is 914 millimeters in length"
        ),
      },
      {
        section: "Hybrid Emitter Drops",
        param:
          "Pipe Connection from 1-inch Nitrogen Drop to 3/4-inch FPT Hybrid Emitter Connection",
        value: U(
          units,
          "3/4-inch nipple shall not exceed 4 inches in length",
          "3/4-inch nipple shall not exceed 102 millimeters in length"
        ),
      },
    ];
  }

  // Turn the schema into printable rows for the chosen band
  function materializeMultiRows(units: UnitCtx, band: Band): ConstRow[] {
    const rows = multiEmitterRows(units);
    return rows.map((r) =>
      "banded" in r
        ? { section: r.section, param: r.param, value: r.banded[band] }
        : r
    );
  }

  // Write ONE sheet per pre-engineered system, table starts at column B.
  // A1 = "System Name" (bold), A2 = actual name.
  function writePipeGuidanceSheetForPreE(
    wb: ExcelJS.Workbook,
    sys: SystemInfo,
    units: UnitCtx
  ) {
    const ws = wb.addWorksheet(`${sys.name} - Pipe Guidance`);

    // Columns: A (label/name), B..D (table)
    ws.columns = [
      { width: 22 }, // A - System Name label/value
      { width: 26 }, // B - Pipe Runs
      { width: 62 }, // C - Pipe Parameters
      { width: 32 }, // D - Value
    ];

    // Decide if this block is single or multi (you can swap to your real flag)
    let emitters = 0;
    for (const z of sys.zones) {
      for (const e of z.enclosures) {
        emitters = Number((e as any).minEmitters ?? 0);
      }
    }
    const isMulti = emitters > 1;

    // Header in B1..D1
    const hdr = ws.addRow([
      "System Name",
      "Pipe Runs",
      "Pipe Parameters",
      "Value",
    ]);
    hdr.font = { bold: true };
    hdr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    bottomLine(ws, 1, 1, 4, "thin");
    ws.getCell("A2").value = sys.name;
    ws.getCell("A2").alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };

    // Rows start at row 2 (B2..D?)
    const rows: ConstRow[] = isMulti
      ? materializeMultiRows(
          units as UnitCtx,
          pickBandForQwater(
            computeSystemQn2Total(project, sys, units as UnitCtx)
          )
        )
      : singleEmitterRows(units as UnitCtx);

    let r = 2;
    let lastSection = ""; // ← only show first “Pipe Runs” value per grouping
    for (const row of rows) {
      const showSection = row.section !== lastSection ? row.section : "";
      ws.getCell(r, 2).value = showSection; // B: Pipe Runs
      ws.getCell(r, 3).value = row.param; // C: Parameter
      ws.getCell(r, 4).value = row.value; // D: Value

      // align + wrap
      for (let c = 2; c <= 4; c++) {
        ws.getCell(r, c).alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      }
      if (row.section !== lastSection) {
        bottomLine(ws, ws.lastRow!.number - 1, 2, 4, "thin");
      }
      lastSection = row.section;
      r++;
    }

    // draw a light box around B1..D(last)
    const lastRow = r - 1;
    bottomLine(ws, lastRow, 1, 4, "thin");
    rightLine(ws, 1, 2, lastRow, "thin");
    rightLine(ws, 4, 2, lastRow, "thin");
  }
  function writeNestedCompleteBOM(
    ws: ExcelJS.Worksheet,
    sysName: string,
    encRows: SimpleRow[], // NEW: consolidated enclosure-level parts
    zoneRows: SimpleRow[],
    sysSupply: SimpleRow[]
  ) {
    setColsComplete(ws);

    // Header
    const hdr = ws.addRow([
      "System Name",
      "Category",
      "Item #",
      "Description",
      "Quantity",
      "Partcode",
    ]);
    hdr.font = { bold: true };
    hdr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    bottomLine(ws, 1, 1, 6, "thin");

    const firstData = ws.lastRow!.number + 1;
    let itemNo = 1;
    let printedSystem = false; // ← print system name only once overall

    // Write one grouped section; draw a thin separator under the group
    const writeGroup = (groupName: string, rows: SimpleRow[]) => {
      if (!rows.length) return;
      rows.forEach((r, i) => {
        ws.addRow([
          printedSystem ? "" : sysName, // only once overall
          i === 0 ? groupName : "", // once per group
          itemNo++,
          r.desc,
          r.qty,
          r.code,
        ]);
        printedSystem = true;
      });
      // separator under the group (Category..Partcode)
      bottomLine(ws, ws.lastRow!.number, 2, 6, "thin");
    };

    // Order: Enclosure → Zone → System (system last)
    writeGroup("Enclosure Supply", encRows);
    writeGroup("Zone Supply", zoneRows);
    writeGroup("System Supply", sysSupply);

    // outer frame / vertical guides (System, Category, right edge)
    const last = ws.lastRow!.number;
    bottomLine(ws, last, 1, 6, "thin");
    rightLine(ws, 1, firstData, last, "thin");
    rightLine(ws, 6, firstData, last, "thin");
  }

  // nested writer for Enclosure BOMs
  function writeNestedEnclosureBOMs(
    ws: ExcelJS.Worksheet,
    sysName: string,
    zones: ZoneInfo[],
    fetchEnclosureLines: (zoneId: string, encId: string) => BomLine[],
    fetchZoneSupplyLines: (zoneId: string) => BomLine[],
    fetchSystemSupplyLines: () => BomLine[]
  ) {
    setColsEnclosure(ws);
    const hdr = ws.addRow([
      "System Name",
      "Zone Name",
      "Enclosure Name",
      "Item #",
      "Description",
      "Quantity",
      "Partcode",
    ]);
    hdr.font = { bold: true };
    hdr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    bottomLine(ws, 1, 1, 7, "thin");

    let itemNo = 1;
    let printedSystem = false; // ← print system name only once
    let nSysSupply = 0;

    for (const z of zones) {
      let printedZone = false; // ← print zone name once per zone

      // Track whether anything printed for this zone (to draw a zone separator)
      const zoneStartRow = ws.lastRow!.number + 1;

      for (const e of z.enclosures) {
        const encLines = fetchEnclosureLines(z.id, e.id);
        if (!encLines.length) continue;

        const rows = consolidateRows(encLines);

        rows.forEach((r, i) => {
          ws.addRow([
            // system name: only once on the very first printed row
            printedSystem ? "" : sysName,
            // zone name: only once per zone, on the first printed row of that zone
            printedZone ? "" : z.name,
            // enclosure name: once per enclosure (first row of that enclosure)
            i === 0 ? e.name : "",
            itemNo++,
            r.desc,
            r.qty,
            r.code,
          ]);

          // once we've printed a row, flip these guards
          printedSystem = true;
          printedZone = true;
        });
        bottomLine(ws, ws.lastRow!.number, 3, 7, "thin");
      }
      // ---- PSEUDO-ENCLOSURE: Zone Supply (rendered like an extra enclosure)
      const zSupplyLines = fetchZoneSupplyLines(z.id);
      if (zSupplyLines.length) {
        const rows = consolidateRows(zSupplyLines);

        rows.forEach((r, i) => {
          ws.addRow([
            // print system name only once on first row ever
            printedSystem ? "" : sysName,
            // print zone name only once per zone (first printed row in this zone)
            printedZone ? "" : z.name,
            // pseudo-enclosure name once on the first line of this pseudo block
            i === 0 ? "Zone Supply" : "",
            itemNo++,
            r.desc,
            r.qty,
            r.code,
          ]);
          printedSystem = true;
          printedZone = true;
        });

        // thin separator under the pseudo-enclosure (cols 3..7)
        bottomLine(ws, ws.lastRow!.number, 3, 7, "thin");
      }

      bottomLine(ws, ws.lastRow!.number, 2, 7, "thin");
    }
    const sysSupplyLines = fetchSystemSupplyLines();
    if (sysSupplyLines.length) {
      const rows = consolidateRows(sysSupplyLines);

      rows.forEach((r, i) => {
        ws.addRow([
          // system name: only once overall
          printedSystem ? "" : sysName,
          // zone column empty (system-scope)
          i === 0 ? "System Supply" : "",
          "",
          // pseudo-enclosure name
          itemNo++,
          r.desc,
          r.qty,
          r.code,
        ]);
        printedSystem = true;
        nSysSupply++;
      });

      // thin separator under the pseudo-enclosure (cols 3..7)
      bottomLine(ws, ws.lastRow!.number, 3, 7, "thin");
    }

    bottomLine(ws, ws.lastRow!.number, 1, 7, "thin");

    // vertical guides for System/Zone/Partcode columns
    rightLine(ws, 1, 2, ws.lastRow!.number, "thin");
    rightLine(ws, 2, 2, ws.lastRow!.number - nSysSupply, "thin");
    rightLine(ws, 7, 2, ws.lastRow!.number, "thin");
  }

  for (const sys of systems) {
    // collect all lines for this system
    const sysLines = lines.filter((ln) => ln.scope.systemId === sys.id);

    const systemSupply = sysLines.filter((ln) => ln.level === "SYSTEM_SUPPLY");
    const zoneSupplyOnly = sysLines.filter((ln) => ln.level === "ZONE_SUPPLY");
    const enclosureOnly = sysLines.filter((ln) => ln.level === "ENCLOSURE");

    const sysSupplyRows = consolidateRows(systemSupply);
    const zoneSupplyRows = consolidateRows(zoneSupplyOnly);
    const encSupplyRows = consolidateRows(enclosureOnly);

    if (sys.type === "preengineered") {
      // PRE-ENGINEERED: single sheet, just Enclosure + System (no Zone, no Detailed sheet)
      if (encSupplyRows.length || sysSupplyRows.length) {
        const wsAll = wb.addWorksheet(`${sys.name} - Consolidated BOM`);
        // Pass an empty array for Zone Supply so only two groups render
        writeNestedCompleteBOM(
          wsAll,
          sys.name,
          encSupplyRows,
          [],
          sysSupplyRows
        );
      }
      continue; // skip the detailed sheet for pre-E
    }

    // ENGINEERED: keep your existing two-sheet behavior
    if (encSupplyRows.length || zoneSupplyRows.length || sysSupplyRows.length) {
      const wsAll = wb.addWorksheet(`${sys.name} - Consolidated BOM`);
      writeNestedCompleteBOM(
        wsAll,
        sys.name,
        encSupplyRows,
        zoneSupplyRows,
        sysSupplyRows
      );
    }

    const wsEnc = wb.addWorksheet(`${sys.name} - Detailed BOM`);
    writeNestedEnclosureBOMs(
      wsEnc,
      sys.name,
      sys.zones,
      (zoneId, encId) =>
        sysLines.filter(
          (ln) =>
            ln.level === "ENCLOSURE" &&
            ln.scope.zoneId === zoneId &&
            ln.scope.enclosureId === encId
        ),
      (zoneId) =>
        sysLines.filter(
          (ln) => ln.level === "ZONE_SUPPLY" && ln.scope.zoneId === zoneId
        ),
      () => sysLines.filter((ln) => ln.level === "SYSTEM_SUPPLY")
    );
  }

  for (const sys of systems) {
    if (sys.type !== "preengineered") continue; // only pre-E
    writePipeGuidanceSheetForPreE(
      wb,
      sys,
      (project.units ?? "imperial") as UnitCtx
    );
  }

  /* ─────────────────────────────────────────────────────────
   FACP sheet (grouped by system, boxed per component)
   ───────────────────────────────────────────────────────── */

  const facpBySystem = collectFACP(project);
  const sF = wb.addWorksheet("FACP Monitor & Release Points");

  // Main table columns (A..E)
  sF.columns = [
    { header: "System Name", width: 18 }, // A
    { header: "Name of Component", width: 60 }, // B
    { header: "Type of Point", width: 26 }, // C
    { header: "Point Description", width: 40 }, // D
    { header: "Quantity", width: 12 }, // E
  ];

  // Header row
  sF.getRow(1).values = sF.columns.map((c) =>
    typeof c.header === "string" ? c.header : ""
  );
  sF.getRow(1).font = { bold: true };
  sF.getRow(1).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };

  // local border helpers for this sheet
  const topLine = (
    row: number,
    c1: number,
    c2: number,
    style: ExcelJS.BorderStyle = "thin"
  ) => {
    for (let c = c1; c <= c2; c++) {
      const cell = sF.getCell(row, c);
      cell.border = { ...(cell.border || {}), top: { style } };
    }
  };
  const leftLineLocal = (
    col: number,
    r1: number,
    r2: number,
    style: ExcelJS.BorderStyle = "thin"
  ) => {
    for (let r = r1; r <= r2; r++) {
      const cell = sF.getCell(r, col);
      cell.border = { ...(cell.border || {}), left: { style } };
    }
  };
  const outlineComponentBlock = (
    r1: number,
    r2: number,
    extendTopToA: boolean,
    extendBottomToA: boolean
  ) => {
    // Top border: include A only on the first row of a system section
    if (extendTopToA) topLine(r1, 1, 5, "thin");
    else topLine(r1, 2, 5, "thin");

    // Bottom border: include A only for the last component of the last system
    if (extendBottomToA) bottomLine(sF, r2, 1, 5, "thin");
    else bottomLine(sF, r2, 2, 5, "thin");

    leftLineLocal(2, r1, r2, "thin");
    rightLine(sF, 5, r1, r2, "thin");
  };
  const codeForDisplay = (partcode: string, alt?: string) =>
    options.currency === "USD" ? partcode : alt || partcode;

  let projSup = 0,
    projAlm = 0,
    projRel = 0;
  let row = 2;

  /* Right-side totals table (G..J) */
  const tStartCol = 7; // G
  ["System Name", "Supervisory", "Alarm", "Releasing"].forEach((h, i) => {
    const cell = sF.getCell(1, tStartCol + i);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });
  sF.getColumn(tStartCol + 0).width = 18;
  sF.getColumn(tStartCol + 1).width = 12;
  sF.getColumn(tStartCol + 2).width = 10;
  sF.getColumn(tStartCol + 3).width = 12;

  let totalsLastRow = 1;
  const printableSystems = systems.filter((s) => {
    const b = facpBySystem[s.id];
    return b && b.rows.length;
  });
  for (let sIdx = 0; sIdx < printableSystems.length; sIdx++) {
    const sys = printableSystems[sIdx];
    const block = facpBySystem[sys.id]!;
    const isLastSystem = sIdx === printableSystems.length - 1;

    let isFirstRowOfSystem = true;

    for (let compIdx = 0; compIdx < block.rows.length; compIdx++) {
      const r = block.rows[compIdx];
      const dispCode = codeForDisplay(r.partcode, r.alt);
      const compName = descFor(dispCode, "");
      const rStart = row;

      // show system name only on the very first printed row of this system
      const extendTopToAFlag = isFirstRowOfSystem;

      r.points.forEach((pt, idx) => {
        const first = idx === 0;
        const showSystemName = isFirstRowOfSystem;
        sF.addRow([
          showSystemName ? block.systemName : "",
          first ? compName : "",
          pt.type,
          pt.description,
          r.qty,
        ]).alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };

        if (showSystemName) isFirstRowOfSystem = false;
        row++;
      });

      const rEnd = row - 1;
      const isLastComponentInSystem = compIdx === block.rows.length - 1;

      // extend bottom to A..E only for *final component of the final system*
      outlineComponentBlock(
        rStart,
        rEnd,
        extendTopToAFlag,
        isLastSystem && isLastComponentInSystem
      );
    }

    // Totals table row for this system
    totalsLastRow++;
    const rTot = totalsLastRow;
    for (let c = 0; c < 4; c++) {
      const cell = sF.getCell(rTot, tStartCol + c);
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      }; // force LEFT for counts too
    }
    sF.getCell(rTot, tStartCol + 0).value = block.systemName;
    sF.getCell(rTot, tStartCol + 1).value = block.totals.supervisory;
    sF.getCell(rTot, tStartCol + 2).value = block.totals.alarm;
    sF.getCell(rTot, tStartCol + 3).value = block.totals.releasing;

    projSup += block.totals.supervisory;
    projAlm += block.totals.alarm;
    projRel += block.totals.releasing;
  }

  // Project totals row + box around the side table
  if (totalsLastRow >= 1) {
    totalsLastRow++;
    for (let c = 0; c < 4; c++) {
      const cell = sF.getCell(totalsLastRow, tStartCol + c);
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }
    sF.getCell(totalsLastRow, tStartCol + 0).value = "Totals";
    sF.getCell(totalsLastRow, tStartCol + 0).font = { bold: true };
    sF.getCell(totalsLastRow, tStartCol + 1).value = projSup;
    sF.getCell(totalsLastRow, tStartCol + 2).value = projAlm;
    sF.getCell(totalsLastRow, tStartCol + 3).value = projRel;

    // Box the G1:J<last> region
    topLine(1, tStartCol, tStartCol + 3, "thin");
    bottomLine(sF, totalsLastRow, tStartCol, tStartCol + 3, "thin");
    leftLineLocal(tStartCol, 2, totalsLastRow, "thin");
    rightLine(sF, tStartCol + 3, 2, totalsLastRow, "thin");
    // header baseline
    bottomLine(sF, 1, tStartCol, tStartCol + 3, "thin");
  }
  return wb;
}
