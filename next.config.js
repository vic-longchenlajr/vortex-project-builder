// next.config.js

const pkg = require("./package.json");

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isGitHubPages ? "/vortex-project-builder" : "";

module.exports = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  assetPrefix: basePath ? `${basePath}/` : "/",
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};
