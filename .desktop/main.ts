// .desktop/main.ts
import { app, BrowserWindow, ipcMain, dialog, protocol } from "electron";
import { join, resolve as resolvePath } from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";
import { Buffer } from "node:buffer";

let win: BrowserWindow | null = null;
const isPackaged = app.isPackaged;

/* ───────── helpers ───────── */

function outRoot(): string {
  return isPackaged
    ? join(process.resourcesPath, "out") // packaged: resources/out
    : resolvePath(process.cwd(), "out"); // dev: <project>/out
}

function getDownloads(): string {
  return join(os.homedir(), "Downloads");
}

function resolveResource(relPath: string): string {
  // For things you bundled under resources (e.g., database/*.xlsx)
  return isPackaged
    ? join(process.resourcesPath, relPath)
    : resolvePath(process.cwd(), "public", relPath);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "vtx",
    privileges: {
      standard: true, // gives it an origin like https
      secure: true, // treat as secure
      supportFetchAPI: true, // fetch() works
      corsEnabled: true, // CORS checks apply (same as https)
      allowServiceWorkers: true,
      stream: true,
    },
  },
]);

app.whenReady().then(async () => {
  // 1) Register vtx://app/... -> <out>/<...>
  protocol.registerFileProtocol("vtx", (request, callback) => {
    try {
      const url = new URL(request.url); // e.g., vtx://app/configurator/
      const host = url.host; // "app"
      let pathname = decodeURIComponent(url.pathname); // "/configurator/" or "/_next/..." or "/"
      if (host !== "app") {
        // Unknown host: fall back to root
        pathname = "/index.html";
      } else {
        if (pathname === "/" || pathname === "") pathname = "/index.html";
        // If request ends with /, serve the folder's index.html
        if (pathname.endsWith("/")) pathname += "index.html";
      }
      const filePath = join(outRoot(), pathname);
      callback({ path: filePath });
    } catch (e) {
      console.error("vtx protocol error:", e);
      callback({ path: join(outRoot(), "index.html") });
    }
  });

  // 2) Create window
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  // 3) Load virtual root
  try {
    await fs.access(join(outRoot(), "index.html")); // helpful dev check
    await win.loadURL("vtx://app/"); // <-- root, not index.html
  } catch (err) {
    console.error("Failed to load app:", err);
    const hint = encodeURIComponent(
      `Failed to load static export. Did you run "next build"?\n` +
        `Expected: ${join(outRoot(), "index.html")}\n\n` +
        `Error: ${String((err as Error)?.message || err)}`
    );
    await win.loadURL(`data:text/plain;charset=utf-8,${hint}`);
  }

  win.on("closed", () => (win = null));
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    win = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        preload: join(__dirname, "preload.js"),
        contextIsolation: true,
        sandbox: true,
      },
    });
    void win.loadURL("vtx://app/");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ───────── IPC: dialogs & file I/O ───────── */

ipcMain.handle(
  "vortex:open-file",
  async (_evt, { filters } = { filters: [] }) => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters,
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  }
);

ipcMain.handle(
  "vortex:save-file",
  async (_evt, { defaultName, filters } = {}) => {
    const res = await dialog.showSaveDialog({
      defaultPath: join(getDownloads(), defaultName ?? "vortex-export.json"),
      filters,
    });
    if (res.canceled || !res.filePath) return null;
    return res.filePath;
  }
);

ipcMain.handle("vortex:read-file", async (_evt, filePath: string) => {
  const buf = await fs.readFile(filePath);
  return Buffer.from(buf).toString("base64");
});

ipcMain.handle(
  "vortex:write-file",
  async (_evt, { path, dataBase64 }: { path: string; dataBase64: string }) => {
    const buf = Buffer.from(dataBase64, "base64");
    await fs.writeFile(path, buf);
    return true;
  }
);

// packaged/dev resource reader (price list, etc.)
ipcMain.handle("vortex:read-resource", async (_evt, relPath: string) => {
  const abs = resolveResource(relPath);
  const buf = await fs.readFile(abs);
  return Buffer.from(buf).toString("base64");
});

ipcMain.handle("vortex:http-get-bytes", async (_evt, url: string) => {
  // Prefer global fetch if available (Electron 20+)
  const g: any = globalThis as any;
  if (typeof g.fetch === "function") {
    const res = await g.fetch(url); // redirect defaults to "follow"
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab).toString("base64");
  }

  // Fallback: Node http/https
  const isHttps = url.startsWith("https:");
  const mod = await (isHttps ? import("node:https") : import("node:http"));

  return await new Promise<string>((resolve, reject) => {
    const req = mod.request(url, (res: any) => {
      // follow simple 3xx redirects once
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // recurse once (no infinite loops)
        g.fetch
          ? g.fetch(res.headers.location).then(async (r: any) => {
              if (!r.ok) reject(new Error(`HTTP ${r.status}`));
              const ab = await r.arrayBuffer();
              resolve(Buffer.from(ab).toString("base64"));
            })
          : mod
              .request(res.headers.location, (res2: any) => {
                const chunks: Buffer[] = [];
                res2.on("data", (d: any) =>
                  chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d))
                );
                res2.on("end", () =>
                  resolve(Buffer.concat(chunks).toString("base64"))
                );
                res2.on("error", reject);
              })
              .end();
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (d: any) =>
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d))
      );
      res.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
});
