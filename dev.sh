#!/usr/bin/env bash
set -euo pipefail

ROOT="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

compose() {
  docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose-local.yml" "$@"
}

case "${1:-help}" in
  up)
    compose up -d
    printf '\nBackend started. Run "bash dev.sh frontend" in another terminal.\n'
    ;;
  frontend)
    NODE_BIN="$ROOT/../.tooling/node-v22.22.0-darwin-arm64/bin"
    if [[ -x "$NODE_BIN/node" ]]; then
      export PATH="$NODE_BIN:$PATH"
    fi
    if ! command -v pnpm >/dev/null 2>&1; then
      printf 'pnpm is required. See docs/local-development.zh-CN.md.\n' >&2
      exit 1
    fi
    exec pnpm --dir "$ROOT" dev
    ;;
  status)
    compose ps -a
    ;;
  logs)
    shift
    compose logs --tail=100 -f "$@"
    ;;
  down)
    compose down
    printf '\nData volumes preserved. Stop the frontend terminal with Ctrl+C.\n'
    ;;
  help|-h|--help)
    printf 'Usage: bash dev.sh {up|frontend|status|logs [service...]|down}\n'
    ;;
  *)
    printf 'Unknown command: %s\n' "$1" >&2
    exit 1
    ;;
esac
