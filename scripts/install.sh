#!/usr/bin/env bash
# First-run sidecar install (macOS / Linux). Builds an app-local venv and installs
# the Python stack. Streams `[install] …` progress lines on stdout; the Electron
# main process pipes these into the first-run modal. Idempotent-ish: re-running
# reuses the venv. Exits non-zero on failure so the UI can surface it.
#
#   install.sh <venv_dir> <pip_spec> [<pip_spec>…]
#
# Requires system Python 3.11+ (the sidecar stack is pure Python — fastapi,
# uvicorn, httpx — so this normally takes well under a minute).
set -euo pipefail

VENV_DIR="${1:?usage: install.sh <venv_dir> <pip_spec> [<pip_spec>…]}"
shift
if [ "$#" -lt 1 ]; then
  echo "usage: install.sh <venv_dir> <pip_spec> [<pip_spec>…]" >&2
  exit 1
fi

say() { echo "[install] $*"; }

PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  echo "[install] ERROR: Python is required but was not found on this Mac." >&2
  echo "[install] Install Python 3.11 or newer from https://www.python.org/downloads/" >&2
  echo "[install] (or: brew install python), then restart FeedForward Desktop." >&2
  exit 1
fi
say "using $("$PY" --version 2>&1)"

if [ ! -x "$VENV_DIR/bin/python" ]; then
  say "creating virtual environment at $VENV_DIR"
  "$PY" -m venv "$VENV_DIR"
fi
VPY="$VENV_DIR/bin/python"

say "upgrading pip"
"$VPY" -m pip install --upgrade pip --disable-pip-version-check -q

say "installing: $*"
"$VPY" -m pip install --disable-pip-version-check "$@"

say "OK — sidecar environment ready"
