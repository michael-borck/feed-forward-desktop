#!/usr/bin/env node
/**
 * Full-stack E2E smoke (Playwright _electron): launches the built app with a
 * throwaway profile (FFD_TEST_USER_DATA), lets the real first-run install the
 * engine (bundled uv -> managed CPython -> feedforward-practice from PyPI),
 * then drives one feedback run against the mock OpenAI endpoint
 * (scripts/mock_openai.py) and asserts the result view renders.
 *
 * This is the layer that verifies renderer sandboxing, the preload bridge,
 * the uv first-run path, and the whole IPC/proxy chain in one pass.
 *
 * Usage: npm run e2e   (builds first; needs `npm run fetch:uv` once)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { _electron as electron } from "playwright";

const MOCK_PORT = 8488;
const here = import.meta.dirname;
const root = path.resolve(here, "..");

const RUBRIC = {
  formatVersion: "1.0",
  kind: "ffrubric",
  assignment: { title: "Essay 1 - Critical Analysis", description: "E2E" },
  rubric: {
    categories: [
      { name: "Argument", description: "Thesis quality", weight: 40 },
      { name: "Evidence", description: "Use of sources", weight: 60 },
    ],
  },
};

const fail = (msg) => {
  console.error(`E2E FAIL: ${msg}`);
  process.exitCode = 1;
};

const mock = spawn("python3", [path.join(here, "mock_openai.py"), String(MOCK_PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
});
mock.stdout.on("data", (b) => process.stdout.write(`[mock] ${b}`));

const userData = fs.mkdtempSync(path.join(os.tmpdir(), "ffd-e2e-"));
let app;
const pageErrors = [];

try {
  // Some harnesses export ELECTRON_RUN_AS_NODE=1, which forces Electron into
  // plain-node mode and crashes the app — always strip it for the launch.
  const env = { ...process.env, FFD_TEST_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    args: [root], // repo root as app path: dev layout, resources/bin visible
    env,
  });
  const page = await app.firstWindow();
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // 1. First run: uv installs managed CPython + the engine (can take minutes).
  await page.waitForSelector("text=Engine ready", { timeout: 600_000 });
  console.log("[e2e] engine ready (first-run install complete)");

  // 2. Point the provider at the mock endpoint.
  await page.fill('input[placeholder="https://your-server.example/v1"]', `http://127.0.0.1:${MOCK_PORT}/v1`);
  await page.fill('input[placeholder="llama3.2:3b"]', "mock-model");

  // 3. Rubric + draft.
  await page.setInputFiles('input[accept=".ffrubric,.json"]', {
    name: "sample.ffrubric",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(RUBRIC)),
  });
  await page.waitForSelector("text=Essay 1 - Critical Analysis");
  await page.fill(
    "textarea",
    "A draft with a clear thesis and some analysed evidence for the E2E run.",
  );

  // 4. Run and wait for the aggregated level (0.4*82 + 0.6*74 = 77.2 -> band).
  await page.click('button:has-text("Get practice feedback")');
  await page.waitForSelector('h2:has-text("On the board")', { timeout: 60_000 });
  console.log("[e2e] feedback rendered — level 'On the board'");

  if (pageErrors.length > 0) {
    fail(`renderer threw: ${pageErrors.join(" | ")}`);
  } else {
    console.log("E2E PASS");
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  try {
    await app?.close();
  } catch {
    /* ignore */
  }
  mock.kill();
  fs.rmSync(userData, { recursive: true, force: true });
}
