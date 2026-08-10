#!/usr/bin/env bash
# G-17 — PDF/A-3b conformance gate.
#
# Runs veraPDF (https://verapdf.org) against the produced PDF and requires
# zero PDF/A-3b violations. If veraPDF is not installed the gate exits 2 and
# records KANIT_YOK so the archive claim is never asserted without evidence.
#
# Usage:
#   verapdf-conformance-check.sh <pdf-file> [--no-write-artifact]

set -euo pipefail

PDF_FILE="${1:-}"
VERAPDF_BIN="${VERAPDF_BIN:-verapdf}"
ARTIFACT_DIR="${CBAMVALID_ARTIFACT_DIR:-artifacts/gates/G-17}"
ARTIFACT="${ARTIFACT_DIR}/verapdf-report.json"
WRITE_ARTIFACT=1
if [[ "${2:-}" == "--no-write-artifact" ]]; then WRITE_ARTIFACT=0; fi

if [[ -z "${PDF_FILE}" ]]; then
  echo "usage: verapdf-conformance-check.sh <pdf-file>" >&2
  exit 3
fi
if [[ ! -f "${PDF_FILE}" ]]; then
  echo "FAIL: PDF not found: ${PDF_FILE}" >&2
  exit 3
fi

if ! command -v "${VERAPDF_BIN}" >/dev/null 2>&1; then
  mkdir -p "${ARTIFACT_DIR}"
  echo "KANIT_YOK: veraPDF binary '${VERAPDF_BIN}' not installed." >&2
  echo "Install veraPDF (https://verapdf.org) or set VERAPDF_BIN, then re-run this gate." >&2
  if [[ "${WRITE_ARTIFACT}" == "1" ]]; then
    printf '{"gate":"G-17","status":"KANIT_YOK","reason":"verapdf not installed","tool":"%s"}\n' "${VERAPDF_BIN}" > "${ARTIFACT}"
  fi
  exit 2
fi

# veraPDF JSON validation profile output.
REPORT="$("${VERAPDF_BIN}" --format json "${PDF_FILE}")"

# Parse the validation report with a tiny awk/jq-free summary: locate the
# compliance statement and violation counts.
PROFILE="$(printf '%s' "${REPORT}" | grep -o '"profileName"[^,]*' | head -n 1 | sed 's/.*: *"//; s/"$//')"
COMPLIANT="$(printf '%s' "${REPORT}" | grep -o '"isCompliant":[a-z]*' | head -n 1 | sed 's/.*://')"
VIOLATIONS="$(printf '%s' "${REPORT}" | grep -o '"rules":[^{]*' | grep -oE '[0-9]+' | head -n 1)"

if [[ "${COMPLIANT}" == "true" ]]; then
  mkdir -p "${ARTIFACT_DIR}"
  if [[ "${WRITE_ARTIFACT}" == "1" ]]; then
    printf '{"gate":"G-17","status":"PASS","tool":"%s","profile":"%s","violations":0,"pdf":"%s"}\n' \
      "${VERAPDF_BIN}" "${PROFILE}" "${PDF_FILE}" > "${ARTIFACT}"
  fi
  echo "PASS: PDF/A-3b conformance (profile: ${PROFILE}, violations: 0)"
  exit 0
fi

mkdir -p "${ARTIFACT_DIR}"
if [[ "${WRITE_ARTIFACT}" == "1" ]]; then
  printf '{"gate":"G-17","status":"FAIL","tool":"%s","profile":"%s","violations":%s,"pdf":"%s"}\n' \
    "${VERAPDF_BIN}" "${PROFILE}" "${VIOLATIONS:-unknown}" "${PDF_FILE}" > "${ARTIFACT}"
fi
echo "FAIL: PDF/A-3b conformance violations detected (profile: ${PROFILE}, violations: ${VIOLATIONS:-unknown})" >&2
exit 1
