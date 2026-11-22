// FeedForward Desktop — the single per-app customization point for the
// lens-desktop shell. The sidecar is the feedforward-practice engine
// (github.com/michael-borck/feed-forward, practice/), installed into an
// app-local venv on first run.
module.exports = {
  appId: "com.michaelborck.feedforward",
  productName: "FeedForward Desktop",

  // --- Python sidecar (feedforward-practice serve) ---------------------------
  sidecarPipSpecs: ["feedforward-practice[serve,documents]==0.4.0"],
  serveCommand: "feedforward-practice serve --port {PORT} --host {HOST}",
  healthPath: "/health",
  defaultPort: 8022,
  authTokenEnv: "FEEDFORWARD_PRACTICE_AUTH_TOKEN",

  // --- Objective signals (document-analyser sidecar) -------------------------
  // A second localhost engine: readability/structure measures from the
  // document-analyser are added to the feedback prompt as context ("signals
  // are evidence alongside the LLM, never a score" — family rule, ADR 012).
  // The analyser degrades gracefully: unreachable means no signals, feedback
  // still runs. Flip enabled:false to skip the extra first-run download.
  signals: {
    enabled: true,
    pipSpec: "document-analyser==0.10.0",
    serveCommand: "document-analyser serve --port {PORT} --host {HOST}",
    healthPath: "/health",
    defaultPort: 8023,
  },
  // Provider (endpoint/key/model) is chosen in the UI per request, not forced
  // via env — students may use local Ollama, a remote Ollama behind a bearer
  // proxy, or their own key on any OpenAI-compatible endpoint.
  sidecarEnv: {},

  // Managed CPython the bundled uv installs into userData/runtime on first
  // run (UV_PYTHON_PREFERENCE=only-managed) — no system Python required.
  // 3.13 matches the interpreter the engine is tested against.
  python: "3.13",

  // --- Local LLM (Ollama) ----------------------------------------------------
  ollama: {
    recommendedModel: "llama3.2:3b",
    recommendedSizeGB: 2.0,
  },
};
