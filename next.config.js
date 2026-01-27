// next.config.js

const pkg = require("./package.json");

module.exports = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  assetPrefix: "/", // root-absolute assets
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};
