/**
 * Data-driven arena composition (A11).
 *
 * Rules (DECISIONS D9): integer positions, no scaling, compact (1-2 building
 * fronts), tiles stamped not repeated. Arena objects are built from the 'town'
 * atlas; anything procedurally drawn is flagged `placeholder: true` and listed
 * in docs/MISSING_ASSETS.md (the desert terrain sheet is blocker B1).
 *
 * Depth contract (shared with DuelScene/A02): arena back objects use NEGATIVE
 * depths, characters sit at CHARACTER_DEPTH (0, Phaser default), arena front
 * objects use 1..4, and the scene's tint/reticle/HUD stay at >= 5.
 */

export const ARENA_W = 360;
export const ARENA_H = 640;

export const ARENA_DEPTH = {
  sky: -100,
  far: -90,
  mid: -80,
  ground: -70,
  /** Back props/backdrops live in [propBackMin, propBackMax]. */
  propBackMin: -60,
  propBackMax: -1,
  character: 0,
  /** Front props/foreground live in [propFrontMin, propFrontMax]. */
  propFrontMin: 1,
  propFrontMax: 4,
} as const;

/** Character footprint (32x48 sprites at 2x, feet at zone x/y). */
export const ZONE_W = 64;
export const ZONE_H = 96;

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type LayerKind = 'sky' | 'far' | 'mid' | 'ground' | 'foreground';

/** One drawable thing inside a layer. */
export type LayerItem =
  /** PLACEHOLDER: stepped vertical colour bands, top to bottom. */
  | { type: 'bands'; y: number; h: number; colors: number[] }
  /** PLACEHOLDER: flat rect. */
  | { type: 'rect'; y: number; h: number; color: number }
  /** PLACEHOLDER: jagged mountain/mesa silhouette sitting on `y`. */
  | { type: 'ridge'; y: number; h: number; color: number; seed: number; step?: number }
  /** PLACEHOLDER: sun/moon disc. */
  | { type: 'disc'; x: number; y: number; r: number; color: number }
  /** PLACEHOLDER: deterministic dust/grain speckle over a band. */
  | { type: 'speckle'; y: number; h: number; color: number; seed: number; count: number }
  /** Atlas sprites stamped on a grid (tiles are stamped, not repeated). x,y = top-left of the VISIBLE area (1px edge halo cropped); step defaults to frame size - 2. */
  | { type: 'stamp'; frame: string; x: number; y: number; cols: number; rows: number; stepX?: number; stepY?: number };

export interface ArenaLayer {
  id: string;
  kind: LayerKind;
  /** 1 = locked to camera, <1 scrolls slower (far). Only matters if setScroll is used. */
  parallax: number;
  depth: number;
  /** True when ANY item in the layer is procedural stand-in art. */
  placeholder?: boolean;
  items: LayerItem[];
}

export interface ArenaProp {
  /** Optional id so target zones can reference the sprite. */
  id?: string;
  frame: string;
  /** Anchor position (the point of the sprite at `anchor`). Integers. */
  x: number;
  y: number;
  /** Origin override; default is anchorFor(frame) from data/animations. */
  anchor?: Pt;
  depth: number;
  flip?: boolean;
  /** Building/wall furniture that forms the backdrop; exempt from the lane-clear rule. */
  backdrop?: boolean;
  /** May extend past the screen edge (wide interiors). */
  bleed?: boolean;
  /** Ignore the arena tint (lanterns, lit windows). */
  bright?: boolean;
}

export interface TargetZoneDef {
  id: string;
  /** Prop that carries this target. */
  propId: string;
  /** Shootable rect in arena coordinates. */
  rect: Rect;
  /** Effect key for the scene to play on hit (e.g. 'sign_swing'). */
  effect: string;
}

/** Matches TargetSystem prop input ({id,x,y,w,h}) plus the effect key. */
export interface TargetZone extends Rect {
  id: string;
  effect: string;
}

export interface ArenaLight {
  x: number;
  y: number;
  r: number;
  color: number;
  /** Peak alpha of the glow core. */
  alpha: number;
  depth: number;
}

export interface ArenaDef {
  id: string;
  /** Region id (data/regions, A08). */
  region: string;
  layers: ArenaLayer[];
  props: ArenaProp[];
  /** Feet position of the hero / enemy. */
  heroZone: Pt;
  enemyZone: Pt;
  targetZones: TargetZoneDef[];
  /** Horizon / ground line y: everything above is sky or backdrop. */
  groundY: number;
  /** Multiply tint for all atlas sprites (night). 0xffffff = none. */
  tint?: number;
  /** PLACEHOLDER procedural glows. */
  lights?: ArenaLight[];
}

export interface AtlasFrameSize { w: number; h: number }
export type AtlasFrames = Readonly<Record<string, AtlasFrameSize>>;

/** Convert a TexturePacker-hash JSON (assets/generated/town_atlas.json) to frame sizes. */
export function atlasFramesFromJson(json: { frames: Record<string, { frame: { w: number; h: number } }> }): AtlasFrames {
  const out: Record<string, AtlasFrameSize> = {};
  for (const [k, v] of Object.entries(json.frames)) out[k] = { w: v.frame.w, h: v.frame.h };
  return out;
}
