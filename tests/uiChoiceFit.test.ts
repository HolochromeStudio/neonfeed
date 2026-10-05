// "Nothing a player must read is cut off": every real perk, catalogue item, wanted name, region and
// mission title is wrapped with the SAME layout code the scenes draw with, at the minimum safe area
// (320x568 shows the same 360x640 logical canvas, scaled), and checked for loss and overflow.
import { describe, it, expect } from 'vitest';
import { CATALOG } from '../src/data/economy';
import { PERKS } from '../src/data/perks';
import { ALL_MISSIONS } from '../src/data/missions';
import { REGION_LIST } from '../src/data/regions';
import { WANTED } from '../src/data/wanted';
import { fitText, wrapsCleanly } from '../src/ui/fit';
import { POSTER_W, posterWidthFor, REWARD_CARD, REWARD_MAX_CARDS, RESULTS_FIT, SHEET, TAKE_H, rewardLayout, shopLayout, sheetLayout, SHOP_ROW } from '../src/ui/choiceLayout';
import type { PerkText, ShopText } from '../src/ui/choiceLayout';
import { MIN_INSETS, rectContains, rectGap, safeRect } from '../src/ui/layout';
import type { Insets, Rect } from '../src/ui/layout';
import { SHOP_MAX_ITEMS } from '../src/ui/shopLogic';
import { lineWidth, normalizeText } from '../src/ui/pixelFont';

const NOTCH: Insets = { top: 44, right: 12, bottom: 34, left: 12 };
const SAFES: Array<[string, Rect]> = [['min 24/24', safeRect(MIN_INSETS)], ['notch 44/34', safeRect(NOTCH)]];

/** The text a wrapped block shows, as one normalised string (spaces collapsed). */
const shown = (lines: string[]): string => lines.join(' ').replace(/\s+/g, ' ').trim();
const full = (t: string): string => normalizeText(t).replace(/\s+/g, ' ').trim();

const perkTexts: PerkText[] = PERKS.map((p) => ({ name: p.name, description: p.description }));
const byDesc = [...perkTexts].sort((a, b) => b.description.length - a.description.length);
const byName = [...perkTexts].sort((a, b) => b.name.length - a.name.length);
const catalogShop: ShopText[] = CATALOG.map((c) => ({ name: c.name, description: c.desc, price: c.price }));
const perkShop: ShopText[] = PERKS.map((p, i) => ({ name: p.name, description: p.description, price: [30, 45, 90, 180, 1800][i % 5]! }));

describe('real data is non-trivial', () => {
  it('covers every perk and catalogue entry', () => {
    expect(PERKS.length).toBeGreaterThan(50);
    expect(CATALOG.length).toBeGreaterThan(20);
  });
});

describe('reward screen: perks are never truncated', () => {
  it('REWARD_MAX_CARDS is 3', () => expect(REWARD_MAX_CARDS).toBe(3));

  for (const [label, safe] of SAFES) {
    it(`every perk name and full description fits at ${label} (worst-case trios)`, () => {
      // each perk shown next to the two longest descriptions (worst-case panel and card heights)
      const fillers = byDesc.slice(0, 2);
      const trios: PerkText[][] = perkTexts.map((p) => [p, fillers[0]!, fillers[1]!]);
      trios.push(byName.slice(0, 3), byDesc.slice(0, 3), [byName[0]!, byDesc[0]!, byName[1]!]);
      for (const trio of trios) {
        for (const hasRow of [true, false]) {
          const lay = rewardLayout(safe, trio, hasRow);
          expect(lay.overflow, `overflow for ${trio.map((t) => t.name).join(' / ')}`).toBe(false);
          trio.forEach((p, i) => {
            // nothing lost: the wrapped lines reproduce the text exactly (no ellipsis, no hard-split words)
            expect(shown(lay.nameLines[i]!), p.name).toBe(full(p.name));
            expect(shown(lay.descLines[i]!), p.description).toBe(full(p.description));
            expect(wrapsCleanly(p.name, lay.nameW, 2), `name word too wide: ${p.name}`).toBe(true);
            expect(wrapsCleanly(p.description, lay.detailTextW, 2), `word too wide: ${p.description}`).toBe(true);
            for (const l of lay.nameLines[i]!) expect(lineWidth(l, 2)).toBeLessThanOrEqual(lay.nameW);
            for (const l of lay.descLines[i]!) expect(lineWidth(l, 2)).toBeLessThanOrEqual(lay.detailTextW);
            // name block + rarity row fit inside the card
            const nameH = (lay.nameLines[i]!.length - 1) * 18 + 14;
            expect(REWARD_CARD.padTop + nameH + REWARD_CARD.nameToRarity + REWARD_CARD.rarityRow + REWARD_CARD.padBottom).toBeLessThanOrEqual(lay.cards[i]!.h);
            // description block fits the parchment
            const descH = (lay.descLines[i]!.length - 1) * 18 + 14;
            expect(descH + 24).toBeLessThanOrEqual(lay.detail.h);
          });
          // geometry: everything inside the safe rect, no overlaps, >= 8px gaps, TAKE >= 44 high
          const boxes = [...lay.cards, lay.detail, lay.take, ...(lay.row ? [lay.row] : [])];
          for (const b of boxes) expect(rectContains(safe, b)).toBe(true);
          for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) expect(rectGap(boxes[a]!, boxes[b]!)).toBeGreaterThanOrEqual(8);
          expect(lay.take.h).toBeGreaterThanOrEqual(TAKE_H);
          lay.cards.forEach((c) => expect(c.h).toBeGreaterThanOrEqual(44));
        }
      }
    });
  }

  it('card text is >= 16px: body text is scale 2 (8px grid x2 = 16px line box)', () => {
    // the layout only ever uses BODY_SCALE 2 for names and descriptions
    expect(fitText('X', 100, 2).height).toBe(14);
  });
});

