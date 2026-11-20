import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import * as api from '../src/api';
import { suggestions } from '../src/engine/advice';
import { OVERNIGHT_WHITE } from '../src/engine/bread/presets';
import { planBatch, timingModes } from '../src/engine/plan';
import { PRESETS } from '../src/engine/presets';
import { replan } from '../src/engine/progress';
import type { Formula } from '../src/engine/types';
import { chooseYeast } from '../src/engine/yeast';
import { resetConnection } from '../src/data/store';

const temp = { bandLowF: 66, bandHighF: 74, frictionF: 2 };
const loaves = OVERNIGHT_WHITE.defaults!.balls!;
// FWSY p.89 sample schedule: mix 7 p.m., shape 8 a.m., bake 9:15 a.m.
const bakeAt = new Date('2026-11-15T09:15:00');
const base = { formula: OVERNIGHT_WHITE, balls: loaves, eatAt: bakeAt, roomF: 70, warmUpH: 0, temp };
const time = (d: Date) => d.toTimeString().slice(0, 5);

describe('Overnight White (FWSY p.89)', () => {
  it('reproduces the book table for 2 loaves: 1,000 g flour, 780 g water, 22 g salt, 0.8 g yeast', () => {
    const p = planBatch(base);
    expect(p.errors).toEqual([]);
    expect(p.yeast.basis).toBe('book');
    const ing = Object.fromEntries(p.recipe.parts[0].ingredients.map((i) => [i.key, i.grams]));
    expect(ing.flour).toBeCloseTo(1000, 0);
    expect(ing.water).toBeCloseTo(780, 0);
    expect(ing.salt).toBeCloseTo(22, 1);
    expect(ing.yeast).toBeCloseTo(0.8, 2);
  });

  it('matches the book sample schedule when baking at 9:15', () => {
    const steps = planBatch(base).schedule.steps;
    const at = (k: string) => time(steps.find((s) => s.key === k)!.at);
    expect(at('mix')).toBe('19:00');
    expect(at('autolyse')).toBe('18:35');
    expect(at('fold')).toBe('19:30');
    expect(at('fold2')).toBe('20:00');
    expect(at('fold3')).toBe('20:30');
    expect(at('shape')).toBe('08:00');
    expect(at('proofCheck')).toBe('09:00');
    expect(at('preheat')).toBe('08:30');
    expect(at('bake')).toBe('09:15');
    expect(at('lidOff')).toBe('09:45');
    expect(at('out')).toBe('10:05');
    expect(at('slice')).toBe('10:25');
    expect(steps.map((s) => s.key)).not.toContain('ball');
  });

  it('puts amounts in the steps and offers sourced timers', () => {
    const steps = planBatch(base).schedule.steps;
    const shape = steps.find((s) => s.key === 'shape')!;
    expect(shape.detail).toContain('2 pieces of 901 g');
    expect(steps.find((s) => s.key === 'mix')!.detail).toContain('22 g salt');
    expect(steps.find((s) => s.key === 'bake')!.timer).toMatchObject({ kind: 'countdown', min: 30 });
    expect(steps.find((s) => s.key === 'lidOff')!.timer).toMatchObject({ kind: 'countdown', min: 20, upToMin: 30 });
    expect(steps.find((s) => s.key === 'autolyse')!.cover).toBe('on');
    expect(steps.find((s) => s.key === 'bake')!.cover).toBeUndefined();
  });

  it('start mode bakes as soon as the proof is done; both mode is refused', () => {
    expect(timingModes(OVERNIGHT_WHITE)).toEqual(['eat', 'start']);
    const start = planBatch({ ...base, timing: 'start', startAt: new Date('2026-11-14T18:35:00') });
    expect(start.errors).toEqual([]);
    expect(time(start.input.eatAt)).toBe('09:15');
    const both = planBatch({ ...base, timing: 'both', startAt: new Date('2026-11-14T18:35:00') });
    expect(both.errors.join(' ')).toMatch(/not both/);
  });

  it('asks for at least one loaf', () => {
    expect(planBatch({ ...base, balls: [{ count: 0, grams: 900, label: 'loaf' }] }).errors).toContain('Add at least one loaf.');
  });
});

