import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PACK_ASSETS } from '../src/data/packAssets';

const PUB = new URL('../public', import.meta.url).pathname;
const manifest = JSON.parse(fs.readFileSync(path.join(PUB, 'assets/manifest.json'), 'utf8')) as { files: string[]; animations: Record<string, string[]> };

function leaves(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (k !== 'animations') leaves(x, out); });
  return out;
}

describe('asset pack registry', () => {
  const paths = leaves(PACK_ASSETS);
  it('references only files that exist', () => {
    const missing = paths.filter((p) => !fs.existsSync(path.join(PUB, p)));
    expect(missing).toEqual([]);
  });
  it('covers every manifest PNG exactly once (icons are listed under both ui.icons and icons)', () => {
    const unique = new Set(paths);
    const expected = new Set(manifest.files.map((f) => 'assets/' + f));
    expect([...expected].filter((p) => !unique.has(p))).toEqual([]);
    expect([...unique].filter((p) => !expected.has(p))).toEqual([]);
  });
  it('keeps animation frame order from the manifest, not alphabetical', () => {
    const all = { ...PACK_ASSETS.characters, ...PACK_ASSETS.enemies, ...PACK_ASSETS.bosses } as Record<string, Record<string, string>>;
    for (const [who, frames] of Object.entries(manifest.animations)) {
      const nums = frames.map((fr) => Number(all[who][fr].match(/\/(\d+)_/)![1]));
      expect(nums).toEqual(nums.slice().sort((a, b) => a - b));
      expect(nums[0]).toBe(0);
    }
  });
});
