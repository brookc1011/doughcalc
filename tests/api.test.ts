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

describe('bake help: method, preheat, yeast, flour', () => {
  async function plan(mixer: 'hand' | 'mixer', yeastType?: 'instant' | 'activeDry') {
    const s = await api.getSettings();
    const formula = await api.findDough(s.lastDoughId);
    return api.makePlan(
      { formula, balls: s.lastBalls, eatAt: new Date('2026-11-07T18:00:00'), roomF: 70, mixer, mixAt: new Date('2026-11-06T19:00:00'), yeastType },
      s,
    );
  }

  it('new batches carry a preheat step and the chosen method through the checklist', async () => {
    const b = await api.lockIn(await plan('mixer'), 'mixer', 'ap');
    expect(b.planned.stepVersion).toBe(3);
    expect(b.planned.flour).toBe('ap');
    const steps = api.batchProgress(b).steps;
    expect(steps.some((s) => s.key === 'preheat')).toBe(true);
    expect(steps.find((s) => s.key === 'mix')!.detail).toContain('speed 2');
    expect((await api.getSettings()).flour).toBe('ap');
  });

  it('a batch locked before this change keeps hand text and gets no preheat step', async () => {
    const b = await api.lockIn(await plan('mixer'), 'mixer');
    const old = { ...b, planned: { ...b.planned, stepVersion: undefined, preheatMin: undefined } };
    const steps = api.batchProgress(old).steps;
    expect(steps.some((s) => s.key === 'preheat')).toBe(false);
    expect(steps.find((s) => s.key === 'mix')!.detail).toContain('pincer');
  });

  it('new batches spell out the batch grams in the step text', async () => {
    const b = await api.lockIn(await plan('hand'), 'hand');
    const steps = api.batchProgress(b).steps;
    const water = b.planned.recipe.parts[0].ingredients.find((i) => i.key === 'water')!.grams;
    const salt = b.planned.recipe.parts[0].ingredients.find((i) => i.key === 'salt')!.grams;
    const first = steps[0].detail;
    expect(first).toContain(`${Math.round(water).toLocaleString('en-US')} g water`);
    expect(first).toContain('3 tbsp');
    expect(steps.find((s) => s.key === 'mix')!.detail).toContain(`${Math.round(salt)} g salt`);
    expect(steps.find((s) => s.key === 'ball')!.detail).toMatch(/cut \d+ pieces? of \d+ g/);
  });

  it('a version-2 batch keeps the short step text', async () => {
    const b = await api.lockIn(await plan('hand'), 'hand');
    const v2 = { ...b, planned: { ...b.planned, stepVersion: 2 as const } };
    expect(api.batchProgress(v2).steps[0].detail).not.toContain('3 tbsp');
  });

  it('every dough step says lid on or off; oven steps say nothing', async () => {
    const b = await api.lockIn(await plan('hand'), 'hand');
    const steps = api.batchProgress(b).steps;
    const cover = Object.fromEntries(steps.map((s) => [s.key, s.cover]));
    expect(cover.autolyse).toBe('on');
    expect(cover.mix).toBe('on');
    expect(cover.fold).toBe('on');
    expect(cover.ball).toBe('off');
    expect(cover.fridge).toBe('on');
    expect(cover.preheat).toBeUndefined();
    expect(cover.bake).toBeUndefined();
    expect(steps.find((s) => s.key === 'mix')!.detail).toContain('put the lid on');
    expect(steps.find((s) => s.key === 'ball')!.detail).toContain('No cover needed');
  });

  it('mix step: soft and sticky is expected; mixer minutes follow the setting and say whose they are', async () => {
    const plain = api.batchProgress(await api.lockIn(await plan('mixer'), 'mixer')).steps.find((s) => s.key === 'mix')!;
    expect(plain.detail).toContain("about 5 minutes (America's Test Kitchen)");
    expect(plain.detail).toContain('hold together as one mass');
    expect(plain.detail).not.toContain('smooth and elastic');
    expect(plain.timer).toEqual({ kind: 'countdown', min: 5, source: "America's Test Kitchen: about 5 minutes on low" });

    await api.saveSettings({ ...(await api.getSettings()), mixerMin: 9 });
    const b = await api.lockIn(await plan('mixer'), 'mixer');
    expect(b.planned.mixerMin).toBe(9);
    const mix = api.batchProgress(b).steps.find((s) => s.key === 'mix')!;
    expect(mix.detail).toContain("9 minutes (your setting; America's Test Kitchen says about 5)");
    expect(mix.timer).toMatchObject({ kind: 'countdown', min: 9, source: 'Your setting' });
  });

  it('timers: autolyse 20 up to 30 (FWSY), fold 30 (King Arthur), hand mix is a stopwatch', async () => {
    const steps = api.batchProgress(await api.lockIn(await plan('hand'), 'hand')).steps;
    const t = (k: string) => steps.find((s) => s.key === k)!.timer;
    expect(t('autolyse')).toMatchObject({ kind: 'countdown', min: 20, upToMin: 30 });
    expect(t('autolyse')).toMatchObject({ source: expect.stringContaining('FWSY p.220') });
    expect(t('fold')).toMatchObject({ kind: 'countdown', min: 30 });
    expect(t('mix')!.kind).toBe('stopwatch');
    expect(t('ball')).toBeUndefined();
  });

  it('each step lists what goes in, with this batch\u2019s grams', async () => {
    const b = await api.lockIn(await plan('hand'), 'hand');
    const steps = api.batchProgress(b).steps;
    const salt = b.planned.recipe.parts[0].ingredients.find((i) => i.key === 'salt')!.grams;
    const first = steps.find((s) => s.key === 'autolyse')!.ingredients!;
    expect(first.map((i) => i.name)).toEqual(['Water', 'Flour', 'Instant yeast']);
    expect(steps.find((s) => s.key === 'mix')!.ingredients).toContainEqual({ name: 'Salt', amount: `${Math.round(salt)} g` });
    expect(steps.find((s) => s.key === 'ball')!.ingredients![0].name).toBe('Dough balls');
    const v2 = { ...b, planned: { ...b.planned, stepVersion: 2 as const } };
    expect(api.batchProgress(v2).steps.every((s) => !s.ingredients)).toBe(true);
  });

  it('all-purpose flour adds King Arthur\u2019s less-water note, with no amount', async () => {
    const s = await api.getSettings();
    const formula = await api.findDough(s.lastDoughId);
    const p = api.makePlan(
      { formula, balls: s.lastBalls, eatAt: new Date('2026-11-07T18:00:00'), roomF: 70, mixer: 'hand', mixAt: new Date('2026-11-06T19:00:00'), flour: 'ap' },
      s,
    );
    expect(p.schedule.steps[0].detail).toContain('King Arthur says to use less water');
    const b = await api.lockIn(p, 'hand', 'ap');
    expect(api.batchProgress(b).steps[0].detail).toContain('use less water');
    const b00 = await api.lockIn(await plan('hand'), 'hand', '00');
    expect(api.batchProgress(b00).steps[0].detail).not.toContain('less water');
  });

  it('bulk room temperature: asked after the fold, stored in °F, or skipped', async () => {
    const b = await api.lockIn(await plan('hand'), 'hand');
    expect(api.wantsBulkRoomTemp(b)).toBe(false);
    const folded = await api.checkStep(b.id, 'fold', new Date('2026-11-06T20:00:00'));
    expect(api.wantsBulkRoomTemp(folded)).toBe(true);
    const c = await api.recordBulkRoomTemp(b.id, 20, 'C');
    expect(c.actual.bulkRoomF).toBe(68);
    expect(api.wantsBulkRoomTemp(c)).toBe(false);
    expect((await api.getBatch(b.id))!.actual.bulkRoomF).toBe(68);

    const b2 = await api.lockIn(await plan('hand'), 'hand');
    await api.checkStep(b2.id, 'fold', new Date('2026-11-06T20:00:00'));
    const skipped = await api.recordBulkRoomTemp(b2.id, null, 'F');
    expect(skipped.actual.bulkRoomSkipped).toBe(true);
    expect(api.wantsBulkRoomTemp(skipped)).toBe(false);
  });

  it('step timer: a countdown ends after its minutes, a stopwatch counts up, stop clears it', async () => {
    const b = await api.lockIn(await plan('hand'), 'hand');
    const t0 = new Date('2026-11-06T19:00:00');
    const a = await api.startTimer(b.id, 'autolyse', t0);
    expect(a.actual.timer).toEqual({ key: 'autolyse', startedAt: t0.toISOString(), endAt: new Date(t0.getTime() + 20 * 60_000).toISOString() });
    expect(api.timerState(a, t0.getTime() + 60_000)).toMatchObject({ kind: 'countdown', ms: 19 * 60_000, done: false });
    expect(api.timerState(a, t0.getTime() + 21 * 60_000)).toMatchObject({ ms: 0, done: true });
    const m = await api.startTimer(b.id, 'mix', t0);
    expect(m.actual.timer!.endAt).toBeUndefined();
    expect(api.timerState(m, t0.getTime() + 90_000)).toMatchObject({ kind: 'stopwatch', ms: 90_000 });
    expect((await api.stopTimer(b.id)).actual.timer).toBeUndefined();
    await expect(api.startTimer(b.id, 'ball', t0)).rejects.toThrow('No timer');
  });

  it('active dry from the form is stored on the batch', async () => {
    const b = await api.lockIn(await plan('hand', 'activeDry'), 'hand');
    expect(b.planned.yeastType).toBe('activeDry');
  });

  it('flour history averages overall scores per flour', async () => {
    const a = await api.lockIn(await plan('hand'), 'hand', '00');
    await api.addSession(a.id, { ovenId: 'home-oven', balls: 2, survey: { overall: 3 } });
    await api.addSession(a.id, { ovenId: 'home-oven', balls: 2, survey: { overall: 5 } });
    const c = await api.lockIn(await plan('hand'), 'hand', 'ap');
    await api.addSession(c.id, { ovenId: 'home-oven', balls: 2, survey: {} });
    await api.lockIn(await plan('hand'), 'hand');
    const h = await api.flourHistory();
    const z = h.find((r) => r.flour === '00')!;
    expect(z).toMatchObject({ bakes: 2, rated: 2, avgOverall: 4, label: '00' });
    expect(h.find((r) => r.flour === 'ap')).toMatchObject({ bakes: 1, rated: 0, avgOverall: undefined });
    expect(h.length).toBe(2);
  });
});
