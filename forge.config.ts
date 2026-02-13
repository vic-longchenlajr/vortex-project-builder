// forge.config.ts
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // ✅ use string paths; they get copied into <resources> with the same folder names
    extraResource: [
      "./out", // will end up as: <resources>/out
      "./public/database", // will end up as: <resources>/database
    ],
    icon: "./public/vx.ico",
  },
  makers: [
    new MakerSquirrel({
      name: "VictaulicVortexProjectBuilder",
      setupExe: "Victaulic-Vortex-Project-Builder-Setup.exe",
    }),
  ],
};

export default config;
