# BUGBYTE roadmap (beyond the vertical slice)

The slice proves every system end-to-end. The remaining campaign is *content* on top of the same engine:

| Phase | Content | Engine status |
|---|---|---|
| Node 2 (DONE) | Whisperwood, Bellwether, Signal Node 2, Sona (broadcastFirst), radio/keypad devices, Struggle | shipped in v0.2 |
| Nodes 3-4 | Whisperwood (changing paths), Bellwether (frequency puzzle, FREQUENCY), Port Circuit (containers, OVERRIDE), Morrowvale/Archive Mine (BACKTRACE) | map ops, scripts, puzzles-by-flags, bosses.rules all data-driven. FREQUENCY/OVERRIDE/BACKTRACE need small `exec` commands (hidden layers, past-state tiles = map ops with `when`). |
| Nodes 5-8 | Neonford metro (DECRYPT), Mount Relay (PHASE, elevation), Null Coast + Nullspace (ANCHOR), Recursion Isle | `Signal Hop` fast travel (Root Key 3) is a `worldmap.json` + `warp` script away. |
| Root | 5-layer final dungeon, Mira/Voss/ABSOLUTE bosses (phase mechanics via `bosses.json` rules) | Add rule types in `battle/engine.ts` (`endOfTurn`). Double battles: extend `Battle` to two active Fighters per side. |
| Sidequests | 60+ chains (the 3 shipped quests show the patterns: NPC chain, scan-counter, item hunt) | quests.json + scripts/*.json only |
| Postgame | Root League, legendaries, Process 0, NG+, randomizer, challenge modes | `Settings` + flags + `makeMon` already randomizable (seeded `rand`) |
| Creatures | 32 species in the slice; the generator (`gfx/creatures.ts`) supports 10 body templates x palettes x stage scaling x features | add rows to `bytekin.json` (sprite spec is data) |
| Music | 12 tracks/jingles; tracks are strings in `audio/tracks.ts` | add tracks |
