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

## Architecture: a native app, NOT the website in a wrapper

This desktop app is **not** the FeedForward web app wrapped in
Electron/Tauri. It is a separate product with its own UI and its own engine
process:

| | FeedForward (web) | FeedForward Desktop (this repo) |
|---|---|---|
| UI | FastHTML/HTMX pages, `app/` (77 py files) | React renderer (`src/`), native menus/dialogs |
| Engine | In-process (`app/services/feedback_generator.py`) | `feedforward-practice` sidecar: a separate local HTTP process supervised by the Electron main process |
| Data | SQLite: courses, enrollments, drafts, instructor review | No database — rubric file in, feedback out; history in `localStorage` |
| Who runs it | An institution (Docker on a server) | The student, on their own machine |
| Models | Institution-configured providers | Student-chosen endpoint (local Ollama / class server / own key) |
| Role | The official channel students submit through | Private, unlimited practice *before* submitting ("submit through your unit's FeedForward site as usual") |

What they **share** is the contract, not code: the `.ffrubric` format
(`shared/ffrubric.schema.json`), the feedback prompt and level bands
(`shared/feedback-prompt.md`, `shared/levels.json`), which are vendored into
the `feedforward_practice` package and must stay byte-identical. A change to
prompt wording or levels is made once in `shared/`, re-vendored, and released
on PyPI before this app's pin is bumped.

Submission types follow the same contract: `.ffrubric` v1.1 lets an
assignment declare `assignment.submissionTypes` (default `["text"]`). This
app currently handles `text` and `image` (multimodal chat); the engine
rejects kinds it cannot handle with a clear error rather than guessing.

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
