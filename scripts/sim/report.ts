/** Assembles the full balance report (A18). Node-free so tests can call it; run.ts writes the files. */
import * as S from './sections';
import { ONE_AT_A_TIME, PACKAGES, PERK_WHATIFS } from './levers';
import { withPatch } from './scenarios';
import { AVERAGE } from './skills';
import { pct } from './stats';
import { DUEL_HAS_MODIFIERS } from './duelSim';

export interface Profile { name: string; duel: number; run: number; perkDuel: number; perkRun: number; econPer: number; econSeeds: number; sweep: number }

export const PROFILES: Record<string, Profile> = {
  quick: { name: 'quick', duel: 150, run: 40, perkDuel: 40, perkRun: 40, econPer: 10, econSeeds: 3, sweep: 40 },
  standard: { name: 'standard', duel: 1000, run: 400, perkDuel: 250, perkRun: 400, econPer: 60, econSeeds: 15, sweep: 300 },
  full: { name: 'full', duel: 3000, run: 1200, perkDuel: 600, perkRun: 1000, econPer: 150, econSeeds: 30, sweep: 800 },
};

export type SectionId = 'targets' | 'duels' | 'bosses' | 'lag' | 'limb' | 'rookie' | 'runs' | 'runsC' | 'ramp' | 'perks' | 'policies' | 'whatifs' | 'economy' | 'levers' | 'packages' | 'length' | 'leads' | 'bosshp';
export const ALL_SECTIONS: SectionId[] = ['targets', 'duels', 'bosses', 'lag', 'limb', 'rookie', 'runs', 'runsC', 'ramp', 'perks', 'policies', 'whatifs', 'economy', 'length', 'leads', 'bosshp', 'levers', 'packages'];

export function perkWhatIfs(n: number): S.Section {
  const rows: (string | number)[][] = [];
  const data: Record<string, unknown> = {};
  const win = (start: string, patch: Parameters<typeof withPatch>[0]): number => {
    const merged = { ...S.STRESS.patch, ...patch, duel: S.STRESS.patch.duel };
    return withPatch(merged, () => S.runMany(n, { regions: ['dust_creek', 'canyon', 'railroad'], skill: AVERAGE, startPerks: [start], ...S.STRESS.opts }).filter((r) => r.victory).length / n);
  };
  for (const w of PERK_WHATIFS) {
    const before = win(w.perk, {});
    const after = win(w.perk, w.patch);
    data[w.perk] = { before, after };
    rows.push([w.label, pct(before, 1), pct(after, 1)]);
  }
  const C = PACKAGES.find((p) => p.label.startsWith('C:')) as (typeof PACKAGES)[number];
  const rowsC: (string | number)[][] = [];
  const base = withPatch(C.patch, () => S.runMany(n, { regions: ['dust_creek', 'canyon', 'railroad'], skill: AVERAGE, ...(C.opts ?? {}) }).filter((r) => r.victory).length / n);
  for (const id of ['tin_star', 'bullet_belt', 'revive_flask', 'tip_jar', 'quickdraw_scar', 'dead_eye', 'cold_open', 'spit_and_polish', 'horseshoe', 'healers_touch']) {
    const w = withPatch(C.patch, () => S.runMany(n, { regions: ['dust_creek', 'canyon', 'railroad'], skill: AVERAGE, startPerks: [id], ...(C.opts ?? {}) }).filter((r) => r.victory).length / n);
    rowsC.push([id, pct(w, 1), `${w - base >= 0 ? '+' : ''}${((w - base) * 100).toFixed(1)}pp`]);
    data[`C|${id}`] = w;
  }
  const mdC = `\n#### Single start perk under package C (lives 2, boss and elite hit for 2), average skill, N=${n}; no-perk-start baseline ${pct(base, 1)}\n\n` + '| perk | run win | delta |\n| --- | --- | --- |\n' + rowsC.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n';
  const md = `\n${S.STRESS.label}, one start perk, N=${n}.\n\n` + '| change | run win before | run win after |\n| --- | --- | --- |\n' + rows.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n' + mdC;
  return { md, data };
}

export function buildReport(profile: Profile, only: readonly SectionId[] = ALL_SECTIONS, log: (m: string) => void = () => {}): { md: string; data: Record<string, unknown> } {
  const data: Record<string, unknown> = { profile, duelHasModifiers: DUEL_HAS_MODIFIERS };
  const PKG_C = PACKAGES.find((p) => p.label.startsWith('C:')) as (typeof PACKAGES)[number];
  const parts: string[] = [`# NEONFEED balance simulation report (profile ${profile.name})\n\nDuelSystem perk hooks present in this checkout: ${DUEL_HAS_MODIFIERS ? 'yes' : 'no'}.\n`];
  const add = (id: SectionId, title: string, fn: () => S.Section): void => {
    if (!only.includes(id)) return;
    const t = Date.now();
    const r = fn();
    data[id] = r.data;
    parts.push(`\n## ${title}\n${r.md}`);
    log(`${id}: ${((Date.now() - t) / 1000).toFixed(1)}s`);
  };
  add('targets', 'Target checks', () => { const r = S.targetChecks(profile.duel * 2); return { md: r.md, data: r.targets }; });
  add('duels', 'Duel matrix (enemy x depth x skill)', () => S.duelMatrix(profile.duel));
  add('bosses', 'Bosses', () => S.bossMatrix(profile.duel));
  add('lag', 'Perfect window vs display lag', () => S.drawLag(profile.duel));
  add('limb', 'Gun-arm disarm loop (QA-09)', () => ({ md: S.limbCamp(profile.duel).md + S.limbHp(profile.duel).md, data: {} }));
  add('rookie', 'Rookie accuracy', () => S.rookieAccuracy(profile.duel * 2));
  add('leads', 'Tell-lead ladder for early enemies', () => S.leadSweep(profile.duel * 2));
  add('bosshp', 'Boss hp sensitivity (McGraw)', () => S.bossHpSweep(profile.duel));
  add('runs', 'Full runs', () => S.runStats(profile.run));
  add('runsC', 'Full runs under package C', () => S.runStats(profile.run, { patch: PKG_C.patch, opts: PKG_C.opts }));
  const hard = { patch: PKG_C.patch, opts: PKG_C.opts, label: 'package C (lives 2, boss and elite hit for 2)' };
  add('ramp', 'Difficulty ramp: one curve per run vs per region', () => {
    const a = S.difficultyRamp(profile.run);
    const b = S.difficultyRamp(profile.run, hard);
    return { md: a.md + '\n#### Same comparison under package C\n' + b.md, data: { current: a.data, packageC: b.data } };
  });
  add('perks', 'Perk contribution', () => { const r = S.perkContribution(profile.perkDuel, profile.perkRun); return { md: r.md, data: r.data }; });
  add('policies', 'Perk pick policies', () => S.perkPolicies(profile.run));
  add('whatifs', 'Perk what-ifs', () => perkWhatIfs(profile.perkRun));
  add('economy', 'Economy pacing', () => S.economy(profile.econPer, profile.econSeeds, hard));
  add('length', 'Region length and run time', () => S.regionLength(profile.run, { ...hard, label: 'package C' }));
  add('levers', 'One change at a time', () => S.sweep(ONE_AT_A_TIME, profile.sweep));
  add('packages', 'Candidate packages vs targets', () => S.sweep(PACKAGES, profile.sweep));
  return { md: parts.join('\n'), data };
}
