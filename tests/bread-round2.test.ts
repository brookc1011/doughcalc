import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import * as api from '../src/api';
import { resetConnection } from '../src/data/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { OVERNIGHT_WHITE } from '../src/engine/bread/presets';
import { planBatch } from '../src/engine/plan';
import { PRESETS } from '../src/engine/presets';
import { replan } from '../src/engine/progress';

const temp = { bandLowF: 66, bandHighF: 74, frictionF: 2 };
const loaves = OVERNIGHT_WHITE.defaults!.balls!;
const bakeAt = new Date('2026-11-15T09:15:00');
const base = { formula: OVERNIGHT_WHITE, balls: loaves, eatAt: bakeAt, roomF: 70, warmUpH: 0, temp };
const stamp = (d: Date) => `${d.getDate()} ${d.toTimeString().slice(0, 5)}`;

describe('olive oil and sugar in the mix step', () => {
  it('bread with oil names it in the step and the ingredient list', () => {
    const p = planBatch({ ...base, formula: { ...OVERNIGHT_WHITE, oil: 0.03 } });
    const mix = p.schedule.steps.find((s) => s.key === 'mix')!;
    expect(mix.label).toBe('Mix in salt, yeast and olive oil');
    expect(mix.detail).toMatch(/Add \d+ g olive oil at the same time\./);
    expect(mix.ingredients!.map((i) => i.name)).toContain('Olive oil');
  });

  it('bread without oil is unchanged', () => {
    const mix = planBatch(base).schedule.steps.find((s) => s.key === 'mix')!;
    expect(mix.label).toBe('Mix in salt and yeast');
    expect(mix.detail).not.toMatch(/oil|sugar/);
  });

  it('a pizza dough with oil names it in its mix step', () => {
    const f = PRESETS.find((x) => !x.product && x.family === 'straight')!;
    const p = planBatch({ formula: { ...f, oil: 0.02 }, balls: f.defaults?.balls ?? [{ count: 4, grams: 250 }], eatAt: new Date('2026-11-15T18:00:00'), roomF: 70, warmUpH: 2, temp });
    const mix = p.schedule.steps.find((s) => s.key === 'mix')!;
    expect(mix.detail).toMatch(/olive oil/);
  });
});

describe('fridge option (cold bulk, 2-3 days)', () => {
  const cold = { ...base, coldBulk: true };

  it('mix, folds, fridge 60 h, out 30 min, shape, proof, bake', () => {
    const p = planBatch(cold);
    expect(p.errors).toEqual([]);
    expect(p.stageH).toBe(60);
    const at = (k: string) => stamp(p.schedule.steps.find((s) => s.key === k)!.at);
    expect(at('autolyse')).toBe('12 17:35');
    expect(at('mix')).toBe('12 18:00');
    expect(at('fold3')).toBe('12 19:30');
    expect(at('pull')).toBe('15 07:30');
    expect(at('shape')).toBe('15 08:00');
    expect(at('bake')).toBe('15 09:15');
    const fold3 = p.schedule.steps.find((s) => s.key === 'fold3')!;
    expect(fold3.detail).toContain('straight into the fridge for 2½ days');
    expect(p.schedule.steps.find((s) => s.key === 'pull')!.timer).toMatchObject({ kind: 'countdown', min: 30 });
  });

  it('keeps the book yeast, labeled as an assumption', () => {
    const p = planBatch(cold);
    const yeast = p.recipe.parts[0].ingredients.find((i) => i.key === 'yeast')!;
    expect(yeast.grams).toBeCloseTo(0.8, 2);
    expect(p.yeast.note).toMatch(/Assumption/);
    expect(planBatch({ ...cold, stageH: 72 }).recipe.parts[0].ingredients.find((i) => i.key === 'yeast')!.grams).toBeCloseTo(0.8, 2);
  });

  it('refuses a fridge time outside 2-3 days', () => {
    expect(planBatch({ ...cold, stageH: 30 }).errors.join(' ')).toMatch(/2-3 days/);
    expect(planBatch({ ...cold, stageH: 48 }).errors).toEqual([]);
  });

  it('room option is unchanged: no take-out step', () => {
    expect(planBatch(base).schedule.steps.map((s) => s.key)).not.toContain('pull');
  });

  it('start mode bakes when the fridge time and proof are done', () => {
    const p = planBatch({ ...cold, timing: 'start', startAt: new Date('2026-11-12T17:35:00') });
    expect(stamp(p.input.eatAt)).toBe('15 09:15');
  });

  describe('replan', () => {
    const plan = planBatch(cold);
    const input = {
      formula: OVERNIGHT_WHITE,
      stageH: plan.stageH,
      warmUpH: 0,
      eatAt: bakeAt,
      plannedMixAt: plan.schedule.steps.find((s) => s.key === 'mix')!.at,
      coldBulk: true,
    };

    it('the fridge absorbs a mix 2 hours late', () => {
      const r = replan(input, { mix: new Date('2026-11-12T20:00:00') });
      expect(r.movedTo).toBeUndefined();
      expect(stamp(r.steps.find((s) => s.key === 'pull')!.at)).toBe('15 07:30');
    });

    it('a mix too late for 48 h in the fridge moves the bake', () => {
      const r = replan(input, { mix: new Date('2026-11-13T07:00:00') });
      expect(stamp(r.movedTo!)).toBe('15 10:15');
    });

    it('a late take-out moves the bake', () => {
      const r = replan(input, { pull: new Date('2026-11-15T08:00:00') });
      expect(stamp(r.movedTo!)).toBe('15 09:45');
    });
  });
});

describe('fridge option is saved with the batch', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetConnection();
  });

  it('lock in keeps coldBulk and the checklist uses it', async () => {
    const s = await api.getSettings();
    const plan = api.makePlan({ formula: OVERNIGHT_WHITE, balls: loaves, eatAt: bakeAt, roomF: 70, mixer: 'hand', coldBulk: true, alreadyStarted: true }, s);
    const b = await api.lockIn(plan, 'hand');
    expect(b.planned.coldBulk).toBe(true);
    expect(api.batchProgress(b).steps.map((x) => x.key)).toContain('pull');
    const room = await api.lockIn(api.makePlan({ formula: OVERNIGHT_WHITE, balls: loaves, eatAt: bakeAt, roomF: 70, mixer: 'hand', alreadyStarted: true }, s), 'hand');
    expect('coldBulk' in room.planned).toBe(false);
  });
});
