#!/usr/bin/env bash
# Secret-leakage audit. Fails the build if any tracked file contains
# canonical placeholder secrets outside the allow-listed fixture
# locations.
#
# Real audit lands in AC-21. The scaffold version is a permissive
# baseline that always exits 0 and prints the count of files
# scanned; later iterations will populate the canonical placeholder
# list and the allow-list policy.

set -euo pipefail

ROOTS=("src" "tests" "web" "docs" "scripts" "bench" "examples" "fixtures")
COUNT=0
for r in "${ROOTS[@]}"; do
  if [[ -d "$r" ]]; then
    N=$(find "$r" -type f \( -name '*.ts' -o -name '*.js' -o -name '*.json' -o -name '*.md' -o -name '*.html' -o -name '*.css' \) | wc -l | tr -d ' ')
    COUNT=$((COUNT + N))
  fi
done
echo "audit-secrets: scanned $COUNT files across ${ROOTS[*]} (placeholder scan armed in AC-21)"
exit 0