describe('bread replan', () => {
  const plan = planBatch(base);
  const input = {
    formula: OVERNIGHT_WHITE,
    stageH: plan.stageH,
    warmUpH: 0,
    eatAt: bakeAt,
    plannedMixAt: plan.schedule.steps.find((s) => s.key === 'mix')!.at,
  };

  it('keeps the bake when shaping is on time', () => {
    const r = replan(input, { shape: new Date('2026-11-15T08:00:00') });
    expect(r.movedTo).toBeUndefined();
    expect(r.nextKey).toBe('preheat');
  });

  it('moves the bake with a late shape (no hold in a room proof)', () => {
    const r = replan(input, { shape: new Date('2026-11-15T08:30:00') });
    expect(time(r.movedTo!)).toBe('09:45');
    expect(time(r.steps.find((s) => s.key === 'slice')!.at)).toBe('10:55');
  });

  it('moves the bake earlier with an early shape', () => {
    const r = replan(input, { shape: new Date('2026-11-15T07:30:00') });
    expect(time(r.movedTo!)).toBe('08:45');
  });

  it('re-times from the actual lid-off time', () => {
    const r = replan(input, { shape: new Date('2026-11-15T08:00:00'), bake: bakeAt, lidOff: new Date('2026-11-15T09:50:00') });
    expect(time(r.steps.find((s) => s.key === 'out')!.at)).toBe('10:10');
  });
});

describe('foundations', () => {
  it('a dough with no anchors asks for a yeast amount instead of crashing', () => {
    const noAnchors: Formula = { ...OVERNIGHT_WHITE, anchors: [] };
    const y = chooseYeast(noAnchors, { hours: 13, tempF: 70 }, {});
    expect(y.basis).toBe('manual');
    expect(y.pct).toBe(0);
  });

  it('bread advice: oven before proof, each with a book source', () => {
    const s = suggestions({ crust: 'pale', loaf: 'flat', crumb: 'gummy' });
    expect(s.map((x) => x.area)).toEqual(['oven', 'oven', 'shaping']);
    expect(s.every((x) => x.source?.startsWith('FWSY'))).toBe(true);
  });
});

describe('library by product', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetConnection();
  });

  it('the pizza library is unchanged and bread has its own', async () => {
    const pizza = await api.allDoughs();
    expect(pizza.map((f) => f.id)).toEqual(PRESETS.filter((p) => !p.product).map((p) => p.id));
    expect((await api.allDoughs('bread')).map((f) => f.id)).toEqual(['forkish-overnight-white']);
    expect((await api.findDough('nope', 'bread')).id).toBe('forkish-overnight-white');
  });

  it('locking in bread names loaves, mixes by hand and keeps pizza settings', async () => {
    const before = await api.getSettings();
    const s = await api.getSettings();
    const plan = api.makePlan({ formula: OVERNIGHT_WHITE, balls: loaves, eatAt: bakeAt, roomF: 70, mixer: 'hand', alreadyStarted: true }, s);
    expect(plan.errors).toEqual([]);
    const b = await api.lockIn(plan, 'mixer');
    expect(b.title).toBe('Overnight White Bread, 2 loaves');
    expect(b.planned.mixer).toBe('hand');
    const after = await api.getSettings();
    expect(after.lastDoughId).toBe(before.lastDoughId);
    expect(after.lastBalls).toEqual(before.lastBalls);
    expect(after.lastBreadDoughId).toBe('forkish-overnight-white');
    expect(await api.lastDoughId('bread')).toBe('forkish-overnight-white');

    const checked = await api.checkStep(b.id, 'shape', new Date('2026-11-15T08:30:00'));
    expect(checked.actual.ballAt).toBe(new Date('2026-11-15T08:30:00').toISOString());
    expect(time(api.batchProgress(checked).movedTo!)).toBe('09:45');
  });

  it('keeps at least one bread dough', async () => {
    await expect(api.removeDough('forkish-overnight-white')).rejects.toThrow('Keep at least one dough.');
  });
});
