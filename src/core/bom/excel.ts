// src/core/bom/excel.ts
import ExcelJS from "exceljs";
import type { Project, System, Zone, Currency } from "@/state/app-model";
import type { PrimariesPlan, EngineeredOptions } from "@/state/app-model";
import type { PriceIndex } from "./types";
import { collectBOM, collectFACP } from "./collect-project";
import { getNozzleLabel } from "@/core/catalog/emitter.catalog";
import { calcACF } from "../calc/preengineered";
import {
  computePreEngGuidance,
  fmtFt2AndM2,
} from "../calc/preengineered/guidance";

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
  temperatureF?: number;
  designMethod?: string;
  nozzleLabel?: string;
  nozzleModel?: string;
  nozzleOrientation?: string;
  requiredNozzleCount?: number;
  estimatedDischargeDuration?: string;
  estimatedFinalOxygenPercent?: string;
  requiredCylinderCount?: number;
  notes?: string;
};

type ZoneInfo = { id: string; name: string; enclosures: EnclosureInfo[] };
type SystemInfo = {
  id: string;
  name: string;
  sheetName: string;
  type: "engineered" | "preengineered";
  zones: ZoneInfo[];
};

function formatNozzleStyle(style: string) {
  if (style == "standard-pvdf") return "Standard, PVDF";
  if (style == "escutcheon-stainless") return "Escutcheon, Stainless";
  if (style == "standard-stainless") return "Standard, Stainless";
  if (style == "standard-brass") return "Standard, Brass";
  return "";
}

function asEng(sys: System): EngineeredOptions | null {
  return sys.options?.kind === "engineered"
    ? (sys.options as EngineeredOptions)
    : null;
}

type PrimariesSkipCode = 1 | -1 | -2 | -3;

function shouldSkipPrimariesForSystem(sys: System): PrimariesSkipCode {
  // Only engineered systems can have primaries
  if (sys.type !== "engineered") return -1;

  const opts = asEng(sys);
  if (!opts) return -1;

  // bulk tubes → no primaries for this system
  if (opts.usesBulkTubes) return -2;

  // primary release assemblies overridden by user → skip primaries plan output
  const praOverridden = !!opts.estimateOverrides?.primaryReleaseAssemblies;
  // (optional) ensure a value exists; mostly redundant because estimates always exist in defaults
  const praHasValue =
    typeof opts.estimates?.primaryReleaseAssemblies === "number";

  if (praOverridden && praHasValue) return -3;

  return 1;
}
function primariesSkipReason(code: PrimariesSkipCode): any {
  switch (code) {
    case -3:
      return "Modified 'Primary Release Assemblies' output";
    case -2:
      return "Bulk Tube configuration selected";
    case -1:
      return -1;
    default:
      return "Calculations not available for this system";
  }
}
function compress24Banks(
  banks: Array<{ bankIndex: number; size: number }>,
): Array<{ label: string; size: number }> {
  const sorted = [...banks].sort((a, b) => a.bankIndex - b.bankIndex);
  const out: Array<{ label: string; size: number }> = [];
  let i = 0;

  while (i < sorted.length) {
    const cur = sorted[i];
    const idx = Number(cur.bankIndex) || 0;
    const size = Number(cur.size) || 0;

    if (size === 24) {
      let start = idx;
      let end = idx;
      let j = i + 1;
      while (
        j < sorted.length &&
        Number(sorted[j].size) === 24 &&
        Number(sorted[j].bankIndex) === end + 1
      ) {
        end = Number(sorted[j].bankIndex);
        j++;
      }
      out.push({
        label: start === end ? `${start}` : `${start}–${end}`,
        size: 24,
      });
      i = j;
      continue;
    }

    out.push({ label: `${idx}`, size });
    i++;
  }

  return out;
}

function buildSizeByIndex(
  banks: Array<{ bankIndex: number; size: number }>,
): Map<number, number> {
  const m = new Map<number, number>();
  for (const b of banks) m.set(Number(b.bankIndex), Number(b.size) || 0);
  return m;
}

function bankSummaryFromIndices(
  indices: number[],
  sizeByIndex: Map<number, number>,
): string {
  const counts = new Map<number, number>();
  for (const bi of indices) {
    const s = sizeByIndex.get(bi) ?? 0;
    if (!s) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([size, ct]) => `${ct}x${size}`)
    .join(", ");
}

function sumCyl(indices: number[], sizeByIndex: Map<number, number>): number {
  let t = 0;
  for (const bi of indices) t += sizeByIndex.get(bi) ?? 0;
  return t;
}

function rgLabel(i: number): string {
  return `RG-${String(i + 1).padStart(2, "0")}`;
}

function groupReleaseGroups(plan: PrimariesPlan): Array<{
  bankIndices: number[];
  zones: Array<{ zoneId: string; zoneName: string; requiredCyl: number }>;
}> {
  // You said: “a release group can include one or more zones”
  // Your current plan is 1 RG row per zone.
  // We'll GROUP rows that have the same bankIndices signature.
  const bySig = new Map<string, { bankIndices: number[]; zones: any[] }>();

  for (const rg of plan.releaseGroups || []) {
    const bi = (rg.bankIndices || []).slice().sort((a, b) => a - b);
    const sig = bi.join(",");

    const entry = bySig.get(sig) ?? { bankIndices: bi, zones: [] };
    entry.zones.push({
      zoneId: rg.zoneId,
      zoneName: rg.zoneName,
      requiredCyl: rg.requiredCyl,
    });
    bySig.set(sig, entry);
  }

  // Deterministic ordering: sort by total cylinders served (desc), then by signature
  const arr = Array.from(bySig.values());
  arr.sort((a, b) => {
    const al = a.bankIndices.length;
    const bl = b.bankIndices.length;
    if (al !== bl) return bl - al;
    return a.bankIndices.join(",").localeCompare(b.bankIndices.join(","));
  });
  return arr;
}

export function writeProjectPrimariesSheet(
  wb: ExcelJS.Workbook,
  project: Project,
) {
  const sysStatuses = (project.systems || []).map((s) => ({
    sys: s,
    code: shouldSkipPrimariesForSystem(s),
  }));

  const eligibleSystems = sysStatuses
    .filter((x) => x.code === 1)
    .map((x) => x.sys);

  const skippedSystems = sysStatuses
    .filter((x) => x.code !== 1)
    .map((x) => ({ sys: x.sys, code: x.code }));

  const anyEligiblePlan = eligibleSystems.some(
    (s) => asEng(s)?.primariesPlan?.banks?.length,
  );

  const shouldWriteSheet = anyEligiblePlan || skippedSystems.length > 0;
  if (!shouldWriteSheet) return;

  const ws = wb.addWorksheet(makeExcelSheetName(project.name, "Primaries"));

  // Column layout (matches your mock)
  // A: System Name
  // B: # Primaries
  // C: Release Group
  // D: Banks
  // E: Bank Summary
  // F: Total Cylinders
  // G: Zones Served
  // H: spacer
  // I: Bank #
  // J: Size (Cyl)
  ws.columns = [
    { key: "A", width: 30 },
    { key: "B", width: 20 },
    { key: "C", width: 16 },
    { key: "D", width: 32 },
    { key: "E", width: 32 },
    { key: "F", width: 16 },
    { key: "G", width: 32 },
    { key: "H", width: 2 },
    { key: "I", width: 9 },
    { key: "J", width: 9 },
  ];

  ws.getColumn(4).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  }; // D: Banks
  ws.getColumn(5).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  }; // E: Bank Summary
  ws.getColumn(7).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  }; // G: Zones Served

  let row = 1;

  const writeHeaders = (r: number) => {
    ws.getCell(`A${r}`).value = "System Name";
    ws.getCell(`B${r}`).value = "Number of Primaries";
    ws.getCell(`C${r}`).value = "Release Group";
    ws.getCell(`D${r}`).value = "Banks";
    ws.getCell(`E${r}`).value = "Bank Summary";
    ws.getCell(`F${r}`).value = "Total Cylinders";
    ws.getCell(`G${r}`).value = "Zones Served";

    ws.getCell(`I${r}`).value = "Bank #";
    ws.getCell(`J${r}`).value = "Size (Cyl)";

    for (const addr of [
      `A${r}`,
      `B${r}`,
      `C${r}`,
      `D${r}`,
      `E${r}`,
      `F${r}`,
      `G${r}`,
      `I${r}`,
      `J${r}`,
    ]) {
      ws.getCell(addr).font = { bold: true };
      // Header text should wrap if needed
      ws.getCell(addr).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }

    // underline (bottom border) on header across columns A..G (skip H)
    bottomLine(ws, r, 1, 7, "thin");
  };

  for (const sys of eligibleSystems) {
    const plan = asEng(sys)?.primariesPlan;

    // Skip systems without a plan
    if (!plan?.banks?.length) continue;

    // --- headers ---
    writeHeaders(row);

    // --- existing rendering logic unchanged ---
    const sizeByIndex = buildSizeByIndex(plan.banks);
    const rgGroups = groupReleaseGroups(plan);

    const leftStartRow = row + 1;

    rgGroups.forEach((g, i) => {
      const r = leftStartRow + i;

      if (i === 0) {
        ws.getCell(`A${r}`).value = sys.name || "";
        ws.getCell(`B${r}`).value = plan.primariesUsed ?? "";
      }

      ws.getCell(`C${r}`).value = rgLabel(i);
      ws.getCell(`D${r}`).value = g.bankIndices.join(", ");
      ws.getCell(`E${r}`).value = bankSummaryFromIndices(
        g.bankIndices,
        sizeByIndex,
      );
      ws.getCell(`F${r}`).value = sumCyl(g.bankIndices, sizeByIndex);
      ws.getCell(`G${r}`).value = g.zones
        .map((z) => z.zoneName || z.zoneId)
        .join(", ");

      bottomLine(ws, r, 3, 7, "thin");
      leftLine(ws, 3, r, r, "thin");
      rightLine(ws, 7, r, r, "thin");
    });

    const leftEndRow = leftStartRow + rgGroups.length - 1;

    const bankRows = compress24Banks(plan.banks);
    const rightStartRow = row + 1;

    bankRows.forEach((b, i) => {
      const r = rightStartRow + i;
      ws.getCell(`I${r}`).value = b.label;
      ws.getCell(`J${r}`).value = b.size;
      ws.getCell(`I${r}`).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      ws.getCell(`J${r}`).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });

    const rightEndRow = rightStartRow + bankRows.length - 1;

    if (bankRows.length > 0) {
      bottomLine(ws, rightStartRow - 1, 9, 10, "thin");
      bottomLine(ws, rightEndRow, 9, 10, "thin");
      rightLine(ws, 8, rightStartRow, rightEndRow, "thin");
      rightLine(ws, 10, rightStartRow, rightEndRow, "thin");
    }

    mergeVertical(ws, 1, leftStartRow, leftEndRow, {
      horizontal: "center",
      vertical: "middle",
    });
    mergeVertical(ws, 2, leftStartRow, leftEndRow, {
      horizontal: "center",
      vertical: "middle",
    });

    leftLine(ws, 3, row + 1, leftEndRow, "thin");
    bottomLine(ws, leftEndRow, 1, 2, "thin");

    row = Math.max(leftEndRow, rightEndRow) + 2;
  }
  if (skippedSystems.length) {
    // Ensure at least one blank row before notes (you already +2 between systems,
    // but this makes it robust if no eligible systems printed anything)
    // row += 1;

    for (const { sys, code } of skippedSystems) {
      const reason = primariesSkipReason(code as any);
      let msg = "";
      if (reason == -1) {
        msg = `${sys.name || "System"} only requires 1 primary (Pre-Engineered)`;
      } else {
        msg = `${sys.name || "System"} primaries overridden by user (${reason})`;
      }

      const r = row;
      ws.getCell(r, 1).value = msg;
      ws.getCell(r, 1).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };

      // Merge A..J (1..10)
      mergeBlock(ws, r, 1, r, 10, {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      });

      boxRange(ws, r, 1, r, 10);

      // Optional styling to make it read like a callout
      ws.getCell(r, 1).font = { italic: true };

      row = r + 2; // skip one line after each message
    }
  }
}

