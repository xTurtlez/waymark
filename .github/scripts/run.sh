#!/usr/bin/env bash
# Run a command; on failure, surface the tail of its output as a GitHub
# annotation (readable through the API even when raw logs are not).
# Usage: run.sh "<title>" <command...>
title="$1"; shift
log="$(mktemp)"
set -o pipefail
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  tail -n 120 "$log" | sed -e 's/\x1b\[[0-9;]*m//g' > "$log.tail"
  msg=$(sed ':a;N;$!ba;s/%/%25/g;s/\r/%0D/g;s/\n/%0A/g' "$log.tail")
  echo "::error title=${title}::${msg}"
fi
exit "$code"
