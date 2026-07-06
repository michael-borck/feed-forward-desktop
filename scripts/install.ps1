# First-run sidecar install (Windows). The PowerShell equivalent of install.sh —
# the piece talk-buddy's bash-only setup lacked. Builds an app-local venv and
# installs the Python stack, streaming `[install] …` lines on stdout for the
# first-run modal. Exits non-zero on failure.
#
#   powershell -ExecutionPolicy Bypass -File install.ps1 <venv_dir> <pip_spec> [<pip_spec>…]
#
# NOTE: param() must be the first statement in the file (only comments may
# precede it) — everything else comes after.
param(
  [Parameter(Mandatory = $true)][string]$VenvDir,
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$PipSpecs
)

$ErrorActionPreference = "Stop"

function Say($msg) { Write-Output "[install] $msg" }

# $ErrorActionPreference does not catch native-command exit codes — check each step.
function Invoke-Step {
  param([string]$Exe, [string[]]$StepArgs)
  & $Exe @StepArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[install] step failed (exit $LASTEXITCODE): $Exe $($StepArgs -join ' ')"
    exit 1
  }
}

# Prefer the py launcher, fall back to python on PATH.
$py = $null
foreach ($cand in @("py", "python", "python3")) {
  $cmd = Get-Command $cand -ErrorAction SilentlyContinue
  if ($cmd) { $py = $cmd.Source; break }
}
if (-not $py) {
  Write-Error "[install] ERROR: Python not found. Install Python 3.11+ (python.org) and retry."
  exit 1
}
Say "using $(& $py --version 2>&1)"

$vpy = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path $vpy)) {
  Say "creating virtual environment at $VenvDir"
  Invoke-Step $py @("-m", "venv", $VenvDir)
}

Say "upgrading pip"
Invoke-Step $vpy @("-m", "pip", "install", "--upgrade", "pip", "--disable-pip-version-check", "-q")

Say "installing CPU-only torch (no CUDA)"
& $vpy -m pip install --disable-pip-version-check `
  --index-url https://download.pytorch.org/whl/cpu torch
if ($LASTEXITCODE -ne 0) {
  Say "torch CPU index step skipped (will resolve transitively)"
}

Say "installing: $($PipSpecs -join ' ') - this can take several minutes on first run"
Invoke-Step $vpy (@("-m", "pip", "install", "--disable-pip-version-check") + $PipSpecs)

Say "OK - sidecar environment ready"
