#!/usr/bin/env bash
# Sidecar E2E smoke test — exercises the engine exactly the way the desktop
# app does, but against a mock OpenAI-compatible endpoint (no real model):
#
#   1. python3 venv + pip install the sidecar spec from PyPI (student path)
#   2. feedforward-practice serve (with auth token, like SidecarManager)
#   3. /health, auth gate (401 without bearer), /practice/models
#   4. async feedback job: POST -> 202 -> poll -> done, levels present
#
# Usage: scripts/smoke-sidecar.sh [pip-spec]
# Env:   FEEDFORWARD_SMOKE_PORT (default 8477), MOCK_PORT (default 8488)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SPEC="${1:-feedforward-practice[serve,documents]==0.6.0}"
SIDE_PORT="${FEEDFORWARD_SMOKE_PORT:-8477}"
MOCK_PORT="${MOCK_PORT:-8488}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ffd-smoke.XXXXXX")"
MOCK_PID=""; SIDE_PID=""

cleanup() {
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null || true
  [ -n "$SIDE_PID" ] && kill "$SIDE_PID" 2>/dev/null || true
}
trap cleanup EXIT

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
note() { echo "[smoke] $*"; }

auth() { curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer tok" "$@"; }
auth_body() { curl -s -H "Authorization: Bearer tok" "$@"; }

# 1. venv + install (this is precisely what first-run does, minus the UI)
note "creating venv at $WORK/venv"
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install --quiet --disable-pip-version-check "$SPEC"
note "installed: $("$WORK/venv/bin/pip" show feedforward-practice | awk '/^Version/{print $2}')"

# 2. mock endpoint + sidecar
python3 "$HERE/mock_openai.py" "$MOCK_PORT" &
MOCK_PID=$!
FEEDFORWARD_PRACTICE_AUTH_TOKEN=tok \
  "$WORK/venv/bin/feedforward-practice" serve --port "$SIDE_PORT" --host 127.0.0.1 \
  >"$WORK/sidecar.log" 2>&1 &
SIDE_PID=$!

for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SIDE_PORT/health")" = 200 ] && break
  sleep 0.5
done
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SIDE_PORT/health")" = 200 ] \
  || { cat "$WORK/sidecar.log" >&2; fail "sidecar never became healthy"; }
note "sidecar healthy on :$SIDE_PORT"

# 3. contract checks
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SIDE_PORT/practice/feedback/x")" = 401 ] \
  || fail "auth gate did not reject an unauthenticated request"
note "auth gate: 401 without bearer token"

MODELS="$(auth_body -X POST "http://127.0.0.1:$SIDE_PORT/practice/models" \
  -H 'Content-Type: application/json' \
  -d "{\"base_url\": \"http://127.0.0.1:$MOCK_PORT/v1\", \"api_key\": \"\", \"model\": \"\"}")"
echo "$MODELS" | grep -q "mock-model" || fail "model listing failed: $MODELS"
note "model listing via mock endpoint ok"

# 4. async feedback job (sample rubric: Argument 40%, Evidence 60%)
RUBRIC='{"kind":"ffrubric","assignment":{"title":"Smoke Essay"},"rubric":{"categories":[{"name":"Argument","weight":40},{"name":"Evidence","weight":60}]}}'
JOB="$(auth_body -X POST "http://127.0.0.1:$SIDE_PORT/practice/feedback" \
  -H 'Content-Type: application/json' \
  -d "{\"rubric\": $RUBRIC, \"draft_text\": \"Draft text for the smoke test.\", \"num_runs\": 2,
       \"provider\": {\"base_url\": \"http://127.0.0.1:$MOCK_PORT/v1\", \"api_key\": \"\", \"model\": \"mock-model\"}}")"
echo "$JOB" | grep -q '"id"' || fail "feedback POST did not return a job: $JOB"
JOB_ID="$(echo "$JOB" | sed -n 's/.*"id":"\([a-f0-9]*\)".*/\1/p')"
note "job started: $JOB_ID"

for _ in $(seq 1 60); do
  RESULT="$(auth_body "http://127.0.0.1:$SIDE_PORT/practice/feedback/$JOB_ID")"
  echo "$RESULT" | grep -q '"status":"running"' || break
  sleep 0.5
done
echo "$RESULT" | grep -q '"status":"done"' || fail "job did not finish: $RESULT"
echo "$RESULT" | grep -q '"overall"' || fail "result missing overall block"
# 0.4*82 + 0.6*74 = 77.2 -> band "On the board" (levels.json: min 70)
echo "$RESULT" | grep -q "On the board" || fail "expected level 'On the board' in: $RESULT"
echo "$RESULT" | grep -q '"runs":2' || fail "expected 2 aggregated runs"
note "feedback job done — aggregated 2 runs, level 'On the board'"

echo "SMOKE PASS"