describe('shop screen: items are never truncated', () => {
  const pools: Array<[string, ShopText[]]> = [['perks', perkShop], ['catalogue', catalogShop]];
  for (const [label, safe] of SAFES) {
    for (const [pool, items] of pools) {
      it(`${pool}: rows (name) and the detail sheet (name + description) fit at ${label}`, () => {
        // every item in a worst-case full list (the other rows are the longest names / prices)
        const longestNames = [...items].sort((a, b) => b.name.length - a.name.length).slice(0, SHOP_MAX_ITEMS - 1);
        for (const it of items) {
          const list = [it, ...longestNames.filter((x) => x !== it)].slice(0, SHOP_MAX_ITEMS);
          const lay = shopLayout(safe, list);
          expect(lay.overflow, `rows overflow for ${it.name}`).toBe(false);
          list.forEach((row, i) => {
            expect(shown(lay.rowNameLines[i]!), row.name).toBe(full(row.name));
            expect(wrapsCleanly(row.name, lay.rowNameW, 2), row.name).toBe(true);
            const nameH = (lay.rowNameLines[i]!.length - 1) * 18 + 14;
            expect(nameH + SHOP_ROW.padY * 2).toBeLessThanOrEqual(lay.rows[i]!.h);
            expect(lay.rows[i]!.h).toBeGreaterThanOrEqual(44);
            expect(rectContains(safe, lay.rows[i]!)).toBe(true);
          });
          for (let a = 0; a < lay.rows.length; a++) for (let b = a + 1; b < lay.rows.length; b++) expect(rectGap(lay.rows[a]!, lay.rows[b]!)).toBeGreaterThanOrEqual(8);

          const sh = sheetLayout(safe, it, lay.buy.y);
          expect(sh.overflow, `sheet overflow for ${it.name}`).toBe(false);
          expect(shown(sh.nameLines), it.name).toBe(full(it.name));
          expect(shown(sh.descLines), it.description).toBe(full(it.description));
          expect(wrapsCleanly(it.description, sh.descW, 2)).toBe(true);
          expect(wrapsCleanly(it.name, sh.nameW, 2)).toBe(true);
          for (const l of sh.descLines) expect(lineWidth(l, 2)).toBeLessThanOrEqual(sh.descW);
          // footer (price line) stays inside the sheet, which stays inside the safe rect and above BUY
          expect(sh.footerY + 14 + SHEET.padY).toBeLessThanOrEqual(sh.rect.h);
          expect(rectContains(safe, sh.rect)).toBe(true);
          expect(rectGap(sh.rect, lay.buy)).toBeGreaterThanOrEqual(8);
        }
      });
    }
  }
});

describe('results screen: real names are never truncated', () => {
  it('killer / target lines fit in 2 lines', () => {
    for (const w of WANTED) {
      for (const line of [`KILLED BY ${w.name}`, `${w.name} COLLECTED`]) {
        const f = fitText(line, RESULTS_FIT.causeW, 2);
        expect(shown(f.lines), line).toBe(full(line));
        expect(f.lines.length, line).toBeLessThanOrEqual(2);
      }
    }
  });
  it('poster names wrap in full in <= 2 lines (poster widens for the long ones)', () => {
    for (const w of WANTED) {
      const pw = posterWidthFor(w.name);
      expect([POSTER_W.normal, POSTER_W.wide]).toContain(pw);
      const f = fitText(w.name, pw - 20, 2);
      expect(shown(f.lines), w.name).toBe(full(w.name));
      expect(f.lines.length, w.name).toBeLessThanOrEqual(2);
      expect(f.clean).toBe(true);
    }
  });
  it('every region name fits on one line of the stats panel', () => {
    for (const r of REGION_LIST) expect(lineWidth(r.name.toUpperCase(), 2), r.name).toBeLessThanOrEqual(RESULTS_FIT.regionW);
  });
  it('every mission title fits in 2 lines next to its progress', () => {
    for (const m of ALL_MISSIONS) {
      const f = fitText(m.title, RESULTS_FIT.bountyW, 2);
      expect(shown(f.lines), m.title).toBe(full(m.title));
      expect(f.lines.length, m.title).toBeLessThanOrEqual(2);
    }
  });
});
