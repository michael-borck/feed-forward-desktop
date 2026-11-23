// FeedForward Desktop — the single per-app customization point for the
// lens-desktop shell. The sidecar is the feedforward-practice engine
// (github.com/michael-borck/feed-forward, practice/), installed into an
// app-local venv on first run.
module.exports = {
  appId: "com.michaelborck.feedforward",
  productName: "FeedForward Desktop",

  // --- Python sidecar (feedforward-practice serve) ---------------------------
  sidecarPipSpecs: ["feedforward-practice[serve,documents]==0.7.0"],
  serveCommand: "feedforward-practice serve --port {PORT} --host {HOST}",
  healthPath: "/health",
  defaultPort: 8022,
  authTokenEnv: "FEEDFORWARD_PRACTICE_AUTH_TOKEN",

  // --- Objective signals (lens analyser sidecars) ----------------------------
  // Local analyser engines whose objective measures are added to the feedback
  // prompt as context ("signals are evidence alongside the LLM, never a
  // score" — family rule, ADR 012). Each analyser is a supervised sidecar in
  // the same venv; each hands its URL to the engine via the env var named in
  // its `env`. All degrade gracefully: unreachable means no signals, feedback
  // still runs. Flip enabled:false to skip the extra first-run download.
  signals: {
    enabled: true,
    pipSpecs: ["document-analyser==0.10.0", "code-analyser==1.4.0"],
    analysers: [
      {
        env: "FEEDFORWARD_PRACTICE_DOCUMENT_ANALYSER_URL",
        serveCommand: "document-analyser serve --port {PORT} --host {HOST}",
        healthPath: "/health",
        defaultPort: 8023,
        startupTimeoutMs: 180000, // cold start downloads NLTK models
      },
      {
        env: "FEEDFORWARD_PRACTICE_CODE_ANALYSER_URL",
        serveCommand: "code-analyser serve --port {PORT} --host {HOST}",
        healthPath: "/health",
        defaultPort: 8024,
      },
    ],
  },

  // --- Audio pack (speech-analyser, installed on demand) --------------------
  // NOT part of first run: faster-whisper + a whisper model (~150 MB) is too
  // heavy for everyone. Installed the first time a student runs a rubric that
  // declares audio; transcription is load-bearing, so a failed install is a
  // clear error, not silent degradation.
  audio: {
    pipSpec: "speech-analyser==0.10.0",
    serveCommand: "speech-analyser serve --port {PORT} --host {HOST}",
    healthPath: "/health",
    defaultPort: 8025,
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
