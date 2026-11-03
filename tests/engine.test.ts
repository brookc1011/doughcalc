import { describe, expect, it } from 'vitest';
import { computeRecipe } from '../src/engine/formula';
import { rescaleBall, roundArea, tfFromBall } from '../src/engine/geometry';
import { getPreset } from '../src/engine/presets';
import { buildSchedule } from '../src/engine/schedule';
import { waterTemps } from '../src/engine/temperature';
import { chooseYeast, equivalentHours } from '../src/engine/yeast';
import { suggestions, topSuggestion } from '../src/engine/advice';
import { planBatch } from '../src/engine/plan';
import type { Formula } from '../src/engine/types';

const overnight = getPreset('forkish-overnight')!;
const sameDay = getPreset('forkish-same-day')!;
const poolish = getPreset('forkish-poolish')!;
const grams = (r: ReturnType<typeof computeRecipe>, key: string, part = 0) =>
  r.parts[part].ingredients.find((i) => i.key === key)!.grams;

describe('Forkish tables, flour-first (exact)', () => {
  it('overnight straight p.220: 1000 / 700 / 20 / 0.8', () => {
    const r = computeRecipe({ formula: overnight, yeastPct: 0.0008, flourG: 1000 });
    expect(grams(r, 'flour')).toBeCloseTo(1000, 6);
    expect(grams(r, 'water')).toBeCloseTo(700, 6);
    expect(grams(r, 'salt')).toBeCloseTo(20, 6);
    expect(grams(r, 'yeast')).toBeCloseTo(0.8, 6);
    expect(r.parts[0].ingredients.find((i) => i.key === 'yeast')!.tsp).toBe('scant 1/4 tsp');
  });

  it('same-day straight p.218: yeast 2 g, half a teaspoon', () => {
    const r = computeRecipe({ formula: sameDay, yeastPct: 0.002, flourG: 1000 });
    expect(grams(r, 'yeast')).toBeCloseTo(2, 6);
    expect(r.parts[0].ingredients.find((i) => i.key === 'yeast')!.tsp).toBe('1/2 tsp');
  });

  it('poolish p.226: poolish 500/500/0.4, final 500/250/20', () => {
    const r = computeRecipe({ formula: poolish, yeastPct: 0.0004, flourG: 1000 });
    expect(grams(r, 'flour', 0)).toBeCloseTo(500, 6);
    expect(grams(r, 'water', 0)).toBeCloseTo(500, 6);
    expect(grams(r, 'yeast', 0)).toBeCloseTo(0.4, 6);
    expect(grams(r, 'flour', 1)).toBeCloseTo(500, 6);
    expect(grams(r, 'water', 1)).toBeCloseTo(250, 6);
    expect(grams(r, 'salt', 1)).toBeCloseTo(20, 6);
    expect(r.parts[1].ingredients.find((i) => i.key === 'yeast')).toBeUndefined();
  });
});

describe('balls-first', () => {
  it('5 x 340 g lands within 2% of the book flour (book carries ~1.2% surplus)', () => {
    const r = computeRecipe({ formula: overnight, yeastPct: 0.0008, balls: [{ count: 5, grams: 340 }] });
    expect(Math.abs(grams(r, 'flour') - 1000) / 1000).toBeLessThan(0.02);
    expect(r.usableDoughG).toBeCloseTo(1700, 6);
  });

  it('mixed sizes add up: 3 x 340 pizza + 2 x 200 focaccia', () => {
    const r = computeRecipe({
      formula: overnight,
      yeastPct: 0.0008,
      balls: [
        { count: 3, grams: 340 },
        { count: 2, grams: 200 },
      ],
    });
    expect(r.usableDoughG).toBe(1420);
    const sum = r.totals.reduce((s, i) => s + i.grams, 0);
    expect(sum).toBeCloseTo(1420, 6);
  });

  it('residue is a fraction of prepared dough: gross = usable / (1 - L)', () => {
    const r = computeRecipe({ formula: overnight, yeastPct: 0.0008, balls: [{ count: 1, grams: 1000 }], residuePct: 0.015 });
    expect(r.grossDoughG).toBeCloseTo(1000 / 0.985, 6);
  });

  it('poolish guard: negative final-dough water is an error', () => {
    const bad: Formula = { ...poolish, hydration: 0.4 };
    const r = computeRecipe({ formula: bad, yeastPct: 0.0004, flourG: 1000 });
    expect(r.errors.length).toBe(1);
  });
});

describe('geometry', () => {
  it("340 g on 12 inches is about 0.106 oz/sq in", () => {
    expect(tfFromBall(340, roundArea(12))).toBeCloseTo(0.1063, 3);
  });
  it('rescaling keeps thickness: same diameter returns same ball', () => {
    expect(rescaleBall(340, roundArea(12), roundArea(12))).toBeCloseTo(340, 9);
    expect(rescaleBall(340, roundArea(12), roundArea(14))).toBeGreaterThan(340);
  });
});

