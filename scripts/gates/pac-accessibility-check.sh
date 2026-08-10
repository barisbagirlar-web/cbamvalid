#!/usr/bin/env bash
# G-18 — PDF/UA accessibility conformance gate (BLOCKED / spike).
#
# Runs PAC 3 (PDF Accessibility Checker, https://pdfua.foundation/en/pac/)
# or an equivalent accessibility checker against the produced PDF and requires
# zero critical accessibility violations. This gate is BLOCKED: the current
# jsPDF+pdf-lib pipeline does not emit a tagged structure tree, so an installed
# checker will legitimately report violations (the red result is more reliable
# than a fake green). If no checker is installed the gate reports KANIT_YOK.
#
# Usage:
#   pac-accessibility-check.sh <pdf-file> [--no-write-artifact]

set -euo pipefail

PDF_FILE="${1:-}"
PAC_BIN="${PAC_BIN:-pac}"
ARTIFACT_DIR="${CBAMVALID_ARTIFACT_DIR:-artifacts/gates/G-18}"
ARTIFACT="${ARTIFACT_DIR}/accessibility-report.json"
WRITE_ARTIFACT=1
if [[ "${2:-}" == "--no-write-artifact" ]]; then WRITE_ARTIFACT=0; fi

if [[ -z "${PDF_FILE}" ]]; then
  echo "usage: pac-accessibility-check.sh <pdf-file>" >&2
  exit 3
fi
if [[ ! -f "${PDF_FILE}" ]]; then
  echo "FAIL: PDF not found: ${PDF_FILE}" >&2
  exit 3
fi

if ! command -v "${PAC_BIN}" >/dev/null 2>&1; then
  mkdir -p "${ARTIFACT_DIR}"
  echo "KANIT_YOK: accessibility checker '${PAC_BIN}' not installed." >&2
  if [[ "${WRITE_ARTIFACT}" == "1" ]]; then
    printf '{"gate":"G-18","status":"KANIT_YOK","reason":"checker not installed","tool":"%s"}\n' "${PAC_BIN}" > "${ARTIFACT}"
  fi
  exit 2
fi

# Placeholder for the real checker invocation. PAC 3 (GUI/CLI) output varies by
# version; wire the machine-readable report parsing here once the spike selects
# a tool. Until then a configured checker means the gate must run and record
# its real result — never assume PASS.
echo "KANIT_YOK: checker '${PAC_BIN}' present but report parsing not wired (G-18 BLOCKED, see artifacts/gates/G-18/README.md)." >&2
mkdir -p "${ARTIFACT_DIR}"
if [[ "${WRITE_ARTIFACT}" == "1" ]]; then
  printf '{"gate":"G-18","status":"KANIT_YOK","reason":"spike not completed","tool":"%s"}\n' "${PAC_BIN}" > "${ARTIFACT}"
fi
exit 2
