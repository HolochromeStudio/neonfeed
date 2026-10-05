#!/bin/bash
# Compile-check all GDScript by importing the project; prints only errors.
cd "$(dirname "$0")/.."
timeout 300 ${GODOT:-/tmp/g/Godot_v4.3-stable_linux.x86_64} --headless --path . --import 2>&1 | grep -E "SCRIPT ERROR|ERROR:|at: GDScript" | grep -v "Compile Error: $" | awk '!seen[$0]++' | head -${1:-40}
