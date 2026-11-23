/**
 * First-run setup — no system Python required:
 *   1. use the bundled uv (resources/bin, fetched at package time) to create
 *      an app-local venv on a uv-managed CPython (UV_PYTHON_INSTALL_DIR under
 *      userData; UV_PYTHON_PREFERENCE=only-managed keeps us off whatever
 *      Python, if any, the student has installed)
 *   2. uv pip install the sidecar stack from PyPI
 *   3. drop a sentinel so subsequent launches skip straight to starting.
 * Progress lines are emitted via `onLog` for the first-run modal.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { resolveUv } from "./uv-bin";

export interface FirstRunPaths {
  runtimeDir: string; // app-local: holds the venv + managed python + sentinel
  binDir: string; // packaged uv binaries (resources/bin); dev falls back to PATH
}

export function venvDir(p: FirstRunPaths): string {
  return path.join(p.runtimeDir, "venv");
}

function venvPython(p: FirstRunPaths): string {
  return process.platform === "win32"
    ? path.join(venvDir(p), "Scripts", "python.exe")
    : path.join(venvDir(p), "bin", "python");
}

function sentinel(p: FirstRunPaths): string {
  return path.join(p.runtimeDir, ".installed");
}

export function isInstalled(p: FirstRunPaths): boolean {
  return fs.existsSync(sentinel(p));
}

function run(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onLog: (s: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", (b) => onLog(b.toString().trimEnd()));
    proc.stderr.on("data", (b) => onLog(b.toString().trimEnd()));
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

function uvEnv(p: FirstRunPaths): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Hermetic: always a uv-managed CPython under runtimeDir — never a
    // student's system interpreter (which may be missing, old, or broken).
    UV_PYTHON_INSTALL_DIR: path.join(p.runtimeDir, "python"),
    UV_PYTHON_PREFERENCE: "only-managed",
  };
}

/** Install extra pip specs into the existing sidecar venv (e.g. the audio
 *  pack, on demand). Streams progress via onLog. */
export function installSpecs(
  p: FirstRunPaths,
  pipSpecs: string[],
  onLog: (s: string) => void,
): Promise<void> {
  const uv = resolveUv(p.binDir);
  return run(uv, ["pip", "install", "-p", venvPython(p), ...pipSpecs], uvEnv(p), onLog);
}

export async function runFirstRun(
  p: FirstRunPaths,
  pipSpecs: string[],
  pythonVersion: string,
  onLog: (s: string) => void,
): Promise<void> {
  fs.mkdirSync(p.runtimeDir, { recursive: true });
  const uv = resolveUv(p.binDir);
  const env = uvEnv(p);

  onLog("[setup] preparing the feedback engine (first run only)…");
  if (!fs.existsSync(venvPython(p))) {
    onLog(`[setup] installing a private Python ${pythonVersion} (no system Python needed)`);
    await run(uv, ["venv", venvDir(p), "--python", pythonVersion], env, onLog);
  }
  onLog(`[setup] installing ${pipSpecs.join(" ")}`);
  await run(uv, ["pip", "install", "-p", venvPython(p), ...pipSpecs], env, onLog);

  fs.writeFileSync(sentinel(p), new Date().toISOString());
  onLog("[setup] done — the engine is ready.");
}
