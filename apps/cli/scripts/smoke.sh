#!/usr/bin/env bash
# CLI end-to-end smoke test.
#
# Walks the operator through configure -> whoami -> generate --commit against
# a deployed API, in a throwaway repo. Captures exit codes and the resulting
# commit so the run can be pasted into the T-5.8 task doc for sign-off.
#
# Operator-driven: step 4 invokes the inquirer suggestion picker. Do not
# wire this into unattended CI — the prompt has no non-interactive path.
#
# The operator's real ~/.projectrc is NEVER touched: PROJECTRC_PATH is
# exported to a temp file before any CLI invocation, and `configure`'s
# saveConfig honours that env var (see apps/cli/src/lib/config.ts).
#
# Usage:
#   API_URL=https://api.example.com \
#   API_KEY=git_xxx \
#   PROVIDER=openai \
#   MODEL=gpt-4o-mini \
#   bash apps/cli/scripts/smoke.sh
#
# Optional env:
#   CLI_BIN          path to the built CLI (default: <repo>/apps/cli/dist/index.js)
#   REPO_ID          uuid passed via --repo
#   POLICY_ID        uuid passed via --policy
#   WORKDIR          override throwaway repo location (default: mktemp)
#   KEEP_WORKDIR=1   skip cleanup of the throwaway repo (for debugging)
#
# Exit code: 0 on success, non-zero on the first failed step.

set -u
set -o pipefail

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

step() { bold ""; bold "── $* ──"; }

require_env() {
  local name=$1
  if [ -z "${!name:-}" ]; then
    red "missing required env: $name"
    exit 64
  fi
}

require_env API_URL
require_env API_KEY
PROVIDER=${PROVIDER:-openai}
MODEL=${MODEL:-gpt-4o-mini}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null && pwd)
CLI_BIN=${CLI_BIN:-"$SCRIPT_DIR/../dist/index.js"}
if [ ! -f "$CLI_BIN" ]; then
  red "CLI binary not found at $CLI_BIN"
  yellow "build first: pnpm -F @commit-analyzer/cli build"
  exit 65
fi

WORKDIR=${WORKDIR:-$(mktemp -d "${TMPDIR:-/tmp}/cli-smoke.XXXXXX")}
PROJECTRC=$(mktemp "${TMPDIR:-/tmp}/projectrc.XXXXXX")

cleanup() {
  local code=$?
  if [ "${KEEP_WORKDIR:-0}" != "1" ]; then
    rm -rf "$WORKDIR" "$PROJECTRC"
  else
    yellow "kept workdir: $WORKDIR"
    yellow "kept config:  $PROJECTRC"
  fi
  exit $code
}
trap cleanup EXIT

export PROJECTRC_PATH="$PROJECTRC"

bold "T-5.8 — CLI smoke test"
echo "API_URL  = $API_URL"
echo "PROVIDER = $PROVIDER"
echo "MODEL    = $MODEL"
echo "WORKDIR  = $WORKDIR"
echo "CONFIG   = $PROJECTRC (PROJECTRC_PATH; ~/.projectrc untouched)"
echo

step "1. configure"
node "$CLI_BIN" configure --url "$API_URL" --key "$API_KEY"
configure_rc=$?
if [ "$configure_rc" -ne 0 ]; then red "configure failed (exit $configure_rc)"; exit "$configure_rc"; fi
green "configure ok (exit $configure_rc)"

step "2. whoami"
node "$CLI_BIN" whoami
whoami_rc=$?
if [ "$whoami_rc" -ne 0 ]; then red "whoami failed (exit $whoami_rc)"; exit "$whoami_rc"; fi
green "whoami ok (exit $whoami_rc)"

step "3. throwaway repo"
(
  set -e
  cd "$WORKDIR"
  git init -q -b main
  git config user.email "smoke@example.com"
  git config user.name  "Smoke Tester"
  printf 'hello\n' > README.md
  git add README.md
  git commit -q -m "init"
  printf 'hello\nworld\n' > README.md
  printf 'pkg = 1\n' > pkg.txt
  git add README.md pkg.txt
  git status --short
) || { red "throwaway repo setup failed"; exit 1; }
echo

cd "$WORKDIR" || { red "cd workdir failed"; exit 1; }

step "4. generate --commit (interactive: pick a suggestion)"
yellow "the CLI will prompt — choose a suggestion to commit, or 'q' to abort."
generate_args=(--provider "$PROVIDER" --model "$MODEL" --commit)
if [ -n "${REPO_ID:-}" ];   then generate_args+=(--repo   "$REPO_ID");   fi
if [ -n "${POLICY_ID:-}" ]; then generate_args+=(--policy "$POLICY_ID"); fi
node "$CLI_BIN" generate "${generate_args[@]}"
generate_rc=$?
echo
if [ "$generate_rc" -ne 0 ]; then
  red "generate failed (exit $generate_rc)"
  exit "$generate_rc"
fi
green "generate ok (exit $generate_rc)"

step "5. verify commit"
log_count=$(git rev-list --count HEAD)
if [ "$log_count" -lt 2 ]; then
  red "expected at least 2 commits, found $log_count"
  exit 1
fi
git log -1 --format='%H%n%s%n%n%b' | sed 's/^/    /'

bold ""
green "── smoke test PASSED ──"
echo "configure rc=$configure_rc  whoami rc=$whoami_rc  generate rc=$generate_rc"
