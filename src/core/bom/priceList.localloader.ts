// src/core/bom/pricelist.localloader.ts

const LOCAL_PRICE_LIST_PATH = "/database/victaulic-vortex-pricelist.xlsx";

/**
 * Load the Vortex price list from the locally bundled database.
 * This is the authoritative source for pricing in the builder.
 */
export async function loadPriceListBytes(): Promise<Uint8Array> {
  const res = await fetch(LOCAL_PRICE_LIST_PATH);

  if (!res.ok) {
    throw new Error(
      `Failed to load local price list (${res.status}) at ${LOCAL_PRICE_LIST_PATH}`
    );
  }

  return new Uint8Array(await res.arrayBuffer());
}
