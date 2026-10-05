#!/bin/bash
# Parallel balance sweep: tools/balance.sh "1 1" "2 3" ... (chapter level pairs); env SEEDS=6 SKILL=0.8
cd "$(dirname "$0")/.."
GODOT=${GODOT:-/tmp/g/Godot_v4.3-stable_linux.x86_64}
i=0
for t in "$@"; do
  set -- $t
  ( $GODOT --headless --path . res://tests/balance.tscn -- ${SEEDS:-6} ${SKILL:-0.8} $1 $2 2>&1 | grep -E "^[0-9]-[0-9]" ) &
  i=$((i+1)); if [ $((i % 4)) -eq 0 ]; then wait; fi
done
wait
