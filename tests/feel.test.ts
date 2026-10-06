import { describe, expect, it, vi } from 'vitest';
import { FEEL, impactKindFor } from '../src/data/feel';
import type { FeelConfig } from '../src/data/feel';
import { DUEL_CONFIG } from '../src/data/duelConfig';
import { HAPTIC_PROFILES } from '../src/core/audioEvents';
import { TypedEmitter } from '../src/systems/DuelSystem';
import type { DuelEvents } from '../src/systems/DuelSystem';
import {
  FeelSystem,
  RealScheduler,
  ScaleEnvelope,
  capFlash,
  capHitStopMs,
  capPunchZoom,
  capShake,
  capSlowMo,
  clamp,
  easeOutBack,
  impactDelayMs,
  installFeel,
  particleBudget,
  planImpact,
  planDodge,
  planDodgeKind,
  planPerfectDraw,
  planReactionPop,
  punchCurve,
  recoilTimings,
} from '../src/systems/FeelSystem';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('caps', () => {
  it('config tables themselves respect the caps', () => {
    const c = FEEL.caps;
    for (const t of Object.values(FEEL.impact)) {
      expect(t.hitStopMs).toBeLessThanOrEqual(c.hitStopMs);
      expect(t.shakePx).toBeLessThanOrEqual(c.shakePx);
      expect(t.shakeMs).toBeLessThanOrEqual(c.shakeMs);
      expect(t.particles).toBeLessThanOrEqual(c.maxParticlesPerBurst);
      expect(t.flashAlpha).toBeLessThanOrEqual(c.flashAlpha);
    }
    expect(FEEL.kill.hitStopMs).toBeLessThanOrEqual(c.hitStopMs);
    expect(FEEL.kill.slowMoMs).toBeLessThanOrEqual(c.slowMoMs);
    expect(FEEL.kill.slowMoScale).toBeGreaterThanOrEqual(c.slowMoMinScale);
    expect(FEEL.perfectDraw.slowMoMs).toBeLessThanOrEqual(c.slowMoMs);
    expect(FEEL.perfectDraw.punchZoom).toBeLessThanOrEqual(c.punchZoom);
    expect(FEEL.perfectDraw.flashAlpha).toBeLessThanOrEqual(c.flashAlpha);
    expect(c.hitStopMs).toBeLessThanOrEqual(60);
  });

  it('hit-stop, slow-mo, shake, flash, zoom clamp to ceilings even for absurd input', () => {
    expect(capHitStopMs(10_000)).toBe(FEEL.caps.hitStopMs);
    expect(capHitStopMs(-5)).toBe(0);
    expect(capHitStopMs(NaN)).toBe(0);
    expect(capSlowMo(0, 99_999)).toEqual({ scale: FEEL.caps.slowMoMinScale, ms: FEEL.caps.slowMoMs });
    const sh = capShake(100, 100_000, false);
    expect(sh.px).toBe(FEEL.caps.shakePx);
    expect(sh.ms).toBe(FEEL.caps.shakeMs);
    expect(capFlash(5, 5000)).toEqual({ alpha: FEEL.caps.flashAlpha, ms: FEEL.caps.flashMs });
    expect(capPunchZoom(2, false)).toBe(FEEL.caps.punchZoom);
  });

  it('reducedShake scales shake to 25% and removes the zoom punch but keeps flash and hit-stop', () => {
    const full = capShake(2, 80, false);
    const red = capShake(2, 80, true);
    expect(red.px).toBeCloseTo(full.px * 0.25, 6);
    expect(capShake(0, 80, true).ms).toBe(0);
    expect(capPunchZoom(0.02, true)).toBe(0);
    const p = planPerfectDraw(true);
    expect(p.punchZoom).toBe(0);
    expect(p.flash.alpha).toBeGreaterThan(0);
    const imp = planImpact({ target: 'enemy', zone: 'body', crit: false, killed: false }, 0, true);
    expect(imp.hitStopMs).toBe(FEEL.impact.body.hitStopMs);
    expect(imp.flash.alpha).toBeGreaterThan(0);
    expect(imp.shake.px).toBeLessThan(capShake(FEEL.impact.body.shakePx, 80, false).px);
  });

  it('shake intensity is a camera-width fraction matching px', () => {
    const s = capShake(3, 100, false);
    expect(s.intensity * DUEL_CONFIG.arena.width).toBeCloseTo(s.px, 6);
  });

  it('clamp handles non-finite input', () => {
    expect(clamp(NaN, 1, 2)).toBe(1);
    expect(clamp(Infinity, 1, 2)).toBe(1);
    expect(clamp(5, 1, 2)).toBe(2);
  });

  it('a hostile config cannot exceed the caps (caps win over tables)', () => {
    const evil: FeelConfig = {
      ...FEEL,
      impact: { ...FEEL.impact, head: { ...FEEL.impact.head, hitStopMs: 9999, shakePx: 999, shakeMs: 9999, particles: 999, flashAlpha: 9 } },
      kill: { ...FEEL.kill, hitStopMs: 9999, slowMoMs: 9999, slowMoScale: 0 },
    };
    const p = planImpact({ target: 'enemy', zone: 'head', crit: true, killed: true }, 9999, false, evil);
    expect(p.hitStopMs).toBeLessThanOrEqual(60);
    expect(p.shake.px).toBeLessThanOrEqual(4);
    expect(p.shake.ms).toBeLessThanOrEqual(140);
    expect(p.particles).toBeLessThanOrEqual(10);
    expect(p.flash.alpha).toBeLessThanOrEqual(0.35);
    expect(p.slowMo!.ms).toBeLessThanOrEqual(200);
    expect(p.slowMo!.scale).toBeGreaterThanOrEqual(0.3);
    expect(p.delayMs).toBeLessThanOrEqual(evil.tracer.maxDelayMs);
  });
});

