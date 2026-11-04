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

describe('checklist', () => {
  it('check off mix: saved, mirrored to the actual mix time, later steps follow; uncheck restores', async () => {
    const b = await lockOne();
    const before = api.batchProgress(b);
    const ballBefore = before.steps.find((s) => s.key === 'ball')!.at.getTime();
    const late = new Date('2026-11-06T19:30:00');
    const checked = await api.checkStep(b.id, 'mix', late);
    expect(checked.actual.mixAt).toBe(late.toISOString());
    const after = api.batchProgress((await api.getBatch(b.id))!);
    expect(after.steps.find((s) => s.key === 'mix')!.doneAt!.getTime()).toBe(late.getTime());
    expect(after.steps.find((s) => s.key === 'ball')!.at.getTime() - ballBefore).toBe(30 * 60_000);
    expect(after.steps.find((s) => s.key === 'autolyse')!.passed).toBe(true);
    const un = await api.uncheckStep(b.id, 'mix');
    expect(api.batchProgress(un).steps.map((s) => s.at.getTime())).toEqual(before.steps.map((s) => s.at.getTime()));
  });
});

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

  it('book doughs start at 5 balls of the book weight', async () => {
    const f = await api.findDough('forkish-poolish');
    expect(api.defaultBalls(f)).toEqual([{ count: 5, grams: 350, label: 'pizza' }]);
  });

  it('change a book dough default to 2 balls, then reset to the book', async () => {
    const f = await api.findDough('forkish-overnight');
    await api.saveDough({ ...f, defaults: { balls: [{ count: 2, grams: 340, label: 'pizza' }], eatHour: 19 } });
    const edited = (await api.doughLibrary()).find((e) => e.formula.id === 'forkish-overnight')!;
    expect(edited.edited).toBe(true);
    expect(api.defaultBalls(edited.formula)[0].count).toBe(2);
    expect((await api.allDoughs()).filter((d) => d.id === 'forkish-overnight').length).toBe(1);

    await api.resetDough('forkish-overnight');
    const back = await api.findDough('forkish-overnight');
    expect(back.defaults).toBeUndefined();
    expect(api.defaultBalls(back)[0].count).toBe(5);
  });

  it('hide a book dough, then restore it', async () => {
    await api.removeDough('forkish-same-day');
    expect((await api.allDoughs()).map((d) => d.id)).not.toContain('forkish-same-day');
    const hidden = (await api.doughLibrary()).find((e) => e.formula.id === 'forkish-same-day')!;
    expect(hidden.hidden).toBe(true);
    await api.restoreDough('forkish-same-day');
    expect((await api.allDoughs()).map((d) => d.id)).toContain('forkish-same-day');
  });

  it('hiding the last-used dough moves the default to another dough', async () => {
    await api.removeDough('forkish-overnight');
    const s = await api.getSettings();
    expect(s.lastDoughId).not.toBe('forkish-overnight');
    expect((await api.allDoughs()).map((d) => d.id)).toContain(s.lastDoughId);
  });

  it('your own dough is deleted for good; the last dough cannot be removed', async () => {
    const mine = await api.cloneDough(await api.findDough('forkish-overnight'), 'Mine');
    await api.removeDough('forkish-overnight');
    await api.removeDough('forkish-same-day');
    await api.removeDough('forkish-poolish');
    expect((await api.allDoughs()).map((d) => d.id)).toEqual([mine.id]);
    await expect(api.removeDough(mine.id)).rejects.toThrow(/at least one/);

    await api.restoreDough('forkish-poolish');
    await api.removeDough(mine.id);
    expect((await api.doughLibrary()).some((e) => e.formula.id === mine.id)).toBe(false);
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
