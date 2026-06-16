#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

run_npm_build() {
  app_dir="$1"
  app_name="$2"

  echo
  echo "==> Building $app_name"
  cd "$app_dir"

  if [ ! -d node_modules ]; then
    npm ci
  fi

  npm run build
}

echo "Repo: $REPO_ROOT"

echo
echo "==> Running backend tests"
cd "$REPO_ROOT/apps/api"
mvn test

run_npm_build "$REPO_ROOT/apps/web" "web"
run_npm_build "$REPO_ROOT/apps/admin" "admin"

echo
echo "Local checks completed."
