// src/core/io/project-io.ts
/**
 * Export / Import helpers for the configurator.
 * - Versioned snapshot for forward-compat
 * - Small schema guardrails
 * - File download/upload helpers
 */

export type SnapshotV1 = {
  __kind: "victaulic-vortex-config";
  version: 1;
  exportedAt: string; // ISO
  app: { name: "Configurator"; build?: string };
  project: any; // your full project state (safe to keep as `any` here)
};

export type AnySnapshot = SnapshotV1;

export function makeSnapshotV1(project: any): SnapshotV1 {
  return {
    __kind: "victaulic-vortex-config",
    version: 1,
    exportedAt: new Date().toISOString(),
    app: { name: "Configurator" },
    project,
  };
}

export function isSnapshotV1(x: any): x is SnapshotV1 {
  return (
    x &&
    x.__kind === "victaulic-vortex-config" &&
    x.version === 1 &&
    typeof x.exportedAt === "string" &&
    x.app?.name === "Configurator" &&
    typeof x.project !== "undefined"
  );
}

export function parseSnapshot(json: string): AnySnapshot {
  const data = JSON.parse(json);
  if (isSnapshotV1(data)) return data;
  throw new Error("Unrecognized or incompatible project file.");
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}
