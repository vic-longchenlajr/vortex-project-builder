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
