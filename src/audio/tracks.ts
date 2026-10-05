// Original chiptune tracks. Notation: tokens separated by spaces. "C4" = one 16th step, "C4:4" = 4 steps, "-" rest, "-:4" rest 4 steps.
// Drum channel tokens: k (kick) s (snare) h (hat) . (rest)
export interface Channel { w: 'square' | 'tri' | 'saw' | 'drum'; v: number; duty?: number; p: string }
export interface Track { bpm: number; ch: Channel[]; loopFrom?: number }

const rep = (n: number, s: string) => Array(n).fill(s).join(' ');

export const TRACKS: Record<string, Track> = {
  // ---------- TITLE: low, lonely, tower-in-the-distance ----------
  title: { bpm: 84, ch: [
    { w: 'square', v: 0.07, duty: 0.25, p: '-:8 E5:6 -:2 D5:4 B4:4 -:8 G4:6 -:2 A4:4 B4:4 E5:8 G5:4 F#5:4' },
    { w: 'tri', v: 0.17, p: 'E2:16 C2:16 G2:16 D2:16' },
    { w: 'square', v: 0.035, duty: 0.5, p: 'B3 E4 G4 E4 B3 E4 G4 E4 G3 C4 E4 C4 G3 C4 E4 C4 D3 G3 B3 G3 D3 G3 B3 G3 F#3 A3 D4 A3 F#3 A3 D4 A3' },
  ] },
  // ---------- RIVERMOOR: calm, warm ----------
  rivermoor: { bpm: 108, ch: [
    { w: 'square', v: 0.075, duty: 0.5, p: 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 D5:2 F5:2 A5:4 G5:2 E5:2 C5:4 E5:2 G5:2 C6:4 D6:2 B5:2 G5:4 A5:2 G5:2 F5:2 E5:2 D5:8' },
    { w: 'tri', v: 0.17, p: 'C3:4 G3:4 C3:4 G3:4 F3:4 C4:4 F3:4 C4:4 C3:4 G3:4 C3:4 G3:4 D3:4 A3:4 G3:8' },
    { w: 'square', v: 0.03, duty: 0.25, p: 'C4 E4 G4 E4 C4 E4 G4 E4 B3 D4 G4 D4 B3 D4 G4 D4 A3 C4 F4 C4 A3 C4 F4 C4 B3 D4 G4 D4 B3 D4 G4 D4' },
    { w: 'drum', v: 0.05, p: 'k . h . s . h . k . h . s . h h k . h . s . h . k . h . s . h h' },
  ] },
  // ---------- ROUTE / FIELD: bouncy ----------
  route: { bpm: 126, ch: [
    { w: 'square', v: 0.075, duty: 0.25, p: 'A4:2 C5:2 E5:2 C5:2 A4:2 C5:2 E5:4 G5:2 E5:2 D5:2 E5:2 F5:4 E5:4 D5:2 F5:2 A5:2 F5:2 D5:2 F5:2 A5:4 G5:2 E5:2 C5:2 E5:2 A4:8' },
    { w: 'tri', v: 0.17, p: 'A2:2 A3:2 A2:2 A3:2 A2:2 A3:2 A2:2 A3:2 F2:2 F3:2 F2:2 F3:2 G2:2 G3:2 G2:2 G3:2 D2:2 D3:2 D2:2 D3:2 D2:2 D3:2 D2:2 D3:2 E2:2 E3:2 E2:2 E3:2 A2:8' },
    { w: 'drum', v: 0.05, p: 'k . h h s . h . k . h h s . h h k . h h s . h . k . h h s . s s' },
  ] },
  // ---------- BRIARFIELD: pastoral waltz-ish ----------
  briarfield: { bpm: 100, ch: [
    { w: 'square', v: 0.07, duty: 0.5, p: 'G5:4 E5:2 F5:2 G5:4 A5:4 G5:4 E5:4 D5:4 C5:4 D5:4 E5:2 D5:2 C5:8 G5:4 E5:2 F5:2 G5:4 C6:4 B5:4 G5:4 A5:4 F5:4 E5:4 D5:4 C5:8' },
    { w: 'tri', v: 0.17, p: 'C3:4 E3:4 G3:4 C3:4 E3:4 G3:4 F3:4 A3:4 C4:4 G3:4 B3:4 D4:4 C3:4 E3:4 G3:4 C3:4 E3:4 G3:4 F3:4 A3:4 C4:4 G3:4 B3:4 D4:4' },
    { w: 'square', v: 0.028, duty: 0.25, p: '-:2 E4:2 G4:2 -:2 E4:2 G4:2 -:2 E4:2 A4:2 -:2 E4:2 A4:2 -:2 D4:2 G4:2 -:2 D4:2 G4:2 -:2 E4:2 G4:2 -:2 E4:2 G4:2' },
  ] },
  // ---------- INDOOR ----------
  indoor: { bpm: 92, ch: [
    { w: 'square', v: 0.06, duty: 0.5, p: 'C5:4 E5:4 G5:4 E5:4 F5:4 A5:4 G5:4 E5:4 D5:4 F5:4 A5:4 F5:4 E5:8 C5:8' },
    { w: 'tri', v: 0.15, p: 'C3:8 G2:8 F2:8 G2:4 G3:4 C3:8 C3:8 F2:8 G2:8' },
  ] },
  // ---------- OLD RELAY: eerie, sparse, drifting ----------
  relay: { bpm: 76, ch: [
    { w: 'square', v: 0.05, duty: 0.125, p: '-:6 D5:2 -:2 A4:2 -:4 -:6 C#5:2 -:2 G#4:2 -:4 -:6 F5:2 -:2 C5:2 -:2 D5:2 -:6 E5:2 -:8' },
    { w: 'tri', v: 0.17, p: 'D2:16 C#2:16 Bb1:16 A1:16' },
    { w: 'saw', v: 0.018, p: 'D4:16 -:0 C#4:16 Bb3:16 A3:16' },
    { w: 'drum', v: 0.035, p: 'h . . . . . . . h . . . . . h . h . . . . . . . h . . . . . h .' },
  ] },
  // ---------- CAVE ----------
  cave: { bpm: 70, ch: [
    { w: 'tri', v: 0.18, p: 'A2:8 E3:8 F2:8 C3:8 G2:8 D3:8 E2:16' },
    { w: 'square', v: 0.045, duty: 0.25, p: '-:16 A4:2 -:2 C5:2 -:10 -:16 G4:2 -:2 B4:2 -:10 -:16 F4:2 -:2 A4:2 -:10 -:16 E4:8 -:8' },
  ] },
  // ---------- WILD BATTLE ----------
  battle_wild: { bpm: 152, ch: [
    { w: 'square', v: 0.075, duty: 0.25, p: 'E5:2 E5:2 -:2 E5:2 G5:2 E5:2 D5:2 E5:2 C5:2 C5:2 -:2 C5:2 E5:2 C5:2 B4:2 C5:2 A4:2 A4:2 -:2 A4:2 C5:2 A4:2 G4:2 A4:2 B4:2 B4:2 B4:2 D5:2 E5:4 G5:4' },
    { w: 'tri', v: 0.18, p: 'E2:2 E3:2 E2:2 E3:2 E2:2 E3:2 E2:2 E3:2 C2:2 C3:2 C2:2 C3:2 C2:2 C3:2 C2:2 C3:2 A1:2 A2:2 A1:2 A2:2 A1:2 A2:2 A1:2 A2:2 B1:2 B2:2 B1:2 B2:2 B1:2 B2:2 B1:2 B2:2' },
    { w: 'drum', v: 0.055, p: 'k . h . s . h h k . h k s . h h k . h . s . h h k . h k s . s s' },
  ] },
  // ---------- TRAINER / RIVAL ----------
  battle_rival: { bpm: 160, ch: [
    { w: 'square', v: 0.075, duty: 0.5, p: 'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:2 E5:2 G4:2 B4:2 D5:2 G5:2 F5:2 D5:2 B4:2 D5:2 F4:2 A4:2 C5:2 F5:2 E5:2 C5:2 A4:2 C5:2 E5:4 D5:2 C5:2 B4:2 C5:2 D5:2 E5:2' },
    { w: 'saw', v: 0.04, p: 'A3:2 A3:2 A3:2 A3:2 A3:2 A3:2 A3:2 A3:2 G3:2 G3:2 G3:2 G3:2 G3:2 G3:2 G3:2 G3:2 F3:2 F3:2 F3:2 F3:2 F3:2 F3:2 F3:2 F3:2 E3:2 E3:2 E3:2 E3:2 E3:2 E3:2 E3:2 E3:2' },
    { w: 'tri', v: 0.18, p: 'A2:4 E3:4 A2:4 E3:4 G2:4 D3:4 G2:4 D3:4 F2:4 C3:4 F2:4 C3:4 E2:4 B2:4 E2:4 B2:4' },
    { w: 'drum', v: 0.055, p: 'k h s h k h s h k h s h k k s s k h s h k h s h k h s h k s k s' },
  ] },
  // ---------- NODE BOSS ----------
  battle_node: { bpm: 168, ch: [
    { w: 'square', v: 0.08, duty: 0.25, p: 'D5:2 D5:2 F5:2 D5:2 A5:4 G5:2 F5:2 E5:2 E5:2 G5:2 E5:2 B5:4 A5:2 G5:2 F5:2 F5:2 A5:2 F5:2 C6:4 B5:2 A5:2 G5:2 A5:2 B5:2 C6:2 D6:8' },
    { w: 'square', v: 0.04, duty: 0.5, p: 'D4:2 F4:2 A4:2 F4:2 D4:2 F4:2 A4:2 F4:2 E4:2 G4:2 B4:2 G4:2 E4:2 G4:2 B4:2 G4:2 F4:2 A4:2 C5:2 A4:2 F4:2 A4:2 C5:2 A4:2 G4:2 B4:2 D5:2 B4:2 G4:2 B4:2 D5:2 B4:2' },
    { w: 'tri', v: 0.19, p: 'D2:2 D2:2 D3:2 D2:2 D2:2 D3:2 D2:2 D3:2 E2:2 E2:2 E3:2 E2:2 E2:2 E3:2 E2:2 E3:2 F2:2 F2:2 F3:2 F2:2 F2:2 F3:2 F2:2 F3:2 G2:2 G2:2 G3:2 G2:2 G2:2 G3:2 G2:2 G3:2' },
    { w: 'drum', v: 0.06, p: 'k h k h s h k h k h k k s h s s k h k h s h k h k h k k s s s s' },
  ] },
  // ---------- VOSS / CLEAN STATE: clinical, too clean ----------
  clean: { bpm: 90, ch: [
    { w: 'square', v: 0.05, duty: 0.5, p: 'C5:4 -:4 G4:4 -:4 C5:4 -:4 D5:4 -:4 Eb5:4 -:4 D5:4 -:4 C5:8 -:8' },
    { w: 'tri', v: 0.17, p: 'C3:8 C3:8 G2:8 G2:8 Ab2:8 Ab2:8 G2:16' },
    { w: 'drum', v: 0.03, p: 'h . . . h . . . h . . . h . . .' },
  ] },
  // ---------- JINGLES (non-looping tracks are triggered via jingle()) ----------
  jingle_victory: { bpm: 150, ch: [
    { w: 'square', v: 0.08, duty: 0.25, p: 'C5:2 C5:2 C5:2 C5:4 Ab4:4 Bb4:4 C5:2 -:2 Bb4:2 C5:8' },
    { w: 'tri', v: 0.19, p: 'C3:4 C3:4 Ab2:4 Bb2:4 C3:12' },
  ] },
  jingle_boss: { bpm: 140, ch: [
    { w: 'square', v: 0.08, duty: 0.5, p: 'D5:2 F5:2 A5:2 D6:6 -:2 C6:2 D6:2 F6:12' },
    { w: 'tri', v: 0.19, p: 'D3:6 F3:6 A3:6 D3:12' },
    { w: 'drum', v: 0.05, p: 'k h s h k h s s k . s . s s s s' },
  ] },
  jingle_heal: { bpm: 130, ch: [
    { w: 'square', v: 0.07, duty: 0.5, p: 'E5:2 G5:2 C6:2 E6:6' },
    { w: 'tri', v: 0.15, p: 'C4:4 E4:4 G4:4' },
  ] },
  jingle_levelup: { bpm: 170, ch: [
    { w: 'square', v: 0.07, duty: 0.25, p: 'G5:2 C6:2 E6:2 G6:6' },
  ] },
  jingle_item: { bpm: 170, ch: [
    { w: 'square', v: 0.07, duty: 0.5, p: 'B5:2 E6:6' },
  ] },
  jingle_key: { bpm: 110, ch: [
    { w: 'square', v: 0.08, duty: 0.25, p: 'C5:2 E5:2 G5:2 C6:4 -:2 G5:2 C6:2 E6:2 G6:12' },
    { w: 'tri', v: 0.18, p: 'C3:4 G3:4 C4:4 E4:4 G4:12' },
    { w: 'square', v: 0.035, duty: 0.5, p: 'E4:2 G4:2 C5:2 E5:4 -:2 C5:2 E5:2 G5:2 C6:12' },
  ] },
};
export const NON_LOOPING = new Set(['jingle_victory', 'jingle_boss', 'jingle_heal', 'jingle_levelup', 'jingle_item', 'jingle_key']);
