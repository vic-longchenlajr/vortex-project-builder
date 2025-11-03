// src/core/bom/priceList.ts
import ExcelJS from "exceljs";
import type { PriceIndex, PriceRow } from "./types";
import { loadPriceListBytes } from "./priceList.loader";

const DEFAULT_SHEET = "Configurator";
const DEFAULT_URL =
  "https://vortex-bom.victaulicmobile.com/us-config/price-lists/victaulic-vortex-pricelist-2025.xlsx";

function coerceNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x.replace(/[^0-9.]/g, ""));
  return 0;
}

export async function fetchPriceIndex(
  url = DEFAULT_URL,
  exceptions?: any[]
): Promise<PriceIndex> {
  const bytes = await loadPriceListBytes(url);

  const wb = new ExcelJS.Workbook();
  const tightAb: ArrayBuffer = bytes.slice(0).buffer; // guaranteed ArrayBuffer
  await wb.xlsx.load(tightAb as any);
  const ws =
    wb.worksheets.find((s) => s.name === DEFAULT_SHEET) ?? wb.worksheets[0];

  const rows: PriceRow[] = [];
  ws.eachRow((row, idx) => {
    const v = row.values as any[];
    if (idx === 1) return;
    const description = (v[1] ?? v[2] ?? "").toString().trim();
    const bpcs = (v[2] ?? v[3] ?? "").toString().trim();
    const m3 = (v[3] ?? v[4] ?? "").toString().trim();
    const listPrice = coerceNumber(v[4] ?? v[5] ?? 0);
    if (!description || (!bpcs && !m3)) return;
    rows.push({ description, bpcs, m3, listPrice });
  });

  const idx: PriceIndex = {};
  for (const r of rows) {
    const entry = {
      description: r.description,
      bpcs: r.bpcs,
      m3: r.m3,
      listPrice: r.listPrice,
    };
    if (r.bpcs) idx[r.bpcs] = entry;
    if (r.m3) idx[r.m3] = entry;
  }

  if (Array.isArray(exceptions)) {
    for (const ex of exceptions) {
      const description = ex?.[1]?.[0] ?? "";
      const bpcs = ex?.[2]?.[0] ?? "";
      const m3 = ex?.[3]?.[0] ?? "";
      const price = Number(ex?.[4]?.[0] ?? 0);
      if (!description || (!bpcs && !m3)) continue;
      const entry = { description, bpcs, m3, listPrice: price };
      if (bpcs) idx[bpcs] = entry;
      if (m3) idx[m3] = entry;
    }
  }

  return idx;
}
