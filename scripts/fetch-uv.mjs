#!/usr/bin/env node
/**
 * Fetch the uv single-file binary into resources/bin/ for packaging.
 *
 * uv (github.com/astral-sh/uv, MIT/Apache-2.0) creates the first-run venv on
 * a uv-managed CPython, removing any system-Python requirement. One static
 * binary per target; each download is verified against the release's
 * companion .sha256 file. CI runs this per-OS (app-hq `sidecar-command`)
 * before electron-builder packs resources/bin into the installers.
 *
 * Usage:
 *   node scripts/fetch-uv.mjs          # this OS (macOS: both arches)
 *   node scripts/fetch-uv.mjs --all    # every target (local full packaging)
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const UV_VERSION = "0.13.9";
const BASE = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;

// target -> release asset + the on-disk name the runtime looks for
const ASSETS = {
  "darwin-arm64": { archive: "uv-aarch64-apple-darwin.tar.gz", bin: "uv-aarch64-apple-darwin" },
  "darwin-x64": { archive: "uv-x86_64-apple-darwin.tar.gz", bin: "uv-x86_64-apple-darwin" },
  "win32-x64": { archive: "uv-x86_64-pc-windows-msvc.zip", bin: "uv-x86_64-pc-windows-msvc.exe" },
  "linux-x64": { archive: "uv-x86_64-unknown-linux-gnu.tar.gz", bin: "uv-x86_64-unknown-linux-gnu" },
};

const OUT_DIR = path.resolve(import.meta.dirname, "..", "resources", "bin");

function targets() {
  if (process.argv.includes("--all")) return Object.keys(ASSETS);
  // macOS installers are built for both arches from one job -> ship both.
  if (process.platform === "darwin") return ["darwin-arm64", "darwin-x64"];
  const key = `${process.platform}-${process.arch}`;
  return ASSETS[key] ? [key] : [];
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) return reject(new Error(`too many redirects: ${url}`));
        return resolve(fetchBuffer(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (res.statusCode >= 400) return reject(new Error(`download ${res.statusCode}: ${url}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function findBinary(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(full);
      if (found) return found;
    } else if (entry.name === "uv" || entry.name === "uv.exe") {
      return full;
    }
  }
  return null;
}

async function fetchTarget(target) {
  const { archive, bin } = ASSETS[target];
  const archivePath = path.join(os.tmpdir(), archive);
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "uv-fetch-"));

  process.stdout.write(`[fetch-uv] ${archive} … `);
  fs.writeFileSync(archivePath, await fetchBuffer(`${BASE}/${archive}`));

  const expected = (await fetchBuffer(`${BASE}/${archive}.sha256`))
    .toString()
    .trim()
    .split(/\s+/)[0];
  const actual = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${archive}: expected ${expected}, got ${actual}`);
  }

  // bsdtar (macOS/Windows/Linux CI) handles both .tar.gz and .zip.
  const extracted = spawnSync("tar", ["-xf", archivePath, "-C", extractDir]);
  if (extracted.status !== 0) throw new Error(`tar failed: ${extracted.stderr}`);

  const binary = findBinary(extractDir);
  if (!binary) throw new Error(`no uv binary found inside ${archive}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, bin);
  fs.copyFileSync(binary, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`ok -> ${path.relative(process.cwd(), dest)}`);

  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.rmSync(archivePath, { force: true });
}

const wanted = targets();
if (wanted.length === 0) {
  console.error(`[fetch-uv] unsupported platform ${process.platform}-${process.arch}; use --all`);
  process.exit(1);
}
for (const target of wanted) {
  await fetchTarget(target); // sequential: keep CI logs readable
}
console.log(`[fetch-uv] uv ${UV_VERSION} ready in ${path.relative(process.cwd(), OUT_DIR)}/`);
