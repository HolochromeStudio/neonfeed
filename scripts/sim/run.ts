/**
 * `npm run sim [-- --profile=quick|standard|full --only=a,b]`: runs the A18 balance simulations and writes
 * scripts/sim/out/report.md and results.json. Deterministic: the same checkout and profile print the same numbers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_SECTIONS, PROFILES, buildReport, type SectionId } from './report';

const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const profile = PROFILES[arg('profile') ?? (process.argv.includes('--quick') ? 'quick' : 'standard')];
if (!profile) throw new Error(`unknown profile; use ${Object.keys(PROFILES).join(', ')}`);
const only = (arg('only')?.split(',') as SectionId[] | undefined) ?? ALL_SECTIONS;

const t0 = Date.now();
const { md, data } = buildReport(profile, only, (m) => console.log(`[sim] ${m}`));
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/report.md', import.meta.url), md);
writeFileSync(new URL('./out/results.json', import.meta.url), JSON.stringify(data, null, 1));
console.log(`[sim] profile ${profile.name} done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> scripts/sim/out/report.md, results.json`);
