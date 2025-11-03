// .desktop/preload.ts
import { contextBridge, ipcRenderer } from "electron";

// Base64 helpers via Node Buffer (reliable in preload)
function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
function toBase64(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64");
}

contextBridge.exposeInMainWorld("vortex", {
  openFile: (filters?: Array<{ name: string; extensions: string[] }>) =>
    ipcRenderer.invoke("vortex:open-file", { filters }),

  saveFile: (
    defaultName?: string,
    filters?: Array<{ name: string; extensions: string[] }>
  ) => ipcRenderer.invoke("vortex:save-file", { defaultName, filters }),

  readFileAsUint8: async (path: string): Promise<Uint8Array> =>
    fromBase64(await ipcRenderer.invoke("vortex:read-file", path)),

  writeFileFromUint8: async (
    path: string,
    data: Uint8Array
  ): Promise<boolean> =>
    ipcRenderer.invoke("vortex:write-file", {
      path,
      dataBase64: toBase64(data),
    }),

  readResourceAsUint8: async (relPath: string): Promise<Uint8Array> =>
    fromBase64(await ipcRenderer.invoke("vortex:read-resource", relPath)),

  // Main-process network fetch (no CORS in renderer)
  httpGetBytes: async (url: string): Promise<Uint8Array> =>
    fromBase64(await ipcRenderer.invoke("vortex:http-get-bytes", url)),
});

// If you keep the global typing here, make the file a module:
declare global {
  interface Window {
    vortex?: {
      openFile(
        filters?: Array<{ name: string; extensions: string[] }>
      ): Promise<string | null>;
      saveFile(
        defaultName?: string,
        filters?: Array<{ name: string; extensions: string[] }>
      ): Promise<string | null>;
      readFileAsUint8(path: string): Promise<Uint8Array>;
      writeFileFromUint8(path: string, data: Uint8Array): Promise<boolean>;
      readResourceAsUint8(relPath: string): Promise<Uint8Array>;
      httpGetBytes(url: string): Promise<Uint8Array>;
    };
  }
}
export {};