/**
 * Builds an Excel-safe worksheet name (<= 31 chars).
 * Shrinks the BASE first, then the TITLE if still needed.
 */
export function makeExcelSheetName(
  base: string,
  title: string,
  options?: {
    maxLen?: number;
    separator?: string;
  },
): string {
  const MAX = options?.maxLen ?? 31;
  const SEP = options?.separator ?? " - ";

  const clean = (s: string) => s.replace(/[\[\]\*\?:\/\\]/g, "").trim();

  let b = clean(base);
  let t = clean(title);

  const fullLen = () => b.length + SEP.length + t.length;

  // Helper: cut from the middle and insert "..."
  const shrinkMiddle = (s: string, remove: number): string => {
    if (remove <= 0 || s.length <= 3) return s;
    const keep = s.length - remove - 3;
    if (keep <= 1) return s.slice(0, 1) + "...";

    const left = Math.ceil(keep / 2);
    const right = Math.floor(keep / 2);
    return s.slice(0, left) + "..." + s.slice(s.length - right);
  };

  // 1️⃣ Shrink BASE first
  if (fullLen() > MAX) {
    const excess = fullLen() - MAX;
    b = shrinkMiddle(b, excess);
  }

  // 2️⃣ Shrink TITLE only if still too long
  if (fullLen() > MAX) {
    const excess = fullLen() - MAX;
    t = shrinkMiddle(t, excess);
  }

  // 3️⃣ Final fallback (absolute safety)
  let result = `${b}${SEP}${t}`;
  if (result.length > MAX) {
    result = result.slice(0, MAX);
  }

  return result;
}
type OverviewPrintRow = {
  systemType: string;
  systemName: string;
  zoneName: string;
  requiredCylinderCount?: number;
  enclosureName: string;
  volume?: number;
  temperatureF?: number;
  designMethod?: string;
  nozzleLabel?: string;
  nozzleOrientation?: string;
  requiredNozzleCount?: number;
  estimatedDischargeDuration?: string;
  estimatedFinalOxygenPercent?: string;
  notes?: string;
};

