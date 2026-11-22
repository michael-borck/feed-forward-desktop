// Packaging — the family's shared electron-builder shape (document-lens /
// talk-buddy / career-compass are identical): mac dmg+zip universal, win nsis,
// linux AppImage+deb, custom notarize hook, GitHub publish. appId/productName
// come from app.config.cjs so there's one source of truth.
const app = require("./app.config.cjs");

module.exports = {
  appId: app.appId,
  productName: app.productName,
  directories: { output: "release" },
  compression: "maximum",
  files: ["out/**/*", "package.json"],
  // The uv binaries (fetched at CI time by scripts/fetch-uv.mjs) ride along
  // as resources/bin; first-run uses them to build the sidecar venv on a
  // uv-managed CPython, so the app needs no system Python.
  extraResources: [{ from: "resources/bin", to: "bin", filter: ["**/*", "!**/._*"] }],
  afterSign: "scripts/notarize.js",
  publish: { provider: "github", owner: "michael-borck", repo: "feed-forward-desktop" },

  mac: {
    category: "public.app-category.education",
    hardenedRuntime: true,
    notarize: false, // handled by the afterSign hook (avoids the buggy wrapper)
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] }, // zip required for electron-updater
    ],
  },
  win: { target: [{ target: "nsis", arch: ["x64"] }] },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
  linux: {
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    category: "Education",
    // deb: libsecret for safeStorage (OS keychain) if the app stores cloud keys.
    desktop: { entry: { Categories: "Education;" } },
  },
};
