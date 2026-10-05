export type Btn = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'run';
const ALL: Btn[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'run'];

class InputSys {
  down: Record<Btn, boolean> = { up: false, down: false, left: false, right: false, a: false, b: false, start: false, run: false };
  private waiters: { f: (b: Btn) => boolean; r: (b: Btn) => void }[] = [];
  private held: Partial<Record<Btn, { t: number; next: number }>> = {};
  private pressedFrame: Partial<Record<Btn, boolean>> = {};
  runToggle = false;
  typing = false;
  keyMap: Record<string, Btn> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
    z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b', Shift: 'run', c: 'start', Tab: 'start', m: 'start',
  };
  init() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || this.typing) return;
      const b = this.keyMap[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!b) return;
      e.preventDefault();
      if (!this.down[b]) this.press(b);
    });
    window.addEventListener('keyup', (e) => { const b = this.keyMap[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (b) this.release(b); });
    window.addEventListener('blur', () => ALL.forEach((b) => this.release(b)));
    // touch buttons
    const bind = (id: string, b: Btn) => {
      const el = document.getElementById(id); if (!el) return;
      const on = (e: Event) => { e.preventDefault(); el.classList.add('on'); if (!this.down[b]) this.press(b); };
      const off = (e: Event) => { e.preventDefault(); el.classList.remove('on'); this.release(b); };
      el.addEventListener('pointerdown', (e) => { (e.target as Element).setPointerCapture?.((e as PointerEvent).pointerId); on(e); });
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bind('up', 'up'); bind('down', 'down'); bind('left', 'left'); bind('right', 'right'); bind('a', 'a'); bind('b', 'b'); bind('start', 'start');
    const spd = document.getElementById('spd');
    if (spd) spd.addEventListener('pointerdown', (e) => { e.preventDefault(); this.runToggle = !this.runToggle; spd.textContent = this.runToggle ? 'RUN*' : 'RUN'; });
  }
  press(b: Btn) {
    this.down[b] = true; this.pressedFrame[b] = true;
    this.held[b] = { t: performance.now(), next: performance.now() + 260 };
    this.fire(b);
  }
  release(b: Btn) { this.down[b] = false; delete this.held[b]; }
  private fire(b: Btn) {
    const i = this.waiters.findIndex((w) => w.f(b));
    if (i >= 0) { const [w] = this.waiters.splice(i, 1); this.pressedFrame[b] = false; w.r(b); }
  }
  private padPrev: Partial<Record<Btn, boolean>> = {};
  private pollPad() {
    const pads = (navigator.getGamepads?.() ?? []) as (Gamepad | null)[];
    const cur: Partial<Record<Btn, boolean>> = {};
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0, bt = (i: number) => !!p.buttons[i]?.pressed;
      cur.left ||= bt(14) || ax < -0.5; cur.right ||= bt(15) || ax > 0.5; cur.up ||= bt(12) || ay < -0.5; cur.down ||= bt(13) || ay > 0.5;
      cur.a ||= bt(0); cur.b ||= bt(1); cur.start ||= bt(9) || bt(8); cur.run ||= bt(2) || bt(5);
    }
    for (const b of ALL) { const now = !!cur[b], was = !!this.padPrev[b]; if (now && !was) this.press(b); else if (!now && was) this.release(b); this.padPrev[b] = now; }
  }
  /** call every frame: key-repeat for directions while waiting in menus; polls gamepads */
  update() {
    this.pollPad();
    const now = performance.now();
    for (const b of ['up', 'down', 'left', 'right'] as Btn[]) {
      const h = this.held[b];
      if (h && now >= h.next && this.waiters.length) { h.next = now + 90; this.fire(b); }
    }
  }
  consumePressed(b: Btn) { const v = !!this.pressedFrame[b]; this.pressedFrame[b] = false; return v; }
  clearPressed() { this.pressedFrame = {}; }
  isDown(b: Btn) { return this.down[b]; }
  wait(filter: Btn[] = ['a', 'b', 'up', 'down', 'left', 'right', 'start']): Promise<Btn> {
    return new Promise((res) => this.waiters.push({ f: (b) => filter.includes(b), r: res }));
  }
  cancelWaiters() { this.waiters = []; }
}
export const Input = new InputSys();
