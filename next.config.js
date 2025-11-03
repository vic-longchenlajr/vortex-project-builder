// next.config.js
module.exports = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  assetPrefix: "/", // root-absolute assets
};
