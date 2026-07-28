# Codebase Memory bootstrap (Windows)
# Requires: git, curl or Invoke-WebRequest, PowerShell 5+
$ErrorActionPreference = "Stop"

$RepoRoot = (git rev-parse --show-toplevel).Trim()
$ProjectName = if ($env:CODEBASE_MEMORY_PROJECT_NAME) { $env:CODEBASE_MEMORY_PROJECT_NAME } else { "cbam-paddle-app" }

function Ensure-CodebaseMemoryMcp {
  $cmd = Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue
  if ($cmd) { return }
  $localBin = Join-Path $env:USERPROFILE ".local\bin\codebase-memory-mcp.exe"
  if (Test-Path $localBin) {
    $env:PATH = "$(Split-Path $localBin -Parent);$env:PATH"
    return
  }
  $installer = Join-Path $env:TEMP "codebase-memory-mcp-install.sh"
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh" -OutFile $installer
  bash $installer
  $env:PATH = "$(Join-Path $env:USERPROFILE '.local\bin');$env:PATH"
}

Ensure-CodebaseMemoryMcp

codebase-memory-mcp config set auto_index true
codebase-memory-mcp config set auto_watch true
codebase-memory-mcp config set auto_index_limit 50000

codebase-memory-mcp cli --progress index_repository --repo-path $RepoRoot --name $ProjectName
codebase-memory-mcp cli list_projects

Write-Host ""
Write-Host "Indexed project id: $ProjectName"
Write-Host "Rule file: .cursor/rules/codebase-memory.mdc (alwaysApply=true)"
Write-Host "Restart Cursor if MCP tools are not visible."
