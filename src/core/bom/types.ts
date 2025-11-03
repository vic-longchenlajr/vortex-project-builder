export type PriceRow = {
  description: string;
  bpcs: string; // “BPCS Partcode” (US)
  m3: string; // “M3 Partcode” (EU/ROW)
  listPrice: number;
};

export type PriceIndexEntry = {
  description: string;
  bpcs: string;
  m3: string;
  listPrice: number;
};

// Both BPCS and M3 codes resolve to the same entry
export type PriceIndex = Record<string, PriceIndexEntry>;

export type BomLine = {
  partcode: string; // BPCS or M3 (whatever you keyed with when adding)
  alt?: string; // opposite code (for reference)
  description?: string; // filled from PriceIndex
  qty: number;
  listPrice?: number; // filled from PriceIndex
  ext?: number; // qty * listPrice
  scope:
    | "supply"
    | {
        zoneId: string;
        zoneName: string;
        enclosureId?: string;
        enclosureName?: string;
      };
};

export type BomMap = Map<string, BomLine>; // key = `${scopeKey}::${partcode}`

export type EngineeredBomBySystem = Record<
  string,
  { systemName: string; bom: BomMap }
>;
