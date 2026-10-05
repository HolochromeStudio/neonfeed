/** Small statistics helpers for the balance simulations (A18). Pure, no node APIs. */

export const mean = (a: readonly number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export function quantile(a: readonly number[], q: number): number {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const i = Math.min(b.length - 1, Math.max(0, Math.floor(q * (b.length - 1) + 0.5)));
  return b[i];
}
export const median = (a: readonly number[]): number => quantile(a, 0.5);

/** Wilson 95% interval for k successes of n. */
export function wilson(k: number, n: number): { p: number; lo: number; hi: number } {
  if (n === 0) return { p: 0, lo: 0, hi: 0 };
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d) };
}

/** Two-proportion z statistic (a vs b). */
export function zDiff(ka: number, na: number, kb: number, nb: number): number {
  if (!na || !nb) return 0;
  const pa = ka / na, pb = kb / nb;
  const p = (ka + kb) / (na + nb);
  const se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
  return se === 0 ? 0 : (pa - pb) / se;
}

export const pct = (p: number, d = 0): string => `${(p * 100).toFixed(d)}%`;
export const f1 = (v: number): string => v.toFixed(1);

/** Markdown table from rows of strings. */
export function table(head: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const line = (r: readonly (string | number)[]): string => `| ${r.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}
