#!/bin/bash
# usage: tools/shot.sh out.png [frames] [extra godot args after --]   e.g. tools/shot.sh /tmp/a.png 60 --goto=home
OUT=$1; FR=${2:-60}; shift; shift
GODOT=${GODOT:-/tmp/g/Godot_v4.3-stable_linux.x86_64}
cd "$(dirname "$0")/.."
timeout ${TIMEOUT:-120} xvfb-run -a -s "-screen 0 1080x2000x24" $GODOT --path . --rendering-driver opengl3 --resolution ${RES:-1080x1920} -- --shot=$OUT --frames=$FR "$@" 2>&1 | grep -vE "^Godot Engine|WARNING|^$|OpenGL|Vulkan|ALSA|pulse" | head -40
