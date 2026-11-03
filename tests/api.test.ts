import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import * as api from '../src/api';
import { resetConnection } from '../src/data/store';

beforeEach(() => {
  // Fresh database for every test.
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});

async function lockOne() {
  const s = await api.getSettings();
  const formula = await api.findDough(s.lastDoughId);
  const plan = api.makePlan(
    {
      formula,
      balls: s.lastBalls,
      eatAt: new Date('2026-11-07T18:00:00'),
      roomF: 70,
      mixer: 'hand',
      mixAt: new Date('2026-11-06T19:00:00'),
    },
    s,
  );
  expect(plan.errors).toEqual([]);
  return api.lockIn(plan, 'hand');
}

describe('api contracts', () => {
  it('first run: defaults to Forkish overnight, 5 x 340 g', async () => {
    const s = await api.getSettings();
    expect(s.lastDoughId).toBe('forkish-overnight');
    expect(s.lastBalls).toEqual([{ count: 5, grams: 340, label: 'pizza' }]);
  });

  it('lock in freezes the plan and remembers last choices', async () => {
    const b = await lockOne();
    expect(b.planned.yeast.basis).toBe('book');
    expect(b.planned.steps.length).toBeGreaterThan(3);
    const s = await api.getSettings();
    expect(s.lastDoughId).toBe('forkish-overnight');
  });

  it('two bake sessions on one batch, advice and backup counter', async () => {
    const b = await lockOne();
    const r1 = await api.addSession(b.id, {
      ovenId: 'home-oven',
      balls: 3,
      survey: { ready: 'onTime', stretch: 'tore', rim: 'good', bottom: 'good', center: 'set', overall: 4, makeAgain: true },
    });
    expect(r1.suggestion?.area).toBe('handling');
    const r2 = await api.addSession(b.id, {
      ovenId: 'home-oven',
      balls: 2,
      survey: { ready: 'late', overall: 3 },
    });
    expect(r2.batch.sessions.length).toBe(2);
    expect(r2.batch.planned.eatAt).toBe(b.planned.eatAt); // planned untouched
    const tally = await api.timingTally();
    expect(tally).toEqual({ early: 0, onTime: 1, late: 1 });
    const hist = await api.doughHistory();
    expect(hist[0]).toMatchObject({ bakes: 2, avgOverall: 3.5 });
  });

  it('actual layer edits never touch the plan', async () => {
    const b = await lockOne();
    const next = await api.updateActual(b.id, { roomF: 66, finalDoughF: 76 });
    expect(next.actual).toEqual({ roomF: 66, finalDoughF: 76 });
    expect(next.planned).toEqual(b.planned);
  });

  it('clone a preset into My Doughs and edit it', async () => {
    const f = await api.findDough('forkish-overnight');
    const mine = await api.cloneDough(f, 'My overnight');
    await api.saveDough({ ...mine, hydration: 0.72 });
    const found = await api.findDough(mine.id);
    expect(found.hydration).toBe(0.72);
    expect(api.isPreset(found)).toBe(false);
  });

  it('export then import into an empty phone restores everything', async () => {
    const b = await lockOne();
    await api.addSession(b.id, { ovenId: 'home-oven', balls: 5, survey: { overall: 5 } });
    const { json } = await api.exportBackup();
    expect((await api.getSettings()).bakesSinceBackup).toBe(0);

    globalThis.indexedDB = new IDBFactory();
    resetConnection();
    expect(await api.listBatches()).toEqual([]);

    await api.importBackup(json);
    const restored = await api.listBatches();
    expect(restored.length).toBe(1);
    expect(restored[0].sessions[0].survey.overall).toBe(5);
  });

  it('rejects a backup from a newer schema', async () => {
    const bad = JSON.stringify({ app: 'dough-app', schema: 99, settings: {}, doughs: [], batches: [], photos: [] });
    await expect(api.importBackup(bad)).rejects.toThrow(/newer version/);
  });

  it('calendar file has one event per step', async () => {
    const b = await lockOne();
    const ics = api.batchIcs(b);
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(b.planned.steps.length);
  });
});
