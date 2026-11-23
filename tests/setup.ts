import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type { LensBridge, SidecarStatus } from "../global";

// vitest's jsdom environment populates globals from the jsdom window but (with
// jsdom 25) does not hoist `localStorage` — expose the window's instance, or a
// minimal shim if absent.
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  const fromWindow = (window as unknown as { localStorage?: Storage }).localStorage;
  (globalThis as { localStorage: Storage }).localStorage =
    fromWindow ??
    ({
      store: new Map<string, string>(),
      getItem(k) {
        return this.store.has(k) ? this.store.get(k)! : null;
      },
      setItem(k, v) {
        this.store.set(k, String(v));
      },
      removeItem(k) {
        this.store.delete(k);
      },
      clear() {
        this.store.clear();
      },
      key(i) {
        return [...this.store.keys()][i] ?? null;
      },
      get length() {
        return this.store.size;
      },
    } as Storage);
}

// Minimal window.lens preload-bridge mock. Individual tests override return
// values (vi.mocked) and assert calls; mock state resets after each test.
const lens: LensBridge = {
  config: vi.fn(async () => ({
    productName: "FeedForward Desktop",
    ollama: { recommendedModel: "llama3.2:3b", recommendedSizeGB: 2.0 },
  })),
  sidecarStatus: vi.fn(async (): Promise<SidecarStatus> => ({ phase: "ready", url: "http://127.0.0.1:8022" })),
  onSidecarStatus: vi.fn(() => () => {}),
  onSidecarLog: vi.fn(() => () => {}),
  api: vi.fn(async () => ({ status: 200, body: {} })),
  pickDir: vi.fn(async () => null),
  pickFile: vi.fn(async () => null),
  onSetupPhase: vi.fn(() => () => {}),
  onSetupLog: vi.fn(() => () => {}),
  onSetupError: vi.fn(() => () => {}),
  ollamaDetect: vi.fn(async () => ({ running: false, models: [] })),
  ollamaPull: vi.fn(async () => {}),
  onOllamaProgress: vi.fn(() => () => {}),
  audioEnsure: vi.fn(async () => "http://127.0.0.1:8025"),
  onAudioLog: vi.fn(() => () => {}),
  setSecret: vi.fn(async (_key: string, _value: string) => true),
  getSecret: vi.fn(async (_key: string) => null),
};

(window as unknown as { lens: typeof lens }).lens = lens;

// Without globals:true, @testing-library/react cannot register its own
// auto-cleanup — do it explicitly so DOM never leaks between tests.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

export { lens };
