import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Renderer/unit tests only — the sidecar E2E lives in scripts/smoke-sidecar.sh.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // macOS AppleDouble twins (._foo) appear on some external volumes.
    exclude: ["**/node_modules/**", "**/._*"],
    setupFiles: ["./tests/setup.ts"],
  },
});
