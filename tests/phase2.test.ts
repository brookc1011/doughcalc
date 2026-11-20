import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import * as api from '../src/api';
import { resetConnection } from '../src/data/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { planBatch } from '../src/engine/plan';
import { PRESETS } from '../src/engine/presets';
import { OVERNIGHT_WHITE } from '../src/engine/bread/presets';
import { replan } from '../src/engine/progress';
import { OONI_ACTIVE_DRY_G, OONI_FLOUR_G, OONI_YEAST_G } from '../src/engine/schedule';
import { waterTemps } from '../src/engine/temperature';

// Phase 2 of the 2026-11-20 fix plan: wrong numbers and unsafe inputs.

const temp = { bandLowF: 66, bandHighF: 74, frictionF: 2 };
const overnight = PRESETS.find((p) => p.id === 'forkish-overnight')!;
const balls = [{ count: 4, grams: 340 }];
const dinner = new Date('2026-11-15T18:00:00');
const base = { formula: overnight, balls, eatAt: dinner, roomF: 70, warmUpH: 2, temp };
const cold = { ...base, coldBulk: true };
const grams = (p: ReturnType<typeof planBatch>, k: string) => p.recipe.totals.find((x) => x.key === k)!.grams;
const stamp = (d: Date) => `${d.getDate()} ${d.toTimeString().slice(0, 5)}`;

describe('yeast amounts', () => {
  it("pizza fridge with active dry uses Ooni's 1.6 g per 607 g, not instant times a factor", () => {
    const p = planBatch({ ...cold, yeastType: 'activeDry' });
    expect(grams(p, 'yeast') / grams(p, 'flour')).toBeCloseTo(OONI_ACTIVE_DRY_G / OONI_FLOUR_G, 4);
    const instant = planBatch({ ...cold, yeastType: 'instant' });
    expect(grams(instant, 'yeast') / grams(instant, 'flour')).toBeCloseTo(OONI_YEAST_G / OONI_FLOUR_G, 4);
  });

  it('bread fridge rise keeps the book dose whatever the kitchen factor', () => {
    const b = { formula: OVERNIGHT_WHITE, balls: OVERNIGHT_WHITE.defaults!.balls!, eatAt: dinner, roomF: 70, warmUpH: 0, temp, coldBulk: true };
    expect(planBatch({ ...b, kitchenFactor: 1.5 }).yeast.pct).toBe(planBatch(b).yeast.pct);
  });
});

describe('water temperature', () => {
  it('warns only above 110°F (FWSY p.65)', () => {
    for (let room = 40; room <= 65; room++) {
      for (const w of waterTemps(overnight, room, temp)) {
        if (w.basis !== 'calculated') continue;
        expect(Boolean(w.warning?.includes('110°F'))).toBe(w.lowF > 110);
      }
    }
  });
});

describe('bad inputs are refused by the field', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['balls', { balls: [{ count: 0, grams: 340 }] }],
    ['balls', { balls: [{ count: 2, grams: -5 }] }],
    ['balls', { balls: [{ count: 1.5, grams: 340 }] }],
    ['time', { eatAt: new Date('nope') }],
    ['room', { roomF: Number.NaN }],
    ['rise', { riseF: Number.NaN }],
    ['stage', { stageH: 0 }],
    ['yeast', { manualYeastPct: -0.001 }],
    ['kitchen', { kitchenFactor: 0 }],
  ];
  it.each(cases)('%s: %o', (field, change) => {
    const p = planBatch({ ...base, ...change } as Parameters<typeof planBatch>[0]);
    expect(p.fieldErrors[field as keyof typeof p.fieldErrors]).toBeTruthy();
    expect(p.errors.length).toBeGreaterThan(0);
  });

  it('a good plan has no field errors', () => {
    expect(planBatch(base).fieldErrors).toEqual({});
  });
});

describe('starting in the past', () => {
  it('blocks a plan whose first step is behind you, unless it is a bake already started', () => {
    const now = new Date(dinner.getTime() - 3600_000);
    const p = planBatch({ ...base, now });
    expect(p.pastStart).toBeDefined();
    expect(p.fieldErrors.time).toContain('past');
    expect(p.errors.length).toBeGreaterThan(0);
    const started = planBatch({ ...base, now, alreadyStarted: true });
    expect(started.pastStart).toBeUndefined();
    expect(started.errors).toEqual([]);
  });

  it('a plan that starts later is fine', () => {
    const p = planBatch({ ...base, now: new Date('2026-11-01T12:00:00') });
    expect(p.pastStart).toBeUndefined();
    expect(p.errors).toEqual([]);
  });
});

describe('checking off', () => {
  const plan = planBatch(cold);
  const input = {
    formula: overnight,
    stageH: plan.stageH,
    warmUpH: 2,
    eatAt: dinner,
    plannedMixAt: plan.schedule.steps.find((s) => s.key === 'mix')!.at,
    coldBulk: true,
  };

  it('out of order is allowed and flagged', () => {
    const r = replan(input, { autolyse: new Date('2026-11-13T13:00:00'), mix: new Date('2026-11-13T12:30:00') });
    expect(r.steps.find((s) => s.key === 'mix')!.outOfOrder).toBe(true);
    expect(r.steps.find((s) => s.key === 'autolyse')!.outOfOrder).toBeUndefined();
  });

  it("pizza fridge past Ooni's 72 h keeps dinner and warns", () => {
    const r = replan(input, { fold: new Date('2026-11-12T10:00:00') });
    expect(r.movedTo).toBeUndefined();
    expect(stamp(r.steps.find((s) => s.key === 'ball')!.at)).toBe('15 13:00');
    expect(r.warnings.join(' ')).toContain("past Ooni's 72");
    expect(replan(input, {}).warnings).toEqual([]);
  });
});

describe('api', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetConnection();
  });

  async function locked() {
    const s = await api.getSettings();
    const formula = await api.findDough(s.lastDoughId);
    return api.lockIn(api.makePlan({ formula, balls: s.lastBalls, eatAt: dinner, roomF: 70, mixer: 'hand', alreadyStarted: true }, s), 'hand');
  }

  it('refuses a check-off time in the future', async () => {
    const b = await locked();
    await expect(api.checkStep(b.id, 'mix', new Date(Date.now() + 3600_000))).rejects.toBeInstanceOf(api.UserError);
    await expect(api.checkStep(b.id, 'mix', new Date(Date.now() - 60_000))).resolves.toBeTruthy();
  });

  it('makePlan blocks a past start unless already started', async () => {
    const s = await api.getSettings();
    const formula = await api.findDough(s.lastDoughId);
    const form = { formula, balls: s.lastBalls, eatAt: dinner, roomF: 70, mixer: 'hand' as const };
    expect(api.makePlan(form, s).pastStart).toBeDefined();
    expect(api.makePlan({ ...form, alreadyStarted: true }, s).errors).toEqual([]);
  });

  it('the calendar follows the re-timed steps', async () => {
    const b = await locked();
    const before = api.batchIcs(b);
    const mix = api.batchProgress(b).steps.find((s) => s.key === 'mix')!.at;
    const late = await api.checkStep(b.id, 'mix', new Date(mix.getTime() + 2 * 3600_000));
    const after = api.batchIcs(late);
    expect(after).not.toBe(before);
    expect(after.match(/BEGIN:VEVENT/g)!.length).toBe(before.match(/BEGIN:VEVENT/g)!.length);
  });
});