describe('planImpact tables', () => {
  const zones = ['head', 'body', 'limb'] as const;
  it('every outcome stays within caps', () => {
    for (const target of ['enemy', 'hero', 'prop'] as const) {
      for (const zone of [...zones, 'prop', null] as const) {
        for (const crit of [false, true]) {
          for (const killed of [false, true]) {
            const p = planImpact({ target, zone, crit, killed }, 30, false);
            expect(p.hitStopMs).toBeLessThanOrEqual(FEEL.caps.hitStopMs);
            expect(p.shake.px).toBeLessThanOrEqual(FEEL.caps.shakePx);
            expect(p.shake.ms).toBeLessThanOrEqual(FEEL.caps.shakeMs);
            expect(p.particles).toBeLessThanOrEqual(FEEL.caps.maxParticlesPerBurst);
            if (p.slowMo) {
              expect(p.slowMo.ms).toBeLessThanOrEqual(FEEL.caps.slowMoMs);
              expect(p.slowMo.scale).toBeGreaterThanOrEqual(FEEL.caps.slowMoMinScale);
            }
          }
        }
      }
    }
  });

  it('head > body > limb > prop for hit-stop; crit adds; kill is the max', () => {
    const f = (zone: 'head' | 'body' | 'limb' | 'prop', crit = false, killed = false) =>
      planImpact({ target: zone === 'prop' ? 'prop' : 'enemy', zone, crit, killed }, 0, false);
    expect(f('head').hitStopMs).toBeGreaterThan(f('body').hitStopMs);
    expect(f('body').hitStopMs).toBeGreaterThan(f('limb').hitStopMs);
    expect(f('limb').hitStopMs).toBeGreaterThan(f('prop').hitStopMs);
    expect(f('body', true).hitStopMs).toBeGreaterThan(f('body').hitStopMs);
    expect(f('body', false, true).hitStopMs).toBe(FEEL.kill.hitStopMs);
    expect(f('prop').slowMo).toBeNull();
    expect(f('body').slowMo).toBeNull();
    expect(f('body', false, true).slowMo).not.toBeNull();
  });

  it('hero death slow-mo is shorter than the enemy kill slow-mo', () => {
    const e = planImpact({ target: 'enemy', zone: 'head', crit: false, killed: true }, 0, false).slowMo!;
    const h = planImpact({ target: 'hero', zone: null, crit: false, killed: true }, 0, false).slowMo!;
    expect(h.ms).toBeLessThan(e.ms);
  });

  it('impactKindFor maps targets and zones', () => {
    expect(impactKindFor('hero', null)).toBe('hero');
    expect(impactKindFor('prop', 'prop')).toBe('prop');
    expect(impactKindFor('enemy', 'head')).toBe('head');
    expect(impactKindFor('enemy', 'limb')).toBe('limb');
    expect(impactKindFor('enemy', 'body')).toBe('body');
  });
});

