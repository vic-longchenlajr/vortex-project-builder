// src/core/bom/priceList.ts
import ExcelJS from "exceljs";
import type { PriceIndex, PriceRow } from "./types";
import { loadPriceListBytes } from "@/core/bom/priceList.localloader";

const DEFAULT_SHEET = "Configurator";
const DEFAULT_URL =
  "https://vortex-bom.victaulicmobile.com/us-config/price-lists/victaulic-vortex-pricelist-2025.xlsx";

function coerceNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x.replace(/[^0-9.]/g, ""));
  return 0;
}

export async function fetchPriceIndex(url = DEFAULT_URL): Promise<PriceIndex> {
  const bytes = await loadPriceListBytes();

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

  return idx;
}
