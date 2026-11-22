# FeedForward Desktop

Private practice feedback on assignment drafts — for students, on their own
machines. Open the `.ffrubric` file your instructor shared, paste a draft,
choose a model endpoint you control, and get the same rubric-aligned,
bullseye-style formative feedback as [FeedForward](https://github.com/michael-borck/feed-forward)
— as unlimited private practice before you submit for real.

Nothing is uploaded anywhere: no accounts, no server. Your draft leaves the
machine only to the model endpoint you choose:

- **Local Ollama** (default, fully offline)
- **Remote Ollama / class server** with a bearer token
- **Your own key** on any OpenAI-compatible endpoint

Built from the lens-desktop template: an Electron shell that ships the single
uv binary and, on first run, installs the Python engine
([`feedforward-practice`](https://github.com/michael-borck/feed-forward/tree/main/practice))
into an app-local venv on a uv-managed CPython — no system Python needed — and
talks to it over an authenticated localhost API (port 8022).

## Development

```bash
npm install
npm run dev        # Electron with live reload (spawns the sidecar)
npm run typecheck
npm run fetch:uv   # populate resources/bin before local packaging
npm run package    # electron-builder installers into release/
```

Requires Node 22+. Dev mode uses `uv`/`python3` from your PATH; the packaged
app uses the bundled uv and its own managed Python.

## Releases

Tag `v*` — CI builds Windows (NSIS), macOS (dmg/zip, arm64+x64), and Linux
(AppImage/deb) installers and publishes a GitHub release.

Part of the FeedForward project · MIT
