#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
PROJECT_NAME="${CODEBASE_MEMORY_PROJECT_NAME:-cbam-paddle-app}"

if ! command -v codebase-memory-mcp >/dev/null 2>&1; then
  INSTALLER="$(mktemp)"
  trap 'rm -f "$INSTALLER"' EXIT
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh \
    --output "$INSTALLER"
  bash "$INSTALLER"
fi

# Ensure CLI is on PATH for this shell (common install location).
if ! command -v codebase-memory-mcp >/dev/null 2>&1 && [[ -x "${HOME}/.local/bin/codebase-memory-mcp" ]]; then
  export PATH="${HOME}/.local/bin:${PATH}"
fi

codebase-memory-mcp config set auto_index true
codebase-memory-mcp config set auto_watch true
codebase-memory-mcp config set auto_index_limit 50000

codebase-memory-mcp cli --progress index_repository \
  --repo-path "$REPO_ROOT" \
  --name "$PROJECT_NAME"

codebase-memory-mcp cli list_projects

echo
echo "Indexed project id: ${PROJECT_NAME}"
echo "Rule file: .cursor/rules/ceos.mdc (CEOS working principles; codebase-memory MCP is advisory only)"
echo "Restart Cursor if MCP tools are not visible."
