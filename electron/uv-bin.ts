/**
 * Resolve the uv binary: packaged copy in resources/bin (fetched at package
 * time by scripts/fetch-uv.mjs) when it exists, otherwise `uv` from PATH
 * (development machines). Pure name mapping kept separate for testing.
 */
import fs from "node:fs";
import path from "node:path";

const NAMES: Record<string, Record<string, string>> = {
  darwin: { arm64: "uv-aarch64-apple-darwin", x64: "uv-x86_64-apple-darwin" },
  win32: { x64: "uv-x86_64-pc-windows-msvc.exe" },
  linux: { x64: "uv-x86_64-unknown-linux-gnu" },
};

export function uvBinaryName(platform: string, arch: string): string {
  return NAMES[platform]?.[arch] ?? "uv";
}

export function resolveUv(binDir: string): string {
  const name = uvBinaryName(process.platform, process.arch);
  if (name === "uv") return "uv"; // unsupported combo: rely on PATH (dev)
  const packaged = path.join(binDir, name);
  return fs.existsSync(packaged) ? packaged : "uv"; // dev: repo has no resources/bin
}