function buildOverviewRowsBySystem(systems: SystemInfo[]): Array<{
  systemId: string;
  systemType: string;
  systemName: string;
  zones: Array<{
    zoneId: string;
    zoneName: string;
    requiredCylinderCount?: number;
    rows: OverviewPrintRow[];
  }>;
}> {
  const out: any[] = [];

  for (const sys of systems) {
    const sysType =
      sys.type === "preengineered" ? "Pre-Engineered" : "Engineered";

    const sysBlock = {
      systemId: sys.id,
      systemType: sysType,
      systemName: sys.name,
      zones: [] as any[],
    };

    for (const z of sys.zones) {
      const zoneBlock = {
        zoneId: z.id,
        zoneName: z.name,
        // NOTE: you currently store requiredCylinderCount on EnclosureInfo via zone.
        // If you want true per-zone cylinders, consider putting it on ZoneInfo directly.
        requiredCylinderCount: z.enclosures?.[0]?.requiredCylinderCount,
        rows: [] as OverviewPrintRow[],
      };

      for (const e of z.enclosures) {
        zoneBlock.rows.push({
          systemType: sysType,
          systemName: sys.name,
          zoneName: z.name,
          requiredCylinderCount: (e as any).requiredCylinderCount,
          enclosureName: e.name,
          volume: e.volume,
          temperatureF: e.temperatureF,
          designMethod: e.designMethod,
          nozzleLabel: e.nozzleLabel,
          nozzleOrientation: e.nozzleOrientation,
          requiredNozzleCount: e.requiredNozzleCount,
          estimatedDischargeDuration: e.estimatedDischargeDuration,
          estimatedFinalOxygenPercent: e.estimatedFinalOxygenPercent,
          notes: e.notes,
        });
      }

      if (zoneBlock.rows.length) sysBlock.zones.push(zoneBlock);
    }

    // Only include systems that actually have enclosure rows
    const totalRows = sysBlock.zones.reduce(
      (t: number, z: any) => t + z.rows.length,
      0,
    );
    if (totalRows) out.push(sysBlock);
  }

  return out;
}
function writeSummaryHeaderRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  startCol: number,
) {
  const head = [
    "System Type",
    "System Name / Partcode",
    "Zone Name",
    "Cylinders",
    "Enclosure Name",
    "Volume",
    "Temperature",
    "Design Method",
    "Nozzle Selection",
    "Style",
    "Nozzles",
    "Est. Discharge Time",
    "Est. Final O2",
    "Notes",
  ];

  head.forEach((h, i) => {
    const c = ws.getCell(rowNum, startCol + i);
    c.value = h;
    c.font = { bold: true };
    c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  bottomLine(ws, rowNum, startCol, startCol + head.length - 1, "thin");
}

/* ─────────────────────────────────────────────────────────────
   Styling helpers (precise borders)
   ───────────────────────────────────────────────────────────── */
function setColWidthsForOverview(s0: ExcelJS.Worksheet) {
  // A..O
  s0.columns = [
    { header: "", key: "A", width: 17 },
    { header: "", key: "B", width: 32 },
    { header: "", key: "C", width: 16 },
    { header: "", key: "D", width: 20 },
    { header: "", key: "E", width: 16 },
    { header: "", key: "F", width: 17 },
    { header: "", key: "G", width: 17 },
    { header: "", key: "H", width: 19 },
    { header: "", key: "I", width: 24 },
    { header: "", key: "J", width: 22 },
    { header: "", key: "K", width: 8 },
    { header: "", key: "L", width: 20 },
    { header: "", key: "M", width: 12 },
    { header: "", key: "N", width: 50 },
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
function masterCell(ws: ExcelJS.Worksheet, r: number, c: number): ExcelJS.Cell {
  const cell = ws.getCell(r, c);
  // @ts-ignore – ExcelJS exposes isMerged/master at runtime
  return (cell as any).isMerged ? (cell as any).master : cell;
}

function setBorder(cell: ExcelJS.Cell, patch: Partial<ExcelJS.Borders>) {
  cell.border = { ...(cell.border || {}), ...patch };
}
function bottomLine(
  ws: ExcelJS.Worksheet,
  row: number,
  c1: number,
  c2: number,
  style: ExcelJS.BorderStyle = "thin",
) {
  for (let c = c1; c <= c2; c++) {
    setBorder(masterCell(ws, row, c), { bottom: { style } });
  }
}

function leftLine(
  ws: ExcelJS.Worksheet,
  col: number,
  r1: number,
  r2: number,
  style: ExcelJS.BorderStyle = "thin",
) {
  for (let r = r1; r <= r2; r++) {
    setBorder(masterCell(ws, r, col), { left: { style } });
  }
}

function rightLine(
  ws: ExcelJS.Worksheet,
  col: number,
  r1: number,
  r2: number,
  style: ExcelJS.BorderStyle = "thin",
) {
  for (let r = r1; r <= r2; r++) {
    setBorder(masterCell(ws, r, col), { right: { style } });
  }
}

function boxRange(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  style: ExcelJS.BorderStyle = "thin",
) {
  if (r2 < r1 || c2 < c1) return;

  // top
  for (let c = c1; c <= c2; c++)
    setBorder(masterCell(ws, r1, c), { top: { style } });
  // bottom
  for (let c = c1; c <= c2; c++)
    setBorder(masterCell(ws, r2, c), { bottom: { style } });
  // left
  for (let r = r1; r <= r2; r++)
    setBorder(masterCell(ws, r, c1), { left: { style } });
  // right
  for (let r = r1; r <= r2; r++)
    setBorder(masterCell(ws, r, c2), { right: { style } });
}

function mergeVertical(
  ws: ExcelJS.Worksheet,
  col: number,
  startRow: number,
  endRow: number,
  options?: {
    horizontal?: "left" | "center" | "right";
    vertical?: "top" | "middle" | "bottom";
    wrapText?: boolean;
  },
) {
  const alignment: Partial<ExcelJS.Alignment> = {
    horizontal: options?.horizontal ?? "left",
    vertical: options?.vertical ?? "middle",
    wrapText: options?.wrapText ?? true,
  };

  if (endRow > startRow) {
    ws.mergeCells(startRow, col, endRow, col);
  }

  // Set alignment on ALL cells in the range for maximum robustness
  // (Excel desktop renderer sometimes favors row/column styles if master cell isn't enough)
  for (let r = startRow; r <= endRow; r++) {
    ws.getCell(r, col).alignment = alignment;
  }
}
function mergeBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  options?: {
    horizontal?: "left" | "center" | "right";
    vertical?: "top" | "middle" | "bottom";
    wrapText?: boolean;
  },
) {
  if (endRow < startRow || endCol < startCol) return;

  ws.mergeCells(startRow, startCol, endRow, endCol);

  const cell = ws.getCell(startRow, startCol);
  cell.alignment = {
    horizontal: options?.horizontal ?? "left",
    vertical: options?.vertical ?? "middle",
    wrapText: options?.wrapText ?? true,
  };
}

function formatNotes(notes?: string[]): string {
  if (!notes?.length) return "";
  return notes.map((n) => `- ${n}`).join("\n");
}

/* ─────────────────────────────────────────────────────────────
   Main builder
   ───────────────────────────────────────────────────────────── */
export async function buildWorkbookForProject(args: {
  project: Project;
  priceIndex: PriceIndex;
  options: {
    currency: Currency;
    // NEW: per-type multipliers (0..1)
    engineeredMultiplier?: number;
    preengineeredMultiplier?: number;
  };
}) {
  const { project, priceIndex, options } = args;

  // Normalize multipliers with safe defaults
  const engMultiplier = Math.min(
    1,
    Math.max(0, Number(options.engineeredMultiplier ?? 0.35)),
  );
  const preMultiplier = Math.min(
    1,
    Math.max(0, Number(options.preengineeredMultiplier ?? 0.3)),
  );

  // Systems + overview rows
  // Collect BOM (includes systemPartCode for pre-engineered systems)
  const collected: any = collectBOM(project);

  // Build map of system type by id for pricing breakouts
  const systemTypeById: Record<string, "engineered" | "preengineered"> = (
    project.systems || []
  ).reduce(
    (acc, s) => {
      acc[s.id] = s.type;
      return acc;
    },
    {} as Record<string, "engineered" | "preengineered">,
  );
  const preEngLockedById: Record<string, boolean> = (
    project.systems || []
  ).reduce(
    (acc, s) => {
      acc[s.id] = !!(
        s.options?.kind === "preengineered" &&
        (s.options as any).systemPartCodeLocked
      );
      return acc;
    },
    {} as Record<string, boolean>,
  );

  // Systems + overview rows (inject partcode into pre-E names)
  const systems: SystemInfo[] = (project.systems || []).map((s) => {
    const block = collected?.[s.id];
    const partcode: string | undefined = block?.systemPartCode;
    const baseName = s.name || "System";

    const displayName =
      s.type === "preengineered" && partcode
        ? `${baseName}\n(${partcode})`
        : baseName;

    const isLockedPreEng =
      s.type === "preengineered" && !!preEngLockedById[s.id];

    return {
      id: s.id,
      name: displayName,
      sheetName: baseName,
      type: s.type,
      zones: (s.zones || []).map((z) => ({
        id: z.id,
        name: z.name || "Zone",
        enclosures: (z.enclosures || []).map((e) => {
          const baseNotes = ((e as any).notes ?? []) as string[];

          const notes = isLockedPreEng
            ? [
                ...baseNotes,
                "Volume and Temperature overridden by system partcode lock",
              ]
            : baseNotes;

          return {
            id: e.id,
            name: e.name || "Enclosure",

            // overridden values show "--" in overview
            volume: isLockedPreEng ? undefined : e.volumeFt3,
            temperatureF: isLockedPreEng ? undefined : e.temperatureF,

            designMethod: e.designMethod as any,
            nozzleLabel: getNozzleLabel(
              e.designMethod as any,
              e.nozzleModel as any,
            ),
            nozzleModel: (e as any).nozzleModel,
            nozzleOrientation: (e as any).nozzleOrientation as any,
            requiredNozzleCount: (e as any).requiredNozzleCount,
            estimatedDischargeDuration:
              (e as any).estimatedDischargeDuration ?? (e as any).estDischarge, // Fallback if using old snapshot
            estimatedFinalOxygenPercent:
              (e as any).estimatedFinalOxygenPercent ?? (e as any).estFinalO2,
            requiredCylinderCount: (z as any).requiredCylinderCount,

            notes: formatNotes(notes),
          };
        }),
      })),
    };
  });

  const systemDisplayName: Record<string, string> = {};
  for (const s of systems) {
    systemDisplayName[s.id] = s.name;
  }

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

  // Price helpers reused
  const priceFor = (code: string) => priceIndex[code]?.listPrice ?? 0;
  const bestPricedCodeFor = (ln: BomLine): string => {
    const c0 = ln.codes?.[0];
    const c1 = ln.codes?.[1];
    const aliases = [
      c0,
      c1,
      (ln as any).partCode,
      (ln as any).partCodeM3,
      (ln as any).partcode,
      (ln as any).alt,
    ].filter((x): x is string => !!x);

    const preferred = (options.currency === "USD" ? [c0, c1] : [c1, c0]).filter(
      (x): x is string => !!x,
    );
    for (const c of preferred) if (priceIndex[c]) return c;
    for (const c of aliases) if (priceIndex[c]) return c;
    return ""; // nothing priced
  };

  // NEW: compute type-specific list totals
  let engListTotal = 0;
  let preListTotal = 0;

  for (const ln of lines) {
    const code = bestPricedCodeFor(ln);
    if (!code) continue;
    const u = priceFor(code);
    const qty = ln.qty || 0;
    const sysId = ln.scope.systemId;
    const sysType = systemTypeById[sysId] ?? "engineered";
    if (sysType === "engineered") engListTotal += u * qty;
    else preListTotal += u * qty;
  }

  const listTotal = engListTotal + preListTotal;

  // NEW: compute nets per type using their multipliers
  const engNet = engListTotal * engMultiplier;
  const preNet = preListTotal * preMultiplier;
  const netTotal = engNet + preNet;

  // existing currencyFmt calculation unchanged
  const currencyFmt =
    options.currency === "USD"
      ? '"$"#,##0.00'
      : options.currency === "GBP"
        ? '"£"#,##0.00'
        : '"€"#,##0.00';

  const wb = new ExcelJS.Workbook();
  wb.creator = "Victaulic Vortex Builder";
  wb.created = new Date();

  // BPCS for USD, M3/alt for EUR/GBP
  const pluckCode = (ln: BomLine, currency: Currency) => {
    const c0 = (
      ln.codes?.[0] ||
      (ln as any).partCode ||
      (ln as any).partcode ||
      ""
    ).trim();
    const c1 = (
      ln.codes?.[1] ||
      (ln as any).partCodeM3 ||
      (ln as any).alt ||
      ""
    ).trim();

    if (currency === "USD") {
      // prefer BPCS (c0), fallback to c1 if nothing else
      return c0 || c1 || "";
    } else {
      // prefer M3/alt (c1) FOR NON-USD only if it exists; otherwise fall back to c0
      return c1 || c0 || "";
    }
  };

  /* ─────────────────────────────────────────────────────────
   Overview sheet (new layout)
   ───────────────────────────────────────────────────────── */
  const s0 = wb.addWorksheet(
    makeExcelSheetName(project.name || "Untitled Project", "Overview"),
  );
  setColWidthsForOverview(s0);

  // ── Project Options box in A1:B9 ───────────────────────────

  // Section header at A1
  boldItalic(s0.getCell("A1"), "Project Options");

  // Labels + values in A2:B9
  const optionRows: Array<[string, any]> = [
    ["Project", project.name || "Untitled Project"],
    ["Company Name", project.companyName || ""],
    ["Name", `${project.firstName || ""} ${project.lastName || ""}`.trim()],
    ["Phone Number", project.phone || ""],
    ["Email Address", project.email || ""],
    ["Location", project.projectLocation || ""],
    ["Date", new Date()],
    ["Elevation", project.elevation || "0FT/0KM"],
  ];

  let optRow = 2;
  for (const [label, value] of optionRows) {
    const lcell = s0.getCell(optRow, 1); // A
    const vcell = s0.getCell(optRow, 2); // B
    bold(lcell, label);
    vcell.value = value;
    vcell.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    optRow++;
  }

  // Outline the A1:B9 region
  bottomLine(s0, 1, 1, 2, "thin"); // under "Project Options"
  bottomLine(s0, 9, 1, 2, "thin"); // under last option row
  rightLine(s0, 2, 2, 9, "thin"); // right edge of box

  // ── Pricing block in D2:E4 ─────────────────────────────────

  const PRICING = {
    titleRow: 1,
    headerRow: 2,
    firstDataRow: 3,
    startCol: 4,
    endCol: 7,
  };
  const sysOrder = (project.systems || []).map((s) => s.type); // keeps order

  const hasEng = sysOrder.includes("engineered");
  const hasPre = sysOrder.includes("preengineered");

  const firstType = sysOrder.find(
    (t) => t === "engineered" || t === "preengineered",
  );

  type PriceRow = {
    label: string;
    mult: number | string; // "-" for totals
    list: number;
    net: number;
  };

  const rows: PriceRow[] = [];

  const engRow: PriceRow = {
    label: "Engineered",
    mult: engMultiplier,
    list: engListTotal,
    net: engNet,
  };

  const preRow: PriceRow = {
    label: "Pre-Engineered",
    mult: preMultiplier,
    list: preListTotal,
    net: preNet,
  };

  // Add only rows that exist, in “first seen” order
  if (hasEng && hasPre) {
    if (firstType === "preengineered") rows.push(preRow, engRow);
    else rows.push(engRow, preRow); // default engineered first
  } else if (hasEng) {
    rows.push(engRow);
  } else if (hasPre) {
    rows.push(preRow);
  }

  // Always add Project Totals (optional: only if >1 type; but you didn’t ask to remove it)
  rows.push({
    label: "Project Totals",
    mult: "-",
    list: listTotal,
    net: netTotal,
  });

  // Use this for rendering
  const priceRows = rows;

  const pricingLastDataRow = PRICING.firstDataRow + priceRows.length - 1;

  const fmtMultiplier = "0.00"; // keep as plain number (NOT currency)

  // Title
  boldItalic(s0.getCell(PRICING.titleRow, PRICING.startCol), "Pricing");
  bottomLine(s0, PRICING.titleRow, PRICING.startCol, PRICING.endCol, "thin");

  // Header row
  const hdrRow = PRICING.headerRow;
  const hdr = ["System Totals", "Multiplier", "List Price", "Net Price"];
  hdr.forEach((h, i) => {
    const cell = s0.getCell(hdrRow, PRICING.startCol + i);
    cell.value = h;
    cell.font = { ...(cell.font || {}), bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });
  bottomLine(s0, hdrRow, PRICING.startCol, PRICING.endCol, "thin");

  let r = PRICING.firstDataRow;
  for (const row of priceRows) {
    const cLabel = s0.getCell(r, PRICING.startCol);
    const cMult = s0.getCell(r, PRICING.startCol + 1);
    const cList = s0.getCell(r, PRICING.startCol + 2);
    const cNet = s0.getCell(r, PRICING.startCol + 3);

    // Label
    cLabel.value = row.label;
    cLabel.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };

    // Multiplier (number OR "-")
    cMult.value = row.mult as any;
    cMult.alignment = { horizontal: "right", vertical: "middle" };
    if (typeof row.mult === "number") cMult.numFmt = fmtMultiplier;

    // Prices
    cList.value = row.list as any;
    cNet.value = row.net as any;

    cList.alignment = { horizontal: "right", vertical: "middle" };
    cNet.alignment = { horizontal: "right", vertical: "middle" };
    cList.numFmt = currencyFmt;
    cNet.numFmt = currencyFmt;

    // Bold totals row
    if (row.label === "Project Totals") {
      cLabel.font = { ...(cLabel.font || {}), bold: true };
      cList.font = { ...(cList.font || {}), bold: true };
      cNet.font = { ...(cNet.font || {}), bold: true };
    }

    r++;
  }

  // Bottom border under last data row
  bottomLine(s0, pricingLastDataRow, PRICING.startCol, PRICING.endCol, "thin");
  bottomLine(
    s0,
    pricingLastDataRow - 1,
    PRICING.startCol,
    PRICING.endCol,
    "thin",
  );

  // Box outline + vertical separators
  // Left edge of box (drawn as right border on column G)
  rightLine(
    s0,
    PRICING.startCol - 1,
    PRICING.headerRow,
    pricingLastDataRow,
    "thin",
  );
  // Internal column dividers (H|I|J) and right edge (K)
  rightLine(
    s0,
    PRICING.startCol + 0,
    PRICING.headerRow,
    pricingLastDataRow,
    "thin",
  ); // after H
  rightLine(
    s0,
    PRICING.startCol + 1,
    PRICING.headerRow,
    pricingLastDataRow,
    "thin",
  ); // after I
  rightLine(
    s0,
    PRICING.startCol + 2,
    PRICING.headerRow,
    pricingLastDataRow,
    "thin",
  ); // after J
  rightLine(s0, PRICING.endCol, PRICING.headerRow, pricingLastDataRow, "thin"); // after K

  // ── Project Summary title + header ─────────────────────────

  boldItalic(s0.getCell("A11"), "Project Summary");

  // Where the table begins
  const startCol = 1;
  let cursor = 12;

  // build blocks
  const sysBlocks = buildOverviewRowsBySystem(systems);

  for (let si = 0; si < sysBlocks.length; si++) {
    const sys = sysBlocks[si];

    // (1) print header row for this system
    writeSummaryHeaderRow(s0, cursor, startCol);
    const headerRow = cursor;

    // (2) print data rows
    const firstDataRow = headerRow + 1;
    let rowPtr = firstDataRow;

    // merge tracking
    const zoneMerges: Array<{ start: number; end: number }> = [];

    for (const z of sys.zones) {
      const zoneStart = rowPtr;

      for (const row of z.rows) {
        const vals = [
          sys.systemType, // A
          sys.systemName, // B
          z.zoneName, // C
          row.requiredCylinderCount ?? "", // D
          row.enclosureName, // E
          row.volume ?? "--", // F
          row.temperatureF ?? "--", // G
          row.designMethod ?? "", // H
          row.nozzleLabel ?? "", // I
          formatNozzleStyle(row.nozzleOrientation),
          row.requiredNozzleCount ?? "", // K
          row.estimatedDischargeDuration ?? "", // L
          row.estimatedFinalOxygenPercent ?? "", // M
          row.notes ?? "", // N
        ];

        vals.forEach((v, j) => {
          const cell = s0.getCell(rowPtr, startCol + j);
          if (j === 2 || j === 3) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
              wrapText: true,
            };
          } else {
            cell.alignment = {
              horizontal: "left",
              vertical: "middle",
              wrapText: true,
            };
          }

          cell.value = v as any;
        });

        // row underline (keep your existing behavior)
        bottomLine(s0, rowPtr, 5, 14, "thin"); // E..N
        rowPtr++;
      }

      const zoneEnd = rowPtr - 1;
      if (zoneEnd >= zoneStart)
        zoneMerges.push({ start: zoneStart, end: zoneEnd });
    }

    const lastDataRow = rowPtr - 1;

    // (3) Apply merges AFTER writing
    if (lastDataRow >= firstDataRow) {
      // Merge system type/name for the entire system block
      mergeVertical(s0, 1, firstDataRow, lastDataRow, {
        horizontal: "center",
        vertical: "middle",
      });
      mergeVertical(s0, 2, firstDataRow, lastDataRow, {
        horizontal: "center",
        vertical: "middle",
      });

      // Merge zone name + cylinders per zone
      for (const m of zoneMerges) {
        mergeVertical(s0, 3, m.start, m.end, {
          horizontal: "center",
          vertical: "middle",
        });
        mergeVertical(s0, 4, m.start, m.end, {
          horizontal: "center",
          vertical: "middle",
        });

        // optional: draw a boundary at end of each zone (like you do now)
        bottomLine(s0, m.end, 3, 4, "thin"); // C..D
      }

      // Optional: draw a boundary at end of system
      bottomLine(s0, lastDataRow, 1, 2, "thin"); // A..B

      // Optional: box/frame + dividers (mirrors your “specified earlier” rules)
      rightLine(s0, 14, headerRow + 1, lastDataRow, "thin"); // right edge @ N
      rightLine(s0, 2, headerRow + 1, lastDataRow, "thin"); // divider after B
      rightLine(s0, 4, headerRow + 1, lastDataRow, "thin"); // divider after D
    }

    // (4) skip a blank row between systems
    cursor = lastDataRow + 2; // +1 blank row
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
        a.code.localeCompare(b.code),
    );
  }

  // column sets
  function setColsComplete(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { width: 30 }, // System Name
      { width: 18 }, // Category
      { width: 8 }, // Item #
      { width: 70 }, // Description
      { width: 10 }, // Qty
      { width: 20 }, // Partcode
    ];
  }
  function setColsEnclosure(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { width: 30 }, // System Name
      { width: 16 }, // Zone Name
      { width: 20 }, // Enclosure Name
      { width: 8 }, // Item #
      { width: 70 }, // Description
      { width: 10 }, // Qty
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
    units: UnitCtx,
  ): number {
    let v =
      units === "imperial"
        ? sys.zones[0].enclosures[0].volume
        : sys.zones[0].enclosures[0].volume! * 35.3147;
    let t_0 = 294.4;
    let t =
      units === "imperial"
        ? (((sys.zones[0].enclosures[0].temperatureF ?? 70) - 32) * 5) / 9 +
          273.15
        : sys.zones[0].enclosures[0].temperatureF! + 273.15;
    let acf = calcACF(project.elevation, units);
    let h_hybrid = 0.375;
    let sf = 1.2;
    let w_n2_req = v * (t_0 / t) * acf * h_hybrid * sf;
    return (
      w_n2_req /
      parseNumberWithUnit(
        sys.zones[0].enclosures[0].estimatedDischargeDuration!,
      )
    );
  }

  function parseNumberWithUnit(
    label: string,
    unit: string = "min",
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
          "The provided SS flex line is 914 millimeters in length",
        ),
      },
      {
        section: "Hybrid Emitter Drop",
        param:
          "Pipe Connection from 1-inch Nitrogen Drop to 3/4-inch FPT Hybrid Emitter Connection",
        value: U(
          units,
          "3/4-inch nipple shall not exceed 4 inches in length",
          "3/4-inch nipple shall not exceed 102 millimeters in length",
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
          "4.9 meters or Based on Maximum Hybrid Emitter Spacing",
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
          "The provided SS flex line is 914 millimeters in length",
        ),
      },
      {
        section: "Hybrid Emitter Drops",
        param:
          "Pipe Connection from 1-inch Nitrogen Drop to 3/4-inch FPT Hybrid Emitter Connection",
        value: U(
          units,
          "3/4-inch nipple shall not exceed 4 inches in length",
          "3/4-inch nipple shall not exceed 102 millimeters in length",
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
        : r,
    );
  }

  // function writePipeGuidanceSheetForPreE(
  //   wb: ExcelJS.Workbook,
  //   sys: SystemInfo,
  //   units: UnitCtx,
  // ) {
  //   const ws = wb.addWorksheet(
  //     makeExcelSheetName(sys.sheetName, "Piping & Enclosure Req"),
  //   );

  //   // Column layout: A label, B–D pipe table, E spacer, F–H enclosure, F–J spacing
  //   ws.columns = [
  //     { width: 30 }, // A - System Name label/value
  //     { width: 22 }, // B - Pipe Runs
  //     { width: 55 }, // C - Pipe Parameters (wrap)
  //     { width: 28 }, // D - Value
  //     { width: 3 }, // E - spacer
  //     { width: 30 }, // F - Opening / Type
  //     { width: 10 }, // G - Nozzle
  //     { width: 28 }, // H - Allowable / Between Nozzles (wrap)
  //     { width: 16 }, // I - Min to Wall
  //     { width: 18 }, // J - Foil to Ceiling (A)
  //   ];

  //   // Header row (row 1)
  //   const hdr = ws.getRow(1);
  //   hdr.getCell(1).value = "System Name";
  //   hdr.getCell(2).value = "Pipe Runs";
  //   hdr.getCell(3).value = "Pipe Parameters";
  //   hdr.getCell(4).value = "Value";
  //   hdr.font = { bold: true };
  //   hdr.alignment = {
  //     horizontal: "left",
  //     vertical: "middle",
  //     wrapText: true,
  //   };
  //   bottomLine(ws, 1, 1, 4, "thin");

  //   // System name (row 2, col A)
  //   const sysCell = ws.getCell("A2");
  //   const projSys = (project.systems || []).find((s) => s.id === sys.id);
  //   const partcode = (collected as any)?.[sys.id]?.systemPartCode; // same place you used earlier
  //   const baseName = projSys?.name || sys.sheetName || "System";

  //   sysCell.value = partcode ? `${baseName}\n(${partcode})` : baseName;

  //   sysCell.alignment = {
  //     horizontal: "left",
  //     vertical: "middle",
  //     wrapText: true,
  //   };

  //   // Determine single vs multi-emitter
  //   let emitters = 0;
  //   for (const z of sys.zones) {
  //     for (const e of z.enclosures) {
  //       emitters = Number((e as any).minEmitters ?? 0);
  //     }
  //   }
  //   const isMulti = emitters > 1;

  //   const rows: ConstRow[] = isMulti
  //     ? materializeMultiRows(
  //         units,
  //         pickBandForQwater(computeSystemQn2Total(project, sys, units)),
  //       )
  //     : singleEmitterRows(units);
  //   let r = 2;
  //   let lastSection = "";

  //   // Track section merge ranges in column B
  //   const sectionRanges: Array<{ start: number; end: number }> = [];
  //   let sectionStartRow = r; // start of current section

  //   for (const rowObj of rows) {
  //     const isNewSection = rowObj.section !== lastSection;

  //     // If we are starting a new section, close the previous one
  //     if (isNewSection && lastSection) {
  //       sectionRanges.push({ start: sectionStartRow, end: r - 1 });
  //       sectionStartRow = r;
  //     }

  //     const showSection = isNewSection ? rowObj.section : "";

  //     ws.getCell(r, 2).value = showSection; // B: Pipe Runs
  //     ws.getCell(r, 3).value = rowObj.param; // C: Pipe Parameters
  //     ws.getCell(r, 4).value = rowObj.value; // D: Value

  //     // alignment
  //     ws.getCell(r, 2).alignment = {
  //       horizontal: "center",
  //       vertical: "middle",
  //       wrapText: true,
  //     };
  //     ws.getCell(r, 3).alignment = {
  //       horizontal: "left",
  //       vertical: "middle",
  //       wrapText: true,
  //     };
  //     ws.getCell(r, 4).alignment = {
  //       horizontal: "left",
  //       vertical: "middle",
  //       wrapText: true,
  //     };

  //     boxRange(ws, r, 3, r, 4, "thin");

  //     lastSection = rowObj.section;
  //     r++;
  //   }

  //   const lastPipeRow = r - 1;
  //   if (rows.length) {
  //     sectionRanges.push({ start: sectionStartRow, end: lastPipeRow });
  //   }

  //   // ── MERGES ───────────────────────────────────────────────

  //   // Merge System Name down the full pipe table height
  //   // A2:A(lastPipeRow)
  //   mergeVertical(ws, 1, 2, lastPipeRow, {
  //     horizontal: "left",
  //     vertical: "middle",
  //     wrapText: true,
  //   });

  //   // Merge Pipe Runs sections (column B) per section range
  //   for (const m of sectionRanges) {
  //     mergeVertical(ws, 2, m.start, m.end, {
  //       horizontal: "center",
  //       vertical: "middle",
  //       wrapText: true,
  //     });
  //   }
  //   for (const m of sectionRanges) {
  //     // master cell for merged block in column B
  //     const master = ws.getCell(m.start, 2);
  //     master.alignment = {
  //       horizontal: "center",
  //       vertical: "middle",
  //       wrapText: true,
  //     };
  //   }
  //   for (const m of sectionRanges) {
  //     const master = ws.getCell(m.start, 2);
  //     console.log(
  //       `B${m.start}-${m.end} isMerged:`,
  //       (master as any).isMerged ?? false,
  //     );
  //     console.log(
  //       `  master.value:`,
  //       (master as any).master?.value ?? master.value,
  //     );
  //     console.log(
  //       `  master.alignment:`,
  //       (master as any).master?.alignment ?? master.alignment,
  //     );
  //     console.log(
  //       `  row heights:`,
  //       ws.getRow(m.start).height,
  //       ws.getRow(m.end).height,
  //     );
  //   }

  //   // ── SECTION BOXES (after merges) ─────────────────────────────

  //   // 1) System underline at the bottom of the merged system cell (A2:A(lastPipeRow))
  //   bottomLine(ws, lastPipeRow, 1, 1, "thin");

  //   // (optional) if you want the underline across A..D instead:
  //   // bottomLine(ws, lastPipeRow, 1, 4, "thin");

  //   // 2) For each pipe section: box the Pipe Runs cell (col B) + box the Parameters region (cols C:D)
  //   for (const m of sectionRanges) {
  //     // Ensure the merged Pipe Runs master cell is centered
  //     ws.getCell(m.start, 2).alignment = {
  //       horizontal: "center",
  //       vertical: "middle",
  //       wrapText: true,
  //     };

  //     // Box around Pipe Run label area (just column B, spanning the section rows)
  //     boxRange(ws, m.start, 2, m.end, 2, "thin");
  //   }

  //   // ── Enclosure Requirements (fixed rows on the right) ─────
  //   // Title row aligned with Pipe Guidance title (row 3)
  //   const encTitleRow = 1;
  //   const encTitle = ws.getCell(encTitleRow, 6);
  //   encTitle.value = "Enclosure Requirements";
  //   encTitle.font = { bold: true };
  //   encTitle.alignment = {
  //     horizontal: "left",
  //     vertical: "middle",
  //   };
  //   bottomLine(ws, encTitleRow, 6, 8, "thin");

  //   const encHdrRow = encTitleRow + 1; // row 4
  //   const encHdr = ws.getRow(encHdrRow);
  //   encHdr.getCell(6).value = "Opening";
  //   encHdr.getCell(7).value = "Nozzle";
  //   encHdr.getCell(8).value = "Allowable Opening Area";
  //   encHdr.getCell(6).font = { bold: true };
  //   encHdr.getCell(7).font = { bold: true };
  //   encHdr.getCell(8).font = { bold: true };
  //   encHdr.alignment = {
  //     horizontal: "left",
  //     vertical: "middle",
  //     wrapText: true,
  //   };
  //   bottomLine(ws, encHdrRow, 6, 8, "thin");

  //   // Locate actual enclosure + guidance
  //   const enc = projSys?.zones?.[0]?.enclosures?.[0] ?? null;
  //   const guidance = enc ? computePreEngGuidance(enc as any, project) : null;
  //   if (guidance) {
  //     const openMax = fmtFt2AndM2(guidance.openMaxFt2);
  //     const openMin = fmtFt2AndM2(guidance.openMinFt2);

  //     const rowMax = encHdrRow + 1; // row 5
  //     ws.getCell(rowMax, 6).value = "Maximum Opening";
  //     ws.getCell(rowMax, 7).value = guidance.pendent.size;
  //     ws.getCell(rowMax, 8).value = `${openMax.ft2} ft² / ${openMax.m2} m²`;

  //     const rowMin = rowMax + 1; // row 6
  //     ws.getCell(rowMin, 6).value = "Minimum Opening";
  //     ws.getCell(rowMin, 7).value = guidance.pendent.size;
  //     ws.getCell(rowMin, 8).value = `${openMin.ft2} ft² / ${openMin.m2} m²`;

  //     for (let rr = rowMax; rr <= rowMin; rr++) {
  //       for (let c = 6; c <= 8; c++) {
  //         ws.getCell(rr, c).alignment = {
  //           horizontal: "left",
  //           vertical: "middle",
  //           wrapText: true,
  //         };
  //       }
  //     }

  //     bottomLine(ws, rowMin, 6, 8, "thin");
  //     // Box F3:H6
  //     rightLine(ws, 5, encTitleRow + 1, rowMin, "thin");
  //     rightLine(ws, 8, encTitleRow + 1, rowMin, "thin");

  //     // ── Spacing Requirements (below Enclosure, still fixed) ──
  //     const spTitleRow = rowMin + 2; // row 8
  //     const spTitle = ws.getCell(spTitleRow, 6);
  //     spTitle.value = "Spacing Requirements";
  //     spTitle.font = { bold: true };

  //     spTitle.alignment = {
  //       horizontal: "left",
  //       vertical: "middle",
  //     };
  //     bottomLine(ws, spTitleRow, 6, 10, "thin");

  //     const spHdrRow = spTitleRow + 1; // row 9
  //     const spHdr = ws.getRow(spHdrRow);
  //     spHdr.getCell(6).value = "Type";
  //     spHdr.getCell(7).value = "Nozzle";
  //     spHdr.getCell(8).value = "Between Nozzles";
  //     spHdr.getCell(9).value = "Min to Wall";
  //     spHdr.getCell(10).value = "Foil to Ceiling (A)";
  //     spHdr.getCell(6).font = { bold: true };
  //     spHdr.getCell(7).font = { bold: true };
  //     spHdr.getCell(8).font = { bold: true };
  //     spHdr.getCell(9).font = { bold: true };
  //     spHdr.getCell(10).font = { bold: true };
  //     spHdr.alignment = {
  //       horizontal: "left",
  //       vertical: "middle",
  //     };
  //     bottomLine(ws, spHdrRow, 6, 10, "thin");

  //     let spRow = spHdrRow + 1; // first data row (row 10)

  //     // Pendent row
  //     ws.getCell(spRow, 6).value = "Pendent";
  //     ws.getCell(spRow, 7).value = guidance.pendent.size;
  //     ws.getCell(spRow, 8).value = guidance.pendent.distBetween;
  //     ws.getCell(spRow, 9).value =
  //       `${guidance.pendent.minToWallFt} ft / ${guidance.pendent.minToWallM} m`;
  //     ws.getCell(spRow, 10).value =
  //       `${guidance.pendent.foilToCeilingIn[0]}–${guidance.pendent.foilToCeilingIn[1]} in (${guidance.pendent.foilToCeilingMm[0]}–${guidance.pendent.foilToCeilingMm[1]} mm)`;
  //     for (let c = 6; c <= 10; c++) {
  //       ws.getCell(spRow, c).alignment = {
  //         horizontal: "left",
  //         vertical: "middle",
  //         wrapText: true, // wrap Between Nozzles (H) text
  //       };
  //     }
  //     spRow++;

  //     // Sidewall row (optional)
  //     if (guidance.sidewall) {
  //       ws.getCell(spRow, 6).value = "Sidewall";
  //       ws.getCell(spRow, 7).value = guidance.sidewall.size;
  //       ws.getCell(spRow, 8).value = guidance.sidewall.distBetween;
  //       ws.getCell(spRow, 9).value =
  //         `${guidance.sidewall.minToAdjWallFt} ft / ${guidance.sidewall.minToAdjWallM} m`;
  //       ws.getCell(spRow, 10).value = "—";
  //       for (let c = 6; c <= 10; c++) {
  //         ws.getCell(spRow, c).alignment = {
  //           horizontal: "left",
  //           vertical: "middle",
  //           wrapText: true,
  //         };
  //       }
  //     }

  //     const spLastRow = guidance.sidewall ? spRow : spRow - 1;
  //     bottomLine(ws, spLastRow, 6, 10, "thin");
  //     // Box F8:J(10/11)
  //     rightLine(ws, 5, spTitleRow + 1, spLastRow, "thin");
  //     rightLine(ws, 10, spTitleRow + 1, spLastRow, "thin");
  //   }
  // }
  // Replace your existing writePipeGuidanceSheetForPreE with this improved version.
  // It depends on your existing helpers: boxRange, mergeVertical, bottomLine, rightLine, etc.
  // (If any helper names differ, rename locally.)

  function estimateWrappedLines(text: string, colWidthChars: number) {
    if (!text) return 1;
    // rough heuristic: treat newlines explicitly, otherwise estimate by chars per line
    const explicitLines = (text.match(/\n/g) || []).length + 1;
    const cleaned = text.replace(/\n/g, " ");
    const avgCharsPerLine = Math.max(10, Math.floor(colWidthChars * 1.0)); // conservative
    const guessed = Math.max(1, Math.ceil(cleaned.length / avgCharsPerLine));
    return Math.max(explicitLines, guessed);
  }

  /**
   * Improved Pipe Guidance sheet builder.
   * - sys: SystemInfo as used earlier
   * - units: "imperial" | "metric"
   */
  function writePipeGuidanceSheetImproved(
    wb: ExcelJS.Workbook,
    project: Project,
    collected: any,
    sys: SystemInfo,
    units: UnitCtx,
  ) {
    const ws = wb.addWorksheet(
      makeExcelSheetName(sys.sheetName, "Piping & Enclosure Req"),
    );

    // Column layout: A label, B–D pipe table, E spacer, F–J enclosure/spacing
    ws.columns = [
      { width: 30 }, // A - System Name label/value (approx 30 chars)
      { width: 22 }, // B - Pipe Runs (section labels)
      { width: 55 }, // C - Pipe Parameters (wrap)
      { width: 28 }, // D - Value
      { width: 3 }, // E - spacer
      { width: 30 }, // F - Opening / Type
      { width: 10 }, // G - Nozzle
      { width: 28 }, // H - Allowable / Between Nozzles (wrap)
      { width: 16 }, // I - Min to Wall
      { width: 18 }, // J - Foil to Ceiling (A)
    ];

    // Header row
    const hdr = ws.getRow(1);
    hdr.getCell(1).value = "System Name";
    hdr.getCell(2).value = "Pipe Runs";
    hdr.getCell(3).value = "Pipe Parameters";
    hdr.getCell(4).value = "Value";
    hdr.font = { bold: true };
    // DO NOT use row-level alignment; it overrides cells in row 1
    for (let c = 1; c <= 4; c++) {
      hdr.getCell(c).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }
    bottomLine(ws, 1, 1, 4, "thin");

    // System name master cell (A2 merged down later)
    const projSys = (project.systems || []).find((s) => s.id === sys.id);
    const partcode = (collected as any)?.[sys.id]?.systemPartCode;
    const baseName = projSys?.name || sys.sheetName || "System";
    const sysNameText = partcode ? `${baseName}\n(${partcode})` : baseName;

    // Determine single vs multi-emitter (same logic you used)
    let emitters = 0;
    for (const z of sys.zones) {
      for (const e of z.enclosures) {
        emitters = Number((e as any).requiredNozzleCount ?? 0) || emitters;
      }
    }
    const isMulti = emitters > 1;

    // Build rows for the pipe guidance (reuse your singleEmitterRows/materializeMultiRows)
    const rows: ConstRow[] = isMulti
      ? materializeMultiRows(
          units,
          pickBandForQwater(computeSystemQn2Total(project, sys, units)),
        )
      : singleEmitterRows(units);

    // We'll print starting at row 2
    let writeRow = 2;
    // group sections by contiguous ranges — this is similar to your previous approach
    const sectionRanges: Array<{
      section: string;
      start: number;
      end: number;
    }> = [];

    let lastSection = "";
    let currentSectionStart = writeRow;

    for (let i = 0; i < rows.length; i++) {
      const rObj = rows[i];
      const isNew = rObj.section !== lastSection;
      if (isNew && lastSection) {
        // close previous
        sectionRanges.push({
          section: lastSection,
          start: currentSectionStart,
          end: writeRow - 1,
        });
        currentSectionStart = writeRow;
      }

      const showSection = isNew ? rObj.section : "";
      ws.getCell(writeRow, 2).value = showSection; // B
      ws.getCell(writeRow, 3).value = rObj.param; // C
      ws.getCell(writeRow, 4).value = rObj.value; // D

      // alignments
      ws.getCell(writeRow, 2).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      ws.getCell(writeRow, 3).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      ws.getCell(writeRow, 4).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };

      // box around param/value each row (we'll expand boxes per section later)
      boxRange(ws, writeRow, 3, writeRow, 4, "thin");

      lastSection = rObj.section;
      writeRow++;
    }
    const lastPipeRow = writeRow - 1;
    if (rows.length)
      sectionRanges.push({
        section: lastSection,
        start: currentSectionStart,
        end: lastPipeRow,
      });

    // Merge System Name down the full pipe table height
    if (lastPipeRow >= 2) {
      mergeVertical(ws, 1, 2, lastPipeRow, {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      });
      ws.getCell(2, 1).value = sysNameText;
    } else {
      // If no rows, still set A2 single
      ws.getCell(2, 1).value = sysNameText;
      ws.getCell(2, 1).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }

    // Merge each section label in column B
    for (const m of sectionRanges) {
      mergeVertical(ws, 2, m.start, m.end, {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      });
    }

    // Now box the pipe runs (B) and parameters (C:D) per section
    for (const m of sectionRanges) {
      // Box around Pipe Run label (B)
      boxRange(ws, m.start, 2, m.end, 2, "thin");
      // Box around parameters area (C:D)
      boxRange(ws, m.start, 3, m.end, 4, "thin");
      // bottom underline for the section
      bottomLine(ws, m.end, 1, 4, "thin");
    }

    // --- Enclosure Requirements (right side) ---
    const encTitleRow = 1;
    const encTitle = ws.getCell(encTitleRow, 6);
    encTitle.value = "Enclosure Requirements";
    encTitle.font = { bold: true };
    encTitle.alignment = { horizontal: "left", vertical: "middle" };
    bottomLine(ws, encTitleRow, 6, 8, "thin");

    const encHdrRow = encTitleRow + 1; // typically 2
    const encHdr = ws.getRow(encHdrRow);
    encHdr.getCell(6).value = "Opening";
    encHdr.getCell(7).value = "Nozzle";
    encHdr.getCell(8).value = "Allowable Opening Area";
    encHdr.getCell(6).font = { bold: true };
    encHdr.getCell(7).font = { bold: true };
    encHdr.getCell(8).font = { bold: true };

    // DO NOT use row-level alignment; it overrides Column A/B master cells in row 2
    for (let c = 6; c <= 8; c++) {
      encHdr.getCell(c).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }
    bottomLine(ws, encHdrRow, 6, 8, "thin");

    const projSysObj = projSys;
    const enc = projSysObj?.zones?.[0]?.enclosures?.[0] ?? null;
    const guidance = enc ? computePreEngGuidance(enc as any, project) : null;
    let spLastRow = encHdrRow;
    if (guidance) {
      const openMax = fmtFt2AndM2(guidance.openMaxFt2);
      const openMin = fmtFt2AndM2(guidance.openMinFt2);

      const rowMax = encHdrRow + 1; // 3
      ws.getCell(rowMax, 6).value = "Maximum Opening";
      ws.getCell(rowMax, 7).value = guidance.pendent.size;
      ws.getCell(rowMax, 8).value = `${openMax.ft2} ft² / ${openMax.m2} m²`;

      const rowMin = rowMax + 1; // 4
      ws.getCell(rowMin, 6).value = "Minimum Opening";
      ws.getCell(rowMin, 7).value = guidance.pendent.size;
      ws.getCell(rowMin, 8).value = `${openMin.ft2} ft² / ${openMin.m2} m²`;

      for (let rr = rowMax; rr <= rowMin; rr++) {
        for (let c = 6; c <= 8; c++) {
          ws.getCell(rr, c).alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        }
      }

      bottomLine(ws, rowMin, 6, 8, "thin");
      rightLine(ws, 5, encTitleRow + 1, rowMin, "thin");
      rightLine(ws, 8, encTitleRow + 1, rowMin, "thin");

      // Spacing Requirements block below
      const spTitleRow = rowMin + 2;
      const spTitle = ws.getCell(spTitleRow, 6);
      spTitle.value = "Spacing Requirements";
      spTitle.font = { bold: true };
      spTitle.alignment = { horizontal: "left", vertical: "middle" };
      bottomLine(ws, spTitleRow, 6, 10, "thin");

      const spHdrRow = spTitleRow + 1;
      const spHdr = ws.getRow(spHdrRow);
      spHdr.getCell(6).value = "Type";
      spHdr.getCell(7).value = "Nozzle";
      spHdr.getCell(8).value = "Between Nozzles";
      spHdr.getCell(9).value = "Min to Wall";
      spHdr.getCell(10).value = "Foil to Ceiling (A)";
      for (let c = 6; c <= 10; c++) spHdr.getCell(c).font = { bold: true };
      bottomLine(ws, spHdrRow, 6, 10, "thin");

      let spRow = spHdrRow + 1;
      // Pendent
      ws.getCell(spRow, 6).value = "Pendent";
      ws.getCell(spRow, 7).value = guidance.pendent.size;
      ws.getCell(spRow, 8).value = guidance.pendent.distBetween;
      ws.getCell(spRow, 9).value =
        `${guidance.pendent.minToWallFt} ft / ${guidance.pendent.minToWallM} m`;
      ws.getCell(spRow, 10).value =
        `${guidance.pendent.foilToCeilingIn[0]}–${guidance.pendent.foilToCeilingIn[1]} in (${guidance.pendent.foilToCeilingMm[0]}–${guidance.pendent.foilToCeilingMm[1]} mm)`;
      for (let c = 6; c <= 10; c++)
        ws.getCell(spRow, c).alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      spRow++;

      if (guidance.sidewall) {
        ws.getCell(spRow, 6).value = "Sidewall";
        ws.getCell(spRow, 7).value = guidance.sidewall.size;
        ws.getCell(spRow, 8).value = guidance.sidewall.distBetween;
        ws.getCell(spRow, 9).value =
          `${guidance.sidewall.minToAdjWallFt} ft / ${guidance.sidewall.minToAdjWallM} m`;
        ws.getCell(spRow, 10).value = "—";
        for (let c = 6; c <= 10; c++)
          ws.getCell(spRow, c).alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        spRow++;
      }

      spLastRow = spRow - 1;
      bottomLine(ws, spLastRow, 6, 10, "thin");
      rightLine(ws, 5, spTitleRow + 1, spLastRow, "thin");
      rightLine(ws, 10, spTitleRow + 1, spLastRow, "thin");
    }

    const finalRow = Math.max(lastPipeRow, spLastRow);
    for (let r = 2; r <= finalRow; r++) {
      const row = ws.getRow(r);
      let maxLines = 1;

      // --- Pipe Guidance Table (Col A-D) ---
      if (r <= lastPipeRow) {
        const c3 = String(ws.getCell(r, 3).value || "");
        const c4 = String(ws.getCell(r, 4).value || "");
        maxLines = Math.max(maxLines, estimateWrappedLines(c3, 50));
        maxLines = Math.max(maxLines, estimateWrappedLines(c4, 25));

        if (r === 2) {
          maxLines = Math.max(maxLines, estimateWrappedLines(sysNameText, 25));
        }
        for (const m of sectionRanges) {
          if (r === m.start) {
            maxLines = Math.max(maxLines, estimateWrappedLines(m.section, 20));
          }
        }
      }

      // --- Enclosure/Spacing Table (Col F-J) ---
      if (r <= spLastRow) {
        // Checking Column F (Opening/Type), H (Between Nozzles), J (Foil to Ceiling)
        const c6 = String(ws.getCell(r, 6).value || "");
        const c8 = String(ws.getCell(r, 8).value || "");
        const c10 = String(ws.getCell(r, 10).value || "");
        maxLines = Math.max(maxLines, estimateWrappedLines(c6, 25)); // width 30
        maxLines = Math.max(maxLines, estimateWrappedLines(c8, 24)); // width 28
        maxLines = Math.max(maxLines, estimateWrappedLines(c10, 16)); // width 18
      }

      // 15pt per line baseline
      row.height = Math.max(15.75, maxLines * 15);
    }

    // final cosmetic vertical dividers on the pipe guidance area
    rightLine(ws, 4, 2, lastPipeRow, "thin"); // right edge of value col D
    rightLine(ws, 2, 2, lastPipeRow, "thin"); // edge after Pipe Runs (B)

    return ws;
  }

  function writeNestedCompleteBOM(
    ws: ExcelJS.Worksheet,
    sysName: string,
    encRows: SimpleRow[],
    zoneRows: SimpleRow[],
    sysSupply: SimpleRow[],
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
    let printedSystem = false;

    // Track merge ranges for Category col (2)
    const catMerges: Array<{ start: number; end: number }> = [];

    const writeGroup = (groupName: string, rows: SimpleRow[]) => {
      if (!rows.length) return;

      const groupStart = ws.lastRow!.number + 1;

      rows.forEach((r, i) => {
        ws.addRow([
          printedSystem ? "" : sysName, // col 1
          i === 0 ? groupName : "", // col 2
          itemNo++,
          r.desc,
          r.qty,
          r.code,
        ]);
        printedSystem = true;
      });

      const groupEnd = ws.lastRow!.number;

      // separator under the group (Category..Partcode)
      bottomLine(ws, groupEnd, 2, 6, "thin");

      // record category merge range (only if >1 row)
      catMerges.push({ start: groupStart, end: groupEnd });
    };

    writeGroup("Enclosure Supply", encRows);
    writeGroup("Zone Supply", zoneRows);
    writeGroup("System Supply", sysSupply);

    const last = ws.lastRow!.number;
    if (last >= firstData) {
      // Merge System Name (col 1) across all printed rows
      mergeVertical(ws, 1, firstData, last, {
        horizontal: "center",
        vertical: "middle",
      });

      // Merge Category (col 2) per-group
      for (const m of catMerges) {
        mergeVertical(ws, 2, m.start, m.end, {
          horizontal: "center",
          vertical: "middle",
        });
        bottomLine(ws, m.end, 2, 6, "thin");
      }

      // outer frame / vertical guides (optional; keep yours)
      bottomLine(ws, last, 1, 6, "thin");
      rightLine(ws, 1, firstData, last, "thin");
      rightLine(ws, 6, firstData, last, "thin");
    }
  }

  function writeNestedEnclosureBOMs(
    ws: ExcelJS.Worksheet,
    sysName: string,
    zones: ZoneInfo[],
    fetchEnclosureLines: (zoneId: string, encId: string) => BomLine[],
    fetchZoneSupplyLines: (zoneId: string) => BomLine[],
    fetchSystemSupplyLines: () => BomLine[],
  ) {
    setColsEnclosure(ws);

    const encBoxes: Array<{ r1: number; r2: number }> = [];
    const zoneBoxes: Array<{ r1: number; r2: number }> = [];

    // Header
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
    bottomLine(ws, 1, 1, 7, "thin"); // keep header underline

    const firstData = ws.lastRow!.number + 1;

    let itemNo = 1;
    let printedSystem = false;

    // Track merges
    const zoneMerges: Array<{ start: number; end: number }> = [];
    const encMerges: Array<{ start: number; end: number }> = [];

    for (const z of zones) {
      const zoneStart = ws.lastRow!.number + 1;
      let zonePrintedAnything = false;
      let printedZone = false;

      // Enclosures
      for (const e of z.enclosures) {
        const encLines = fetchEnclosureLines(z.id, e.id);
        if (!encLines.length) continue;

        const rows = consolidateRows(encLines);
        const encStart = ws.lastRow!.number + 1;

        rows.forEach((r, i) => {
          ws.addRow([
            printedSystem ? "" : sysName,
            printedZone ? "" : z.name,
            i === 0 ? e.name : "",
            itemNo++,
            r.desc,
            r.qty,
            r.code,
          ]);
          printedSystem = true;
          printedZone = true;
          zonePrintedAnything = true;
        });

        const encEnd = ws.lastRow!.number;

        if (encEnd >= encStart) {
          encMerges.push({ start: encStart, end: encEnd });
          encBoxes.push({ r1: encStart, r2: encEnd });
        }
      }

      // Zone Supply pseudo-enclosure
      const zSupplyLines = fetchZoneSupplyLines(z.id);
      if (zSupplyLines.length) {
        const rows = consolidateRows(zSupplyLines);
        const encStart = ws.lastRow!.number + 1;

        rows.forEach((r, i) => {
          ws.addRow([
            printedSystem ? "" : sysName,
            printedZone ? "" : z.name,
            i === 0 ? "Zone Supply" : "",
            itemNo++,
            r.desc,
            r.qty,
            r.code,
          ]);
          printedSystem = true;
          printedZone = true;
          zonePrintedAnything = true;
        });

        const encEnd = ws.lastRow!.number;

        if (encEnd >= encStart) {
          encMerges.push({ start: encStart, end: encEnd });
          encBoxes.push({ r1: encStart, r2: encEnd });
        }
      }

      // Zone range
      if (zonePrintedAnything) {
        const zoneEnd = ws.lastRow!.number;
        zoneMerges.push({ start: zoneStart, end: zoneEnd });
        zoneBoxes.push({ r1: zoneStart, r2: zoneEnd });
      }
    }

    // System Supply pseudo block
    const sysSupplyLines = fetchSystemSupplyLines();
    if (sysSupplyLines.length) {
      const rows = consolidateRows(sysSupplyLines);
      const start = ws.lastRow!.number + 1;

      rows.forEach((r, i) => {
        ws.addRow([
          printedSystem ? "" : sysName,
          i === 0 ? "System Supply" : "",
          "",
          itemNo++,
          r.desc,
          r.qty,
          r.code,
        ]);
        printedSystem = true;
      });

      const end = ws.lastRow!.number;

      mergeBlock(ws, start, 2, end, 3, {
        horizontal: "center",
        vertical: "middle",
      });

      // ✅ IMPORTANT: include this block in the B..G boxing
      encBoxes.push({ r1: start, r2: end });

      // optional: if you want it to behave like a "zone" visually, you could also add:
      // zoneBoxes.push({ r1: start, r2: end });
    }

    const last = ws.lastRow!.number;

    if (last >= firstData) {
      mergeVertical(ws, 1, firstData, last, {
        horizontal: "center",
        vertical: "middle",
      });

      for (const m of zoneMerges) {
        mergeVertical(ws, 2, m.start, m.end, {
          horizontal: "center",
          vertical: "middle",
        });
      }

      for (const m of encMerges) {
        mergeVertical(ws, 3, m.start, m.end, {
          horizontal: "center",
          vertical: "middle",
        });
      }

      // Draw boxes AFTER merges (prevents border breaks)
      for (const b of encBoxes) boxRange(ws, b.r1, 2, b.r2, 7, "thin"); // B..G
      for (const b of zoneBoxes) boxRange(ws, b.r1, 2, b.r2, 7, "thin"); // B..G
      leftLine(ws, 3, firstData, last, "thin"); // divider between Zone (B) and Enclosure (C)

      boxRange(ws, firstData, 1, last, 7, "thin"); // A..G
    }
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
        const wsAll = wb.addWorksheet(
          makeExcelSheetName(sys.sheetName, "Consolidated BOM"),
        );
        // Pass an empty array for Zone Supply so only two groups render
        writeNestedCompleteBOM(
          wsAll,
          sys.name,
          encSupplyRows,
          [],
          sysSupplyRows,
        );
      }
      if (sys.type === "preengineered") {
        writePipeGuidanceSheetImproved(
          wb,
          project,
          collected,
          sys,
          (project.units ?? "imperial") as UnitCtx,
        );
      }

      continue; // skip the detailed sheet for pre-E
    }

    // ENGINEERED: keep your existing two-sheet behavior
    if (encSupplyRows.length || zoneSupplyRows.length || sysSupplyRows.length) {
      const wsAll = wb.addWorksheet(
        makeExcelSheetName(sys.sheetName, "Consolidated BOM"),
      );
      writeNestedCompleteBOM(
        wsAll,
        sys.name,
        encSupplyRows,
        zoneSupplyRows,
        sysSupplyRows,
      );
    }

    const wsEnc = wb.addWorksheet(
      makeExcelSheetName(sys.sheetName, "Detailed BOM"),
    );
    writeNestedEnclosureBOMs(
      wsEnc,
      sys.name,
      sys.zones,
      (zoneId, encId) =>
        sysLines.filter(
          (ln) =>
            ln.level === "ENCLOSURE" &&
            ln.scope.zoneId === zoneId &&
            ln.scope.enclosureId === encId,
        ),
      (zoneId) =>
        sysLines.filter(
          (ln) => ln.level === "ZONE_SUPPLY" && ln.scope.zoneId === zoneId,
        ),
      () => sysLines.filter((ln) => ln.level === "SYSTEM_SUPPLY"),
    );
  }

  writeProjectPrimariesSheet(wb, project);

  /* ─────────────────────────────────────────────────────────
   FACP sheet (grouped by system, boxed per component)
   ───────────────────────────────────────────────────────── */
  const codeForDisplay = (partcode: string, alt?: string) =>
    options.currency === "USD" ? partcode : alt || partcode;

  const facpBySystem = collectFACP(project);
  const sF = wb.addWorksheet("FACP Monitor & Release Points");

  // Main table columns (A..E)
  sF.columns = [
    { header: "System Name", width: 30 }, // A
    { header: "Name of Component", width: 60 }, // B
    { header: "Type of Point", width: 26 }, // C
    { header: "Point Description", width: 40 }, // D
    { header: "Quantity", width: 12 }, // E
  ];

  // We'll reuse small helpers (topLine, leftLineLocal, rightLine) but re-declare where needed:
  const topLineF = (
    row: number,
    c1: number,
    c2: number,
    style: ExcelJS.BorderStyle = "thin",
  ) => {
    for (let c = c1; c <= c2; c++) {
      const cell = sF.getCell(row, c);
      cell.border = { ...(cell.border || {}), top: { style } };
    }
  };
  const leftLineF = (
    col: number,
    r1: number,
    r2: number,
    style: ExcelJS.BorderStyle = "thin",
  ) => {
    for (let r = r1; r <= r2; r++) {
      const cell = sF.getCell(r, col);
      cell.border = { ...(cell.border || {}), left: { style } };
    }
  };
  const rightLineF = (
    col: number,
    r1: number,
    r2: number,
    style: ExcelJS.BorderStyle = "thin",
  ) => {
    for (let r = r1; r <= r2; r++) {
      const cell = sF.getCell(r, col);
      cell.border = { ...(cell.border || {}), right: { style } };
    }
  };
  const bottomLineF = (
    row: number,
    c1: number,
    c2: number,
    style: ExcelJS.BorderStyle = "thin",
  ) => {
    for (let c = c1; c <= c2; c++) {
      const cell = sF.getCell(row, c);
      cell.border = { ...(cell.border || {}), bottom: { style } };
    }
  };

  // Right-side totals table placement (keeps your previous columns)
  const tStartCol = 7; // G
  sF.getColumn(tStartCol - 1).width = 3;
  sF.getColumn(tStartCol + 0).width = 30;
  sF.getColumn(tStartCol + 1).width = 12;
  sF.getColumn(tStartCol + 2).width = 10;
  sF.getColumn(tStartCol + 3).width = 12;

  // We'll print each system separately with its own header and boxed block
  let writeRowCursor = 1; // row we will write next (we start at 1 so header can go at 1)
  let projSup = 0;
  let projAlm = 0;
  let projRel = 0;

  const printableSystems = systems.filter((s) => {
    const b = facpBySystem[s.id];
    return b && b.rows.length;
  });

  for (let sIdx = 0; sIdx < printableSystems.length; sIdx++) {
    const sys = printableSystems[sIdx];
    const block = facpBySystem[sys.id]!;
    const sysDisplay = systemDisplayName[sys.id] ?? block.systemName;

    // If not first system, leave one blank row before the next header

    // (1) Header row for the system (reprinted)
    const hdrRowNum = writeRowCursor;
    sF.getRow(hdrRowNum).values = [
      "System Name",
      "Name of Component",
      "Type of Point",
      "Point Description",
      "Quantity",
    ];
    sF.getRow(hdrRowNum).font = { bold: true };
    for (let c = 1; c <= 5; c++) {
      const cell = sF.getCell(hdrRowNum, c);
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }

    // start data right after header
    let printedSystemOnce = false;
    bottomLineF(hdrRowNum, 1, 5, "thin");

    // Write components -> points
    for (let compIdx = 0; compIdx < block.rows.length; compIdx++) {
      const comp = block.rows[compIdx];
      const compName = descFor(codeForDisplay(comp.partcode, comp.alt), "");

      // record start row for this component (first printed row for its points)
      let compStartRow: number | null = null;

      // print each point for this component
      for (let ptIdx = 0; ptIdx < comp.points.length; ptIdx++) {
        const pt = comp.points[ptIdx];
        const firstOfComp = ptIdx === 0;

        const values = [
          printedSystemOnce ? "" : sysDisplay,
          firstOfComp ? compName : "",
          pt.type,
          pt.description,
          comp.qty,
        ];

        const added = sF.addRow(values);

        // set component start row at the FIRST data row we actually printed
        if (compStartRow == null) compStartRow = added.number;

        for (let c = 1; c <= 5; c++) {
          sF.getCell(added.number, c).alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        }

        printedSystemOnce = true;
        writeRowCursor = added.number + 1;
      }

      const compEndRow = writeRowCursor - 1;

      // box ONLY the data rows (no header row)
      if (compEndRow >= compStartRow) {
        topLineF(compStartRow, 2, 5, "thin"); // line brought DOWN to first data row
        bottomLineF(compEndRow, 2, 5, "thin");
        leftLineF(2, compStartRow, compEndRow, "thin"); // no side borders on header anymore
        rightLineF(5, compStartRow, compEndRow, "thin");
      }
      mergeVertical(sF, 2, compStartRow, compEndRow, {
        horizontal: "left",
        vertical: "middle",
      });

      // after each component we continue to the next; the system-level separator is drawn later
    }

    // dataEnd is last printed data row for this system
    const dataEnd = writeRowCursor - 1;

    // i.e. align to the system header row (hdrRowNum) instead of the last data row.
    const labelRow = hdrRowNum; // align labels with the system header/top
    sF.getCell(labelRow, tStartCol + 0).value = "Point Totals";
    sF.getCell(labelRow, tStartCol + 1).value = "Supervisory";
    sF.getCell(labelRow, tStartCol + 2).value = "Alarm";
    sF.getCell(labelRow, tStartCol + 3).value = "Releasing";
    for (let c = 0; c < 4; c++) {
      const cell = sF.getCell(labelRow, tStartCol + c);
      cell.font = { bold: true };
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }

    // Totals row sits directly below the labels (so it will be hdrRowNum + 1)
    const totalsRow = labelRow + 1;

    // Fill totals (if you want the labels row to be the header and totals immediately below)
    sF.getCell(totalsRow, tStartCol + 0).value = sysDisplay;
    sF.getCell(totalsRow, tStartCol + 1).value = block.totals.supervisory;
    sF.getCell(totalsRow, tStartCol + 2).value = block.totals.alarmPoints;
    sF.getCell(totalsRow, tStartCol + 3).value = block.totals.releasing;
    projSup += Number(block.totals.supervisory || 0);
    projAlm += Number(block.totals.alarmPoints || 0);
    projRel += Number(block.totals.releasing || 0);

    for (let c = 0; c < 4; c++) {
      const cell = sF.getCell(totalsRow, tStartCol + c);
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    }

    // Draw a box around the labels+totals block (rows labelRow..totalsRow, cols G..J)
    topLineF(labelRow + 1, tStartCol, tStartCol + 3, "thin");
    bottomLineF(totalsRow, tStartCol, tStartCol + 3, "thin");
    leftLineF(tStartCol, labelRow + 1, totalsRow, "thin");
    rightLineF(tStartCol + 3, labelRow + 1, totalsRow, "thin");

    // If the system's data rows are shorter than the header area, ensure we don't overlap content:
    // make sure the system data bottom border remains below the dataEnd row (we already drew it).
    // Advance cursor so we leave a blank row between systems (cursor currently totalsRow+1)
    writeRowCursor = Math.max(dataEnd + 1, totalsRow + 1) + 1;
    mergeVertical(sF, 1, hdrRowNum + 1, writeRowCursor - 2, {
      horizontal: "center",
      vertical: "middle",
    });
    bottomLineF(dataEnd, 1, 5, "thin");
  }

  const projHeaderRow = writeRowCursor - 2;
  sF.getCell(projHeaderRow, tStartCol + 0).value = "Point Totals";
  sF.getCell(projHeaderRow, tStartCol + 1).value = "Supervisory";
  sF.getCell(projHeaderRow, tStartCol + 2).value = "Alarm";
  sF.getCell(projHeaderRow, tStartCol + 3).value = "Releasing";
  for (let c = 0; c < 4; c++) {
    const cell = sF.getCell(projHeaderRow, tStartCol + c);
    cell.font = { bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  const projTotalsRow = projHeaderRow + 1;
  sF.getCell(projTotalsRow, tStartCol + 0).value = "Project Totals";
  sF.getCell(projTotalsRow, tStartCol + 1).value = projSup;
  sF.getCell(projTotalsRow, tStartCol + 2).value = projAlm;
  sF.getCell(projTotalsRow, tStartCol + 3).value = projRel;
  for (let c = 0; c < 4; c++) {
    const cell = sF.getCell(projTotalsRow, tStartCol + c);
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  // Box the project totals (header + totals)
  topLineF(projHeaderRow + 1, tStartCol, tStartCol + 3, "thin");
  bottomLineF(projTotalsRow, tStartCol, tStartCol + 3, "thin");
  leftLineF(tStartCol, projTotalsRow, projTotalsRow, "thin");
  rightLineF(tStartCol + 3, projTotalsRow, projTotalsRow, "thin");

  // advance cursor after the totals block
  writeRowCursor = projTotalsRow + 2;

  // End of per-system printing
  return wb;
}
