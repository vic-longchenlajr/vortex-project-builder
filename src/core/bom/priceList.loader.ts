// src/core/bom/priceList.loader.ts
const LOCAL_REL = "database/victaulic-vortex-pricelist.xlsx";

export async function loadPriceListBytes(url?: string): Promise<Uint8Array> {
  if (typeof window !== "undefined" && (window as any).vortex) {
    const vtx = (window as any).vortex as {
      httpGetBytes?: (u: string) => Promise<Uint8Array>;
      readResourceAsUint8?: (p: string) => Promise<Uint8Array>;
    };

    if (url && vtx.httpGetBytes) {
      try {
        const nocache = `${url}${url.includes("?") ? "&" : "?"}nocache=${Date.now()}`;
        return await vtx.httpGetBytes(nocache);
      } catch {
        /* fall back */
      }
    }
    return await vtx.readResourceAsUint8!(LOCAL_REL);
  }

  // Web (non-Electron) fallback
  if (url) {
    const nocache = `${url}${url.includes("?") ? "&" : "?"}nocache=${Date.now()}`;
    const res = await fetch(nocache);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const resp = await fetch("/database/victaulic-vortex-pricelist-2025.xlsx");
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}
