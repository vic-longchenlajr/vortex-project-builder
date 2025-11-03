// src/core/io/file-bridge.ts
export async function saveTextFileSmart(
  defaultName: string,
  contents: string,
  opts?: { filterJson?: boolean }
): Promise<boolean> {
  if (typeof window !== "undefined" && window.vortex?.saveFile) {
    const filters = opts?.filterJson
      ? [{ name: "JSON", extensions: ["json"] }]
      : [];
    const target = await window.vortex.saveFile(defaultName, filters);
    if (!target) return false;
    const bytes = new TextEncoder().encode(contents);
    return window.vortex.writeFileFromUint8(target, bytes);
  }
  // web fallback
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function openTextFileSmart(opts?: {
  filterJson?: boolean;
}): Promise<string | null> {
  if (typeof window !== "undefined" && window.vortex?.openFile) {
    const filters = opts?.filterJson
      ? [{ name: "JSON", extensions: ["json"] }]
      : [];
    const path = await window.vortex.openFile(filters);
    if (!path) return null;
    const bytes = await window.vortex.readFileAsUint8(path);
    return new TextDecoder().decode(bytes);
  }
  return null; // caller can fall back to <input type=file>
}

export async function saveBinaryFileSmart(
  defaultName: string,
  data: Uint8Array,
  opts?: { filterXlsx?: boolean }
): Promise<boolean> {
  if (typeof window !== "undefined" && window.vortex?.saveFile) {
    const filters = opts?.filterXlsx
      ? [{ name: "Excel Workbook", extensions: ["xlsx"] }]
      : [];
    const target = await window.vortex.saveFile(defaultName, filters);
    if (!target) return false;
    return window.vortex.writeFileFromUint8(target, data);
  }
  return false; // let caller fall back to FileSaver
}

declare global {
  interface Window {
    vortex?: {
      openFile: (
        filters?: Array<{ name: string; extensions: string[] }>
      ) => Promise<string | null>;
      saveFile: (
        defaultName?: string,
        filters?: Array<{ name: string; extensions: string[] }>
      ) => Promise<string | null>;
      readFileAsUint8: (path: string) => Promise<Uint8Array>;
      writeFileFromUint8: (path: string, data: Uint8Array) => Promise<boolean>;
      readResourceAsUint8: (relPath: string) => Promise<Uint8Array>;
    };
  }
}
