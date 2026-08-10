#!/usr/bin/env bash
# G-09 — test-artifact leak gate (D-08). CI runs this BEFORE sealing.
# A single forbidden string anywhere in the package exits 1. No --force flag.
set -u

PACKAGE_DIR="${1:?usage: gate-no-test-artifacts.sh <package-dir>}"
if [ ! -d "$PACKAGE_DIR" ]; then
  echo "G-09 FAIL: package directory not found: $PACKAGE_DIR" >&2
  exit 1
fi

# Case-insensitive, whole-word where the token is a common English word.
PATTERNS=(
  '\bcontrolled test\b'
  '\btest evidence\b'
  '\bdemo\b'
  '\bsample data\b'
  '\blorem\b'
  '\bfoo\b'
  '\bbar\b'
  'example\.com'
  '\bTODO\b'
  '\bTBD\b'
  '\bFIXME\b'
  '\bXXX\b'
  '\bdummy\b'
  '\bplaceholder\b'
)

MATCHES=0
REPORT_DIR="artifacts/gates/G-09"
mkdir -p "$REPORT_DIR"

while IFS= read -r -d '' file; do
  hits=$(grep -aoiE "$(IFS='|'; echo "${PATTERNS[*]}")" "$file" 2>/dev/null | sort -u | tr '\n' ',')
  if [ -n "$hits" ]; then
    echo "G-09 FORBIDDEN in $file: $hits"
    MATCHES=$((MATCHES + 1))
  fi
done < <(find "$PACKAGE_DIR" -type f -print0)

# PDF text is part of the package: extract and scan it too when pdftotext exists.
if command -v pdftotext >/dev/null 2>&1; then
  while IFS= read -r -d '' pdf; do
    text=$(pdftotext -q "$pdf" - 2>/dev/null || true)
    if printf '%s' "$text" | grep -aqiE "$(IFS='|'; echo "${PATTERNS[*]}")"; then
      hits=$(printf '%s' "$text" | grep -aoiE "$(IFS='|'; echo "${PATTERNS[*]}")" | sort -u | tr '\n' ',')
      echo "G-09 FORBIDDEN in PDF $pdf: $hits"
      MATCHES=$((MATCHES + 1))
    fi
  done < <(find "$PACKAGE_DIR" -name '*.pdf' -print0)
fi

if [ "$MATCHES" -gt 0 ]; then
  echo "G-09 FAIL: $MATCHES component(s) contain forbidden strings. Package is not sealable." >&2
  exit 1
fi

echo "G-09 PASS: no forbidden strings in $PACKAGE_DIR"
echo "G-09 PASS" > "$REPORT_DIR/scan-result.txt"
exit 0
