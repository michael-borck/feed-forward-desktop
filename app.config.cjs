// FeedForward Desktop — the single per-app customization point for the
// lens-desktop shell. The sidecar is the feedforward-practice engine
// (github.com/michael-borck/feed-forward, practice/), installed into an
// app-local venv on first run.
module.exports = {
  appId: "com.michaelborck.feedforward",
  productName: "FeedForward Desktop",

  // --- Python sidecar (feedforward-practice serve) ---------------------------
  // TODO: switch to "feedforward-practice[serve]==0.1.0" once published to PyPI.
  sidecarPipSpecs: [
    "feedforward-practice[serve] @ git+https://github.com/michael-borck/feed-forward.git@main#subdirectory=practice",
  ],
  serveCommand: "feedforward-practice serve --port {PORT} --host {HOST}",
  healthPath: "/health",
  defaultPort: 8022,
  authTokenEnv: "FEEDFORWARD_PRACTICE_AUTH_TOKEN",
  // Provider (endpoint/key/model) is chosen in the UI per request, not forced
  // via env — students may use local Ollama, a remote Ollama behind a bearer
  // proxy, or their own key on any OpenAI-compatible endpoint.
  sidecarEnv: {},

  // --- Models (fully-offline) ------------------------------------------------
  models: [],

  // --- Local LLM (Ollama) ----------------------------------------------------
  ollama: {
    recommendedModel: "llama3.2:3b",
    recommendedSizeGB: 2.0,
  },
};
