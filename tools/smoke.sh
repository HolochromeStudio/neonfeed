#!/bin/bash
# Visit every screen under xvfb and fail on any SCRIPT ERROR. usage: tools/smoke.sh [screens...]
cd "$(dirname "$0")/.."
GODOT=${GODOT:-/tmp/g/Godot_v4.3-stable_linux.x86_64}
SCREENS=${@:-"title home modes map units customize create quests shop inventory leaderboard settings profile codex intro cutscene"}
fail=0
for s in $SCREENS; do
  out=$(timeout 120 xvfb-run -a -s "-screen 0 1080x1920x24" $GODOT --path . --rendering-driver opengl3 --resolution 1080x1920 -- --shot=/tmp/smoke_$s.png --frames=60 --goto=$s 2>&1 | grep -E "SCRIPT ERROR|Parse Error|Invalid (call|get|set|access)|Nonexistent|null instance|Cannot (call|get|set)" | head -8)
  if [ -n "$out" ]; then echo "== $s: ERRORS"; echo "$out"; fail=1; else echo "== $s: ok"; fi
done
exit $fail
