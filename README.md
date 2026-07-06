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

Built from the lens-desktop template: an Electron shell that installs the
Python engine ([`feedforward-practice`](https://github.com/michael-borck/feed-forward/tree/main/practice))
into an app-local venv on first run and talks to it over an authenticated
localhost API (port 8022).

## Development

```bash
npm install
npm run dev        # Electron with live reload (spawns the sidecar)
npm run typecheck
npm run package    # electron-builder installers into release/
```

Requires Node 22+ and, at runtime, Python 3.11+ on PATH (used once, on
first run, to create the sidecar venv).

## Releases

Tag `v*` — CI builds Windows (NSIS), macOS (dmg/zip, arm64+x64), and Linux
(AppImage/deb) installers and publishes a GitHub release.

Part of the FeedForward project · MIT
