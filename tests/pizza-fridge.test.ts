import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import * as api from '../src/api';
import { resetConnection } from '../src/data/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { coldOk, planBatch, timingModes } from '../src/engine/plan';
import { PRESETS } from '../src/engine/presets';
import { replan } from '../src/engine/progress';
import { OONI_FLOUR_G, OONI_YEAST_G } from '../src/engine/schedule';

const temp = { bandLowF: 66, bandHighF: 74, frictionF: 2 };
const overnight = PRESETS.find((p) => p.id === 'forkish-overnight')!;
const poolish = PRESETS.find((p) => p.id === 'forkish-poolish')!;
const balls = [{ count: 4, grams: 340 }];
const dinner = new Date('2026-11-15T18:00:00');
const base = { formula: overnight, balls, eatAt: dinner, roomF: 70, warmUpH: 2, temp };
const cold = { ...base, coldBulk: true };
const stamp = (d: Date) => `${d.getDate()} ${d.toTimeString().slice(0, 5)}`;
const at = (p: ReturnType<typeof planBatch>, k: string) => stamp(p.schedule.steps.find((s) => s.key === k)!.at);

describe('pizza fridge rise (Ooni)', () => {
  it('autolyse, mix, fold into the fridge 48 h, ball, 5 h on the counter, bake', () => {
    const p = planBatch(cold);
    expect(p.errors).toEqual([]);
    expect(p.coldBulk).toBe(true);
    expect(p.stageH).toBe(48);
    expect(p.schedule.steps.map((s) => s.key)).toEqual(['autolyse', 'mix', 'fold', 'ball', 'bake']);
    expect(at(p, 'autolyse')).toBe('13 11:50');
    expect(at(p, 'mix')).toBe('13 12:15');
    expect(at(p, 'fold')).toBe('13 13:00');
    expect(at(p, 'ball')).toBe('15 13:00');
    expect(at(p, 'bake')).toBe('15 18:00');
  });

  it('step text: tub into the fridge after the fold, ball after the fridge, 5 h rest', () => {
    const p = planBatch(cold);
    const fold = p.schedule.steps.find((s) => s.key === 'fold')!;
    const ball = p.schedule.steps.find((s) => s.key === 'ball')!;
    expect(fold.detail).toContain('straight into the fridge');
    expect(ball.label).toBe('Out of the fridge: divide and ball');
    expect(ball.detail).toContain('about 5 h');
    expect(ball.detail).not.toContain('No cover needed');
  });

  it("uses Ooni's yeast, not the book's or the rate law", () => {
    const p = planBatch(cold);
    expect(p.yeast.pct).toBeCloseTo(OONI_YEAST_G / OONI_FLOUR_G, 10);
    expect(p.yeast.note).toContain('Ooni');
    expect(planBatch({ ...cold, kitchenFactor: 1.5 }).yeast.pct).toBe(p.yeast.pct);
    expect(planBatch({ ...cold, stageH: 72 }).yeast.pct).toBe(p.yeast.pct);
    expect(planBatch({ ...cold, manualYeastPct: 0.001 }).yeast.pct).toBe(0.001);
  });

  it('refuses a fridge time outside 24-72 h', () => {
    expect(planBatch({ ...cold, stageH: 20 }).errors.join(' ')).toContain('24-72');
    expect(planBatch({ ...cold, stageH: 80 }).errors.join(' ')).toContain('24-72');
    expect(planBatch({ ...cold, stageH: 72 }).errors).toEqual([]);
  });

  it('start mode bakes after the fridge time and the counter rest; no "both" mode', () => {
    const p = planBatch({ ...cold, timing: 'start', startAt: new Date('2026-11-13T11:50:00') });
    expect(stamp(p.input.eatAt)).toBe('15 18:00');
    expect(timingModes(overnight, true)).toEqual(['eat', 'start']);
    expect(timingModes(overnight)).toEqual(['eat', 'start', 'both']);
  });

  it('poolish doughs keep the room rise', () => {
    expect(coldOk(poolish)).toBe(false);
    const p = planBatch({ ...base, formula: poolish, coldBulk: true });
    expect(p.coldBulk).toBe(false);
    expect(p.schedule.steps.map((s) => s.key)).toContain('poolish');
  });

  it('room rise is unchanged', () => {
    const p = planBatch(base);
    expect(p.coldBulk).toBe(false);
    expect(p.schedule.steps.find((s) => s.key === 'ball')!.label).toBe('Divide, ball and into the fridge');
  });

  describe('replan', () => {
    const plan = planBatch(cold);
    const input = {
      formula: overnight,
      stageH: plan.stageH,
      warmUpH: 2,
      eatAt: dinner,
      plannedMixAt: plan.schedule.steps.find((s) => s.key === 'mix')!.at,
      coldBulk: true,
    };

    it('the fridge absorbs a fold 3 hours late', () => {
      const r = replan(input, { fold: new Date('2026-11-13T16:00:00') });
      expect(r.movedTo).toBeUndefined();
      expect(stamp(r.steps.find((s) => s.key === 'ball')!.at)).toBe('15 13:00');
    });

    it('a fold too late for 24 h in the fridge moves dinner', () => {
      const r = replan(input, { fold: new Date('2026-11-14T15:00:00') });
      expect(stamp(r.movedTo!)).toBe('15 20:00');
    });

    it('balling late moves dinner by the same amount', () => {
      const r = replan(input, { ball: new Date('2026-11-15T14:00:00') });
      expect(stamp(r.movedTo!)).toBe('15 19:00');
    });
  });
});

describe('rise path is recorded and compared', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetConnection();
  });

  it('lock in keeps coldBulk for pizza; history keeps room and fridge apart', async () => {
    const s = await api.getSettings();
    const form = { formula: overnight, balls, eatAt: dinner, roomF: 70, mixer: 'hand' as const };
    const fridge = await api.lockIn(api.makePlan({ ...form, coldBulk: true }, s), 'hand');
    const room = await api.lockIn(api.makePlan(form, s), 'hand');
    expect(fridge.planned.coldBulk).toBe(true);
    expect('coldBulk' in room.planned).toBe(false);
    expect(api.riseOf(fridge)).toBe('fridge');
    expect(api.riseOf(room)).toBe('room');
    expect(api.batchProgress(fridge).steps.map((x) => x.key)).not.toContain('pull');

    await api.addSession(fridge.id, { ovenId: 'home-oven', balls: 2, survey: { overall: 5 } });
    await api.addSession(room.id, { ovenId: 'home-oven', balls: 2, survey: { overall: 3 } });
    const hist = await api.doughHistory();
    const row = (r: string) => hist.find((h) => h.doughId === overnight.id && h.rise === r)!;
    expect(row('fridge')).toMatchObject({ bakes: 1, avgOverall: 5, bestBatchId: fridge.id });
    expect(row('room')).toMatchObject({ bakes: 1, avgOverall: 3, bestBatchId: room.id });
  });
});