describe('yeast', () => {
  it('overnight at its native schedule returns the book 0.08%', () => {
    const y = chooseYeast(overnight, { hours: 12, tempF: 70 });
    expect(y.basis).toBe('book');
    expect(y.pct).toBe(0.0008);
  });

  it('same-day schedule on the overnight dough returns the book 0.2%, not the model', () => {
    const y = chooseYeast(overnight, { hours: 6, tempF: 70 });
    expect(y.basis).toBe('book');
    expect(y.pct).toBe(0.002);
  });

  it('fridge hold after balling does not change yeast (day 1 vs day 2 bake)', () => {
    const base = {
      formula: overnight,
      balls: [{ count: 5, grams: 340 }],
      roomF: 70,
      warmUpH: 1.5,
      temp: { bandLowF: 66, bandHighF: 74, frictionF: 2 },
    };
    const mixAt = new Date('2026-11-06T19:00:00');
    const day1 = planBatch({ ...base, mixAt, eatAt: new Date('2026-11-07T18:00:00') });
    const day2 = planBatch({ ...base, mixAt, eatAt: new Date('2026-11-08T18:00:00') });
    expect(day1.yeast.pct).toBe(day2.yeast.pct);
    expect(day1.errors).toEqual([]);
    expect(day2.errors).toEqual([]);
  });

  it('between anchors: an estimate, between the two book doses', () => {
    const y = chooseYeast(overnight, { hours: 9, tempF: 70 });
    expect(y.basis).toBe('estimate');
    expect(y.pct).toBeLessThan(0.002);
    expect(y.pct).toBeGreaterThan(0.0008);
  });

  it('warmer room needs less yeast, cooler needs more', () => {
    const warm = chooseYeast(overnight, { hours: 12, tempF: 78 });
    const cool = chooseYeast(overnight, { hours: 12, tempF: 62 });
    expect(warm.pct).toBeLessThan(0.0008);
    expect(cool.pct).toBeGreaterThan(0.0008);
  });

  it('cold bulk is not modeled', () => {
    const y = chooseYeast(overnight, { hours: 48, tempF: 38 });
    expect(y.basis).toBe('manual');
    expect(y.warning).toBeDefined();
  });

  it('kitchen factor is applied only when set', () => {
    expect(chooseYeast(overnight, { hours: 12, tempF: 70 }, { kitchenFactor: 0.9 }).pct).toBeCloseTo(0.00072, 9);
  });

  it('record: model vs book (printed, not asserted)', () => {
    const modelSameDay = 0.0008 * (equivalentHours(12, 70) / equivalentHours(6, 70));
    // eslint-disable-next-line no-console
    console.log(
      `Model-implied same-day yeast from the overnight anchor: ${(modelSameDay * 100).toFixed(3)}% vs book 0.200%`,
    );
  });
});

describe('water temperature', () => {
  const s = { bandLowF: 66, bandHighF: 74, frictionF: 2 };
  it('normal room uses the book temperature', () => {
    const w = waterTemps(overnight, 70, s);
    expect(w[0]).toMatchObject({ basis: 'book', lowF: 90, highF: 95 });
  });
  it('cold room calculates warmer water with the King Arthur formula', () => {
    const w = waterTemps(overnight, 60, s);
    expect(w[0].basis).toBe('calculated');
    expect(w[0].lowF).toBeCloseTo(3 * 77.5 - 60 - 60 - 2, 9);
  });
  it('poolish build always keeps the book 80°F', () => {
    const w = waterTemps(poolish, 60, s);
    expect(w[0]).toMatchObject({ basis: 'book', lowF: 80 });
    expect(w[1].basis).toBe('calculated');
  });
});

describe('schedule', () => {
  it('works back from dinner for the overnight dough', () => {
    const eatAt = new Date('2026-11-07T18:00:00');
    const sch = buildSchedule({ formula: overnight, eatAt, stageH: 12, warmUpH: 1.5 });
    const ball = sch.steps.find((s) => s.key === 'ball')!.at;
    const mix = sch.steps.find((s) => s.key === 'mix')!.at;
    expect((ball.getTime() - mix.getTime()) / 3600_000).toBe(12);
    expect((eatAt.getTime() - ball.getTime()) / 3600_000).toBe(7.5);
    expect(sch.errors).toEqual([]);
  });
  it('flags a bake too soon after balling', () => {
    const sch = buildSchedule({
      formula: overnight,
      eatAt: new Date('2026-11-07T09:00:00'),
      stageH: 12,
      warmUpH: 1.5,
      mixAt: new Date('2026-11-06T19:00:00'),
    });
    expect(sch.errors.length).toBe(1);
  });
  it('same-day dough eaten next day gets a fridge step', () => {
    const sch = buildSchedule({
      formula: sameDay,
      eatAt: new Date('2026-11-08T18:00:00'),
      stageH: 6,
      warmUpH: 1.5,
      mixAt: new Date('2026-11-07T10:00:00'),
    });
    expect(sch.steps.some((s) => s.key === 'fridge')).toBe(true);
  });
});

describe('advice', () => {
  it('timing comes first', () => {
    expect(topSuggestion({ ready: 'late', stretch: 'tore', bottom: 'pale' })!.area).toBe('timing');
  });
  it('oven before handling', () => {
    expect(topSuggestion({ ready: 'onTime', stretch: 'tore', bottom: 'pale' })!.area).toBe('oven');
  });
  it('all good means nothing to change', () => {
    expect(suggestions({ ready: 'onTime', stretch: 'good', rim: 'good', bottom: 'good', center: 'set' })).toEqual([]);
  });
});
