import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The push module talks to the browser and the server; stand it in so we control success and failure.
const push = vi.hoisted(() => ({
  online: true,
  sent: [] as { deviceId: string; batchId: string; items: { at: string; title: string; body: string }[] }[],
  cancelled: [] as string[],
}));
vi.mock('../src/data/push', () => ({
  pushSupported: () => true,
  pushPermission: () => 'granted',
  scheduleReminders: async (r: (typeof push.sent)[number]) => {
    if (!push.online) throw new Error('offline');
    push.sent.push(r);
  },
  cancelReminders: async (_device: string, batchId: string) => {
    if (!push.online) throw new Error('offline');
    push.cancelled.push(batchId);
  },
}));

import * as api from '../src/api';
import { resetConnection } from '../src/data/store';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
  push.online = true;
  push.sent = [];
  push.cancelled = [];
});

/** A batch whose steps are all in the future, so every step is still reminder-worthy. */
async function lockFuture() {
  const s = await api.getSettings();
  const formula = await api.findDough(s.lastDoughId);
  const eatAt = new Date(Date.now() + 3 * 24 * 3600_000);
  const plan = api.makePlan({ formula, balls: s.lastBalls, eatAt, roomF: 70, mixer: 'hand' }, s);
  expect(plan.errors).toEqual([]);
  return api.lockIn(plan, 'hand');
}

describe('reminders', () => {
  it('sends only step names, times and the dough name', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    const items = push.sent.at(-1)!.items;
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.body).toBe(b.planned.formula.name);
      expect(Object.keys(i).sort()).toEqual(['at', 'body', 'title']);
    }
  });

  it('heads-up: each reminder is due that many minutes before its step, and says so', async () => {
    const b = await lockFuture();
    const steps = api.batchProgress(b).steps;
    const plain = api.reminderItems(b, 0);
    const early = api.reminderItems(b, 5);
    expect(early.map((i) => Date.parse(i.at))).toEqual(plain.map((i) => Date.parse(i.at) - 5 * 60_000));
    expect(early[0].body).toBe(`${b.planned.formula.name} · in 5 min`);
    expect(plain[0].body).toBe(b.planned.formula.name);
    expect(plain.map((i) => i.title)).toEqual(steps.map((s) => s.label));
  });

  it('heads-up: a step still ahead whose heads-up time has passed is sent right away; the cap is 60', async () => {
    const b = await lockFuture();
    const first = api.batchProgress(b).steps[0].at.getTime();
    const now = first - 2 * 60_000; // step in 2 minutes, heads-up 5
    expect(Date.parse(api.reminderItems(b, 5, now)[0].at)).toBe(now);
    const capped = api.reminderItems(b, 500, first - 3 * 3600_000);
    expect(Date.parse(capped[0].at)).toBe(first - 60 * 60_000);
  });

  it('changing the heads-up re-sends batches with reminders on', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    const before = push.sent.length;
    const s = await api.setReminderLead(10);
    expect(s.reminderLeadMin).toBe(10);
    expect(push.sent.length).toBe(before + 1);
    const plain = api.reminderItems(b, 0);
    expect(push.sent.at(-1)!.items.map((i) => Date.parse(i.at))).toEqual(plain.map((i) => Date.parse(i.at) - 10 * 60_000));
    expect((await api.setReminderLead(-3)).reminderLeadMin).toBe(0);
  });

  it('a check-off with no signal is marked, then retried when back online', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    push.online = false;
    const offline = await api.checkStep(b.id, 'autolyse');
    expect(offline.actual.done?.autolyse).toBeDefined(); // the checklist still works
    expect(offline.actual.reminderSync).toBe('pending');

    expect(await api.retryReminders()).toBe(0); // still offline: stays pending
    push.online = true;
    const before = push.sent.length;
    expect(await api.retryReminders()).toBe(1);
    expect((await api.getBatch(b.id))!.actual.reminderSync).toBeUndefined();
    const resent = push.sent.slice(before).at(-1)!;
    expect(resent.items.some((i) => i.title === 'Autolyse')).toBe(false); // the ticked step is gone
  });

  it('turning reminders off with no signal is retried as a cancel', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    push.online = false;
    expect((await api.remindersOff(b.id)).actual.reminderSync).toBe('pending');
    push.online = true;
    await api.retryReminders();
    expect(push.cancelled).toContain(b.id);
  });
});

describe('backups and the reminder id', () => {
  it('a backup does not carry this phone’s reminder id; a restore keeps the receiving phone’s own', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    const mine = (await api.getSettings()).pushDeviceId!;
    expect(mine).toBeTruthy();

    const { json } = await api.exportBackup();
    expect(json).not.toContain(mine);

    // An older backup that still has an id in it must not overwrite this phone's.
    const old = JSON.parse(json);
    old.settings.pushDeviceId = '00000000-0000-4000-8000-000000000000';
    await api.importBackup(JSON.stringify(old));
    expect((await api.getSettings()).pushDeviceId).toBe(mine);

    // Restored batches start with reminders off, and the old ones were cleared on the server.
    const restored = (await api.getBatch(b.id))!;
    expect(restored.actual.reminders).toBe(false);
    expect(push.cancelled).toContain(b.id);
  });

  it('a restore on a phone that never used reminders gets no id from the file', async () => {
    const { json } = await api.exportBackup();
    const file = JSON.parse(json);
    file.settings.pushDeviceId = '11111111-1111-4111-8111-111111111111';
    await api.importBackup(JSON.stringify(file));
    expect((await api.getSettings()).pushDeviceId).toBeUndefined();
  });
});