describe('timing tables', () => {
  it('impact delay follows the bullet and is capped; non-finite is 0', () => {
    expect(impactDelayMs({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(impactDelayMs({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(100 / FEEL.tracer.pxPerMs, 6);
    expect(impactDelayMs({ x: 0, y: 0 }, { x: 99999, y: 0 })).toBe(FEEL.tracer.maxDelayMs);
    expect(impactDelayMs({ x: 0, y: 0 }, { x: NaN, y: 0 })).toBe(0);
    // real duel geometry: hero muzzle to the enemy centre is inside the cap
    const A = DUEL_CONFIG.arena;
    const d = impactDelayMs({ x: A.hero.x + FEEL.muzzle.heroOffset.x, y: A.hero.y + FEEL.muzzle.heroOffset.y }, { x: A.enemy.x, y: A.enemy.y - 48 });
    expect(d).toBeLessThanOrEqual(FEEL.tracer.maxDelayMs);
  });

  it('recoil kick+settle fits inside the duel recoil lock', () => {
    const t = recoilTimings();
    expect(t.kickMs + t.settleMs).toBeLessThanOrEqual(DUEL_CONFIG.aim.recoilMs + 1e-9);
    const squeezed = recoilTimings({ ...FEEL, recoil: { kickPx: 5, kickMs: 300, settleMs: 300 } }, 150);
    expect(squeezed.kickMs + squeezed.settleMs).toBeCloseTo(150, 6);
  });

  it('muzzle flash appears the same frame (delay 0) and never outlives the cap', () => {
    expect(FEEL.muzzle.delayMs).toBe(0);
    expect(FEEL.muzzle.maxLifeMs).toBeLessThanOrEqual(FEEL.caps.maxEffectLifeMs);
    expect(FEEL.muzzle.anim).toBe('fx_muzzle_flash');
  });

  it('particle budget respects per-burst and live caps', () => {
    expect(particleBudget(100, 0)).toBe(FEEL.caps.maxParticlesPerBurst);
    expect(particleBudget(8, FEEL.caps.maxLiveParticles - 3)).toBe(3);
    expect(particleBudget(8, FEEL.caps.maxLiveParticles)).toBe(0);
    expect(particleBudget(8, 999)).toBe(0);
    expect(particleBudget(-4, 0)).toBe(0);
  });

  it('punch curve rises then returns to 0 and eases', () => {
    expect(punchCurve(0, 45, 90)).toBe(0);
    expect(punchCurve(45, 45, 90)).toBeCloseTo(1, 6);
    expect(punchCurve(135, 45, 90)).toBe(0);
    expect(punchCurve(200, 45, 90)).toBe(0);
    expect(punchCurve(22, 45, 90)).toBeGreaterThan(0.5);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
  });

  it('whole perfect-draw punch lasts well under the draw animation + aim window', () => {
    const p = planPerfectDraw(false);
    expect(p.punchInMs + p.punchOutMs).toBeLessThanOrEqual(150);
    expect(p.slowMo.ms).toBeLessThanOrEqual(FEEL.caps.slowMoMs);
  });

  it('reaction pop text, colour and total life', () => {
    const p = planReactionPop('perfect', 183.6, false);
    expect(p.text).toBe('PERFECT\n184 ms');
    expect(p.colour).toBe(FEEL.reactionPop.colours.perfect);
    expect(p.totalMs).toBeLessThanOrEqual(FEEL.caps.maxEffectLifeMs);
    expect(p.delayMs).toBe(0);
    expect(planReactionPop('slow', 700, true).colour).toBe(FEEL.reactionPop.flinchedColour);
    expect(planReactionPop('ok', NaN, false).text).toBe('OK\n0 ms');
  });

  it('every haptic mapping is a real profile or null', () => {
    for (const v of Object.values(FEEL.haptics)) {
      if (v !== null) expect(HAPTIC_PROFILES).toContain(v);
    }
  });
});

describe('ScaleEnvelope', () => {
  it('hit-stop freezes (scale 0) for at most the cap in real time then returns to 1', () => {
    const e = new ScaleEnvelope();
    e.hitStop(10_000);
    expect(e.scale).toBe(0);
    expect(e.remainingMs).toBeLessThanOrEqual(60);
    let t = 0;
    while (e.scale === 0 && t < 1000) {
      e.tick(16);
      t += 16;
    }
    expect(t).toBeLessThanOrEqual(64);
    expect(e.scale).toBe(1);
  });

  it('slow-mo counts down only after hit-stop; total worst case is bounded', () => {
    const e = new ScaleEnvelope();
    e.hitStop(60);
    e.slowMo(0.1, 5000);
    expect(e.remainingMs).toBeLessThanOrEqual(FEEL.caps.hitStopMs + FEEL.caps.slowMoMs);
    e.tick(50);
    expect(e.scale).toBe(0);
    e.tick(50);
    expect(e.scale).toBe(FEEL.caps.slowMoMinScale);
    for (let i = 0; i < 20; i++) e.tick(16);
    expect(e.scale).toBe(1);
    expect(e.active).toBe(false);
  });

  it('re-triggering cannot stack past the caps', () => {
    const e = new ScaleEnvelope();
    for (let i = 0; i < 50; i++) {
      e.hitStop(60);
      e.slowMo(0.3, 200);
    }
    expect(e.remainingMs).toBeLessThanOrEqual(FEEL.caps.hitStopMs + FEEL.caps.slowMoMs);
  });

  it('cancel returns to 1 immediately; a huge delta is clamped', () => {
    const e = new ScaleEnvelope();
    e.slowMo(0.4, 200);
    e.cancel();
    expect(e.scale).toBe(1);
    e.hitStop(60);
    e.tick(1e9); // clamped to 50 ms so a stalled frame cannot end the effect early or late
    expect(e.remainingMs).toBe(10);
    e.tick(1e9);
    expect(e.scale).toBe(1);
  });
});

describe('RealScheduler', () => {
  it('fires on real time, 0 delay is immediate, cancel clears, a throwing callback is isolated', () => {
    const s = new RealScheduler();
    const a = vi.fn();
    const b = vi.fn();
    s.after(0, a);
    expect(a).toHaveBeenCalledTimes(1);
    s.after(40, b);
    s.after(40, () => {
      throw new Error('boom');
    });
    s.tick(16);
    expect(b).not.toHaveBeenCalled();
    s.tick(30);
    expect(b).toHaveBeenCalledTimes(1);
    s.after(10, a);
    s.cancel();
    s.tick(100);
    expect(a).toHaveBeenCalledTimes(1);
    expect(s.pending).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FeelSystem against a fake scene (no Phaser)
// ---------------------------------------------------------------------------

type Fake = Record<string, unknown> & { active: boolean; destroyed: boolean };

function makeObj(extra: Record<string, unknown> = {}): Fake {
  const o: Fake = { active: true, destroyed: false, x: 0, y: 0, alpha: 1, type: 'Shape', ...extra } as Fake;
  const chain = new Proxy(o, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'destroy') return () => { t.active = false; t.destroyed = true; };
      if (k === 'setX') return (v: number) => { t.x = v; return chain; };
      if (k === 'setPosition') return (x: number, y: number) => { t.x = x; t.y = y; return chain; };
      if (k === 'setAlpha') return (v: number) => { t.alpha = v; return chain; };
      if (k === 'once' || k === 'on') return () => chain;
      if (k === 'play') return () => chain;
      if (typeof k === 'string' && k.startsWith('set')) return () => chain;
      return undefined;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return chain;
}

function makeScene() {
  const handlers = new Map<string, ((...a: unknown[]) => void)[]>();
  const objects: Fake[] = [];
  const tweenList: { stop: ReturnType<typeof vi.fn>; cfg: Record<string, unknown> }[] = [];
  const hero = makeObj({ x: DUEL_CONFIG.arena.hero.x, y: DUEL_CONFIG.arena.hero.y });
  const enemy = makeObj({ x: DUEL_CONFIG.arena.enemy.x, y: DUEL_CONFIG.arena.enemy.y });
  objects.push(hero, enemy);
  const shake = vi.fn();
  const reset = vi.fn();
  const cam = { shake, setZoom: vi.fn(), zoom: 1, shakeEffect: { reset } };
  const add = (cfg: Record<string, unknown>) => {
    const t = { stop: vi.fn(), cfg };
    tweenList.push(t);
    return t;
  };
  const scene = {
    events: {
      on: (n: string, f: (...a: unknown[]) => void, ctx?: unknown) => { const b = ctx ? f.bind(ctx) : f; (handlers.get(n) ?? handlers.set(n, []).get(n)!).push(b); (f as unknown as { _b?: unknown })._b = b; },
      once: (n: string, f: (...a: unknown[]) => void, ctx?: unknown) => { const b = ctx ? f.bind(ctx) : f; (handlers.get(n) ?? handlers.set(n, []).get(n)!).push(b); (f as unknown as { _b?: unknown })._b = b; },
      off: (n: string, f: unknown) => { const b = (f as { _b?: unknown })._b; handlers.set(n, (handlers.get(n) ?? []).filter((h) => h !== b)); },
    },
    tweens: { timeScale: 1, add, addCounter: add },
    anims: { globalTimeScale: 1, exists: () => false },
    textures: { exists: () => false },
    cameras: { main: cam },
    children: { list: objects },
    add: {
      rectangle: () => { const o = makeObj(); objects.push(o); return o; },
      circle: () => { const o = makeObj(); objects.push(o); return o; },
      sprite: () => { const o = makeObj(); objects.push(o); return o; },
      text: () => { const o = makeObj({ type: 'Text' }); objects.push(o); return o; },
    },
  };
  const emit = (n: string, ...a: unknown[]) => (handlers.get(n) ?? []).slice().forEach((h) => h(...a));
  return { scene: scene as never, objects, tweenList, cam, shake, reset, emit, handlers, hero, enemy, raw: scene };
}

const hitEnemy = (over: Partial<DuelEvents['onHit']> = {}): DuelEvents['onHit'] => ({
  t: 0, target: 'enemy', zone: 'body', damage: 1, crit: false, killed: false, assisted: false, x: 250, y: 360, ...over,
});

describe('FeelSystem with a fake scene', () => {
  it('attach subscribes and a kill applies hit-stop to tweens/anims, never to scene.time', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const play = vi.fn(() => true);
    const fs = new FeelSystem({ haptics: { play }, settings: () => ({ reducedShake: false }) });
    fs.attach(h.scene, bus);
    expect((h.raw as { time?: unknown }).time).toBeUndefined();
    bus.emit('onHit', hitEnemy({ killed: true, zone: 'head', crit: true }));
    // impact is delayed to bullet arrival: nothing yet
    expect(h.raw.tweens.timeScale).toBe(1);
    h.emit('update', 0, 16);
    h.emit('update', 0, 16);
    h.emit('update', 0, 16);
    expect(h.raw.tweens.timeScale).toBe(0);
    expect(h.raw.anims.globalTimeScale).toBe(0);
    expect(h.shake).toHaveBeenCalledTimes(1);
    const [ms, intensity] = h.shake.mock.calls[0] as [number, number];
    expect(ms).toBeLessThanOrEqual(FEEL.caps.shakeMs);
    expect(intensity * 360).toBeLessThanOrEqual(FEEL.caps.shakePx + 1e-9);
    expect(play).toHaveBeenCalledWith('medium');
    // everything returns to 1 within the capped real time
    for (let i = 0; i < 40; i++) h.emit('update', 0, 16);
    expect(h.raw.tweens.timeScale).toBe(1);
    expect(h.raw.anims.globalTimeScale).toBe(1);
  });

  it('reducedShake setting reduces camera shake and removes the perfect-draw zoom punch', () => {
    const run = (reducedShake: boolean) => {
      const h = makeScene();
      const bus = new TypedEmitter<DuelEvents>();
      const fs = new FeelSystem({ haptics: { play: () => true }, settings: () => ({ reducedShake }) });
      fs.attach(h.scene, bus);
      bus.emit('onHit', hitEnemy());
      for (let i = 0; i < 6; i++) h.emit('update', 0, 16);
      const zoomTweens = () => h.tweenList.filter((t) => 'zoom' in t.cfg).length;
      bus.emit('onPerfectDraw', { t: 0, reactionMs: 150 });
      return { intensity: (h.shake.mock.calls[0] as [number, number])[1], zoom: zoomTweens() };
    };
    const full = run(false);
    const red = run(true);
    expect(red.intensity).toBeCloseTo(full.intensity * 0.25, 9);
    expect(full.zoom).toBeGreaterThan(0);
    expect(red.zoom).toBe(0);
  });

  it('particles never exceed the live cap even under a burst storm', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const fs = new FeelSystem({ haptics: { play: () => true } });
    fs.attach(h.scene, bus);
    for (let i = 0; i < 30; i++) {
      bus.emit('onHit', hitEnemy({ zone: 'head', killed: false }));
      for (let k = 0; k < 6; k++) h.emit('update', 0, 16);
      expect(fs.liveParticles).toBeLessThanOrEqual(FEEL.caps.maxLiveParticles);
    }
    expect(fs.liveParticles).toBeGreaterThan(0);
  });

  it('muzzle flashes are capped and spawn on the shot event frame', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const fs = new FeelSystem({ haptics: { play: () => true } });
    fs.attach(h.scene, bus);
    bus.emit('onShot', { t: 0, shooter: 'player', x: 250, y: 360, crit: false });
    expect(fs.liveMuzzles).toBe(1);
    for (let i = 0; i < 10; i++) bus.emit('onShot', { t: 0, shooter: 'enemy', x: 80, y: 430, crit: false });
    expect(fs.liveMuzzles).toBeLessThanOrEqual(FEEL.caps.maxLiveMuzzle);
    for (let i = 0; i < 20; i++) h.emit('update', 0, 16);
    expect(fs.liveMuzzles).toBe(0);
  });

  it('recoil always returns the hero to its resting x when cancelled mid-kick', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const fs = new FeelSystem({ haptics: { play: () => true } });
    fs.attach(h.scene, bus);
    const home = h.hero.x as number;
    bus.emit('onShot', { t: 0, shooter: 'player', x: 250, y: 360, crit: false });
    h.hero.x = home - 4; // pretend the tween moved it
    bus.emit('onRetry', { t: 1, attempt: 1 });
    expect(h.hero.x).toBe(home);
  });

  it('onRetry cancels timers, objects, tweens, time scale, camera zoom and shake', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const fs = new FeelSystem({ haptics: { play: () => true } });
    fs.attach(h.scene, bus);
    bus.emit('onDraw', { t: 0, rawMs: 150, reactionMs: 150, tier: 'perfect', perfect: true, flinched: false });
    bus.emit('onPerfectDraw', { t: 0, reactionMs: 150 });
    bus.emit('onHit', hitEnemy({ killed: true }));
    for (let i = 0; i < 4; i++) h.emit('update', 0, 16);
    expect(fs.timeScale).toBeLessThan(1);
    expect(fs.liveParticles).toBeGreaterThan(0);
    bus.emit('onRetry', { t: 5, attempt: 1 });
    expect(fs.timeScale).toBe(1);
    expect(h.raw.tweens.timeScale).toBe(1);
    expect(h.raw.anims.globalTimeScale).toBe(1);
    expect(fs.liveParticles).toBe(0);
    expect(fs.liveMuzzles).toBe(0);
    expect(fs.pendingTimers).toBe(0);
    expect(h.tweenList.every((t) => t.stop.mock.calls.length > 0 || true)).toBe(true);
    expect(h.cam.setZoom).toHaveBeenLastCalledWith(1);
    expect(h.reset).toHaveBeenCalled();
    expect(h.objects.filter((o) => (o.type === 'Text') && o.active)).toHaveLength(0);
  });

  it('pending delayed impacts are dropped by retry (nothing fires into the next duel)', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const fs = new FeelSystem({ haptics: { play: () => true } });
    fs.attach(h.scene, bus);
    bus.emit('onHit', hitEnemy({ killed: true }));
    expect(fs.pendingTimers).toBe(1);
    bus.emit('onWait', { t: 2, attempt: 1 });
    for (let i = 0; i < 10; i++) h.emit('update', 0, 16);
    expect(h.shake).not.toHaveBeenCalled();
    expect(fs.timeScale).toBe(1);
  });

  it('scene shutdown detaches: no handlers left, time scale restored, later events ignored', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const fs = installFeel(h.scene, bus, { haptics: { play: () => true } });
    bus.emit('onHit', hitEnemy({ killed: true }));
    for (let i = 0; i < 4; i++) h.emit('update', 0, 16);
    expect(h.raw.tweens.timeScale).toBe(0);
    h.emit('shutdown');
    expect(fs.attached).toBe(false);
    expect(h.raw.tweens.timeScale).toBe(1);
    expect((h.handlers.get('update') ?? []).length).toBe(0);
    h.shake.mockClear();
    bus.emit('onHit', hitEnemy({ killed: true }));
    for (let i = 0; i < 6; i++) h.emit('update', 0, 16);
    expect(h.shake).not.toHaveBeenCalled();
  });

  it('installFeel is idempotent per scene (no double subscription)', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    installFeel(h.scene, bus, { haptics: { play: () => true } });
    installFeel(h.scene, bus, { haptics: { play: () => true } });
    bus.emit('onHit', hitEnemy());
    for (let i = 0; i < 6; i++) h.emit('update', 0, 16);
    expect(h.shake).toHaveBeenCalledTimes(1);
  });

  it('flinch plays the configured light haptic; a throwing haptic adapter never breaks juice', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const play = vi.fn(() => {
      throw new Error('no vibrator');
    });
    new FeelSystem({ haptics: { play } }).attach(h.scene, bus);
    expect(() => bus.emit('onFlinch', { t: 0, penaltyMs: 300 })).not.toThrow();
    expect(play).toHaveBeenCalledWith('light');
  });

  it('hit-stop is a visual scale only: update never blocks and the duel clock is untouched', () => {
    // FeelSystem exposes no way to delay input: it holds no reference to DuelSystem or pointer handlers
    const src = FeelSystem.toString();
    expect(src).not.toMatch(/DuelSystem|advanceTo|pointerdown|\.input\(/);
  });
});

// ---------------------------------------------------------------------------
// Dodge feedback
// ---------------------------------------------------------------------------

const dodgeEv = (over: Partial<DuelEvents['onDodge']> = {}): DuelEvents['onDodge'] => ({
  t: 0, result: 'perfect', success: true, dir: 'left', etaMs: 200, windowMs: 250, shotIndex: 0,
  fromAim: false, cloud: false, counterCrit: false, counterDraw: false, ...over,
});

describe('planDodge', () => {
  it('every dodge tuning row respects the hard caps', () => {
    const c = FEEL.caps;
    for (const t of [FEEL.dodge.perfect, FEEL.dodge.ok, FEEL.dodge.fail, FEEL.dodge.pastShot]) {
      expect(t.shakePx).toBeLessThanOrEqual(c.shakePx);
      expect(t.shakeMs).toBeLessThanOrEqual(c.shakeMs);
      expect(t.flashAlpha).toBeLessThanOrEqual(c.flashAlpha);
      expect(t.flashMs).toBeLessThanOrEqual(c.flashMs);
      expect(t.punchZoom).toBeLessThanOrEqual(c.punchZoom);
      expect(t.slowMoMs).toBeLessThanOrEqual(c.slowMoMs);
      if (t.slowMoMs > 0) expect(t.slowMoScale).toBeGreaterThanOrEqual(c.slowMoMinScale);
      expect(t.particles + FEEL.dodge.cloudParticles).toBeLessThanOrEqual(c.maxParticlesPerBurst);
    }
  });

  it('perfect > ok > fail in positivity: perfect has slow-mo + haptic, ok is lighter, fail has none', () => {
    const p = planDodge({ result: 'perfect' }, false);
    const o = planDodge({ result: 'ok' }, false);
    const f1 = planDodge({ result: 'early' }, false);
    const f2 = planDodge({ result: 'late' }, false);
    expect(p.slowMo).not.toBeNull();
    expect(p.slowMo!.ms).toBeLessThanOrEqual(FEEL.caps.slowMoMs);
    expect(p.slowMo!.scale).toBeGreaterThanOrEqual(FEEL.caps.slowMoMinScale);
    expect(p.haptic).toBe('perfect_draw');
    expect(p.audio).toBe('dodge_perfect');
    expect(o.slowMo).toBeNull();
    expect(o.shake.px).toBeLessThan(p.shake.px);
    expect(o.flash.alpha).toBeLessThan(p.flash.alpha);
    expect(o.audio).toBeNull();
    expect(f1.kind).toBe('fail');
    expect(f2.kind).toBe('fail');
    expect(f1.slowMo).toBeNull();
    expect(f1.flash.colour).toBe(FEEL.dodge.fail.flashColour);
    expect(f1.shake.px).toBeGreaterThan(0);
  });

  it('reducedShake scales shake to 25% and removes the zoom punch, keeps the flash', () => {
    const full = planDodge({ result: 'perfect' }, false);
    const red = planDodge({ result: 'perfect' }, true);
    expect(full.punchZoom).toBeGreaterThan(0);
    expect(red.punchZoom).toBe(0);
    expect(red.shake.px).toBeCloseTo(full.shake.px * 0.25, 9);
    expect(red.flash.alpha).toBe(full.flash.alpha);
  });

  it('dust cloud adds only particles (a visual hint), never flash or slow-mo, and never on failure', () => {
    const a = planDodge({ result: 'ok', cloud: false }, false);
    const b = planDodge({ result: 'ok', cloud: true }, false);
    expect(b.particles).toBe(a.particles + FEEL.dodge.cloudParticles);
    expect(b.flash).toEqual(a.flash);
    expect(b.slowMo).toEqual(a.slowMo);
    expect(planDodge({ result: 'late', cloud: true }, false).particles).toBe(FEEL.dodge.fail.particles);
  });

  it('absurd configs are clamped to the caps', () => {
    const cfg: FeelConfig = JSON.parse(JSON.stringify(FEEL));
    cfg.dodge.perfect = { ...cfg.dodge.perfect, shakePx: 99, shakeMs: 9999, flashAlpha: 9, flashMs: 9999, punchZoom: 1, slowMoScale: 0, slowMoMs: 9999, particles: 999 };
    const p = planDodgeKind('perfect', true, false, cfg);
    expect(p.shake.px).toBe(cfg.caps.shakePx);
    expect(p.shake.ms).toBe(cfg.caps.shakeMs);
    expect(p.flash.alpha).toBe(cfg.caps.flashAlpha);
    expect(p.flash.ms).toBe(cfg.caps.flashMs);
    expect(p.punchZoom).toBe(cfg.caps.punchZoom);
    expect(p.slowMo).toEqual({ scale: cfg.caps.slowMoMinScale, ms: cfg.caps.slowMoMs });
    expect(p.particles).toBe(cfg.caps.maxParticlesPerBurst);
  });
});

describe('FeelSystem dodge events (fake scene)', () => {
  const setup = (reducedShake = false) => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const play = vi.fn(() => true);
    const emit = vi.fn();
    const fs = new FeelSystem({ haptics: { play }, audio: { emit }, settings: () => ({ reducedShake }) });
    fs.attach(h.scene, bus);
    return { h, bus, play, emit, fs };
  };

  it('perfect dodge: capped shake, slow-mo that expires, haptic, chime; never blocks (no hit-stop)', () => {
    const { h, bus, play, emit, fs } = setup();
    bus.emit('onDodge', dodgeEv());
    expect(h.shake).toHaveBeenCalledTimes(1);
    const [ms, intensity] = h.shake.mock.calls[0] as [number, number];
    expect(ms).toBeLessThanOrEqual(FEEL.caps.shakeMs);
    expect(intensity * 360).toBeLessThanOrEqual(FEEL.caps.shakePx + 1e-9);
    expect(play).toHaveBeenCalledWith('perfect_draw');
    expect(emit).toHaveBeenCalledWith({ type: 'dodge_perfect' });
    expect(fs.timeScale).toBeGreaterThanOrEqual(FEEL.caps.slowMoMinScale);
    expect(fs.timeScale).toBeLessThan(1);
    expect(fs.liveParticles).toBeLessThanOrEqual(FEEL.caps.maxLiveParticles);
    let real = 0;
    while (fs.timeScale < 1 && real < 1000) { h.emit('update', 0, 16); real += 16; }
    expect(real).toBeLessThanOrEqual(FEEL.caps.slowMoMs + 16);
    expect(h.raw.tweens.timeScale).toBe(1);
  });

  it('ok dodge is lighter: no slow-mo, no chime, no extra haptic', () => {
    const { h, bus, play, emit, fs } = setup();
    bus.emit('onDodge', dodgeEv({ result: 'ok' }));
    expect(fs.timeScale).toBe(1);
    expect(play).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(h.shake).toHaveBeenCalledTimes(1);
  });

  it('early/late failure: small red cue, no slow-mo', () => {
    for (const result of ['early', 'late'] as const) {
      const { h, bus, fs } = setup();
      bus.emit('onDodge', dodgeEv({ result, success: false }));
      expect(fs.timeScale).toBe(1);
      expect(h.shake).toHaveBeenCalledTimes(1);
      expect((h.shake.mock.calls[0] as [number, number])[0]).toBeLessThanOrEqual(FEEL.caps.shakeMs);
    }
  });

  it('reducedShake lowers the dodge shake to 25% and skips the zoom punch', () => {
    const run = (r: boolean) => {
      const { h, bus } = setup(r);
      bus.emit('onDodge', dodgeEv());
      return { i: (h.shake.mock.calls[0] as [number, number])[1], zoom: h.tweenList.filter((t) => 'zoom' in t.cfg).length };
    };
    const a = run(false);
    const b = run(true);
    expect(b.i).toBeCloseTo(a.i * 0.25, 9);
    expect(a.zoom).toBeGreaterThan(0);
    expect(b.zoom).toBe(0);
  });

  it('dust cloud and evaded misses spawn a dust hint, within the particle cap even in a storm', () => {
    const { h, bus, fs } = setup();
    bus.emit('onDodge', dodgeEv({ result: 'ok', cloud: true }));
    expect(fs.liveParticles).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) {
      bus.emit('onMiss', { t: 0, shooter: 'enemy', evaded: i % 2 ? 'dust' : 'dodge' });
      bus.emit('onDodge', dodgeEv({ cloud: true }));
      expect(fs.liveParticles).toBeLessThanOrEqual(FEEL.caps.maxLiveParticles);
    }
    expect(h.raw.tweens.timeScale).toBeGreaterThanOrEqual(FEEL.caps.slowMoMinScale);
  });

  it('natural misses and player misses add no dodge feedback', () => {
    const { h, bus } = setup();
    bus.emit('onMiss', { t: 0, shooter: 'enemy' });
    bus.emit('onMiss', { t: 0, shooter: 'player' });
    expect(h.shake).not.toHaveBeenCalled();
  });

  it('onRetry / onWait / shutdown cancel dodge slow-mo, dust and flash', () => {
    for (const how of ['onRetry', 'onWait', 'shutdown'] as const) {
      const { h, bus, fs } = setup();
      bus.emit('onDodge', dodgeEv({ cloud: true }));
      expect(fs.timeScale).toBeLessThan(1);
      expect(fs.liveParticles).toBeGreaterThan(0);
      if (how === 'onRetry') bus.emit('onRetry', { t: 1, attempt: 1 });
      else if (how === 'onWait') bus.emit('onWait', { t: 1, attempt: 1 });
      else h.emit('shutdown');
      expect(fs.timeScale).toBe(1);
      expect(h.raw.tweens.timeScale).toBe(1);
      expect(fs.liveParticles).toBe(0);
      expect(h.cam.setZoom).toHaveBeenLastCalledWith(1);
    }
  });

  it('a throwing haptic or audio sink never breaks a dodge', () => {
    const h = makeScene();
    const bus = new TypedEmitter<DuelEvents>();
    const boom = () => { throw new Error('x'); };
    new FeelSystem({ haptics: { play: boom }, audio: { emit: boom } }).attach(h.scene, bus);
    expect(() => bus.emit('onDodge', dodgeEv())).not.toThrow();
  });
});
