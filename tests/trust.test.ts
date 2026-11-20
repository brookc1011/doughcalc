import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stand in for the push module so we control the network: online/offline, and slow calls held by a gate.
const push = vi.hoisted(() => ({
  online: true,
  sent: [] as { deviceId: string; batchId: string; items: { at: string; title: string; body: string }[] }[],
  cancelled: [] as string[],
  // Each entry holds back one scheduleReminders call until it resolves (first call takes the first gate).
  gates: [] as Promise<void>[],
}));
vi.mock('../src/data/push', () => ({
  pushSupported: () => true,
  pushPermission: () => 'granted',
  scheduleReminders: async (r: (typeof push.sent)[number]) => {
    const gate = push.gates.shift();
    if (gate) await gate;
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
  push.gates = [];
});

async function lockFuture() {
  const s = await api.getSettings();
  const formula = await api.findDough(s.lastDoughId);
  const eatAt = new Date(Date.now() + 3 * 24 * 3600_000);
  const plan = api.makePlan({ formula, balls: s.lastBalls, eatAt, roomF: 70, mixer: 'hand' }, s);
  expect(plan.errors).toEqual([]);
  return api.lockIn(plan, 'hand');
}

describe('restore checks the file before touching the phone', () => {
  const backupWith = async (change: (f: Record<string, unknown>) => void) => {
    const f = JSON.parse((await api.exportBackup()).json);
    change(f);
    return JSON.stringify(f);
  };

  it('a file missing its batches is refused and the phone keeps its bakes', async () => {
    const b = await lockFuture();
    const bad = await backupWith((f) => delete f.batches);
    await expect(api.importBackup(bad)).rejects.toThrow(/damaged.*Nothing was changed/);
    expect((await api.listBatches()).map((x) => x.id)).toEqual([b.id]);
  });

  it('a file with no version number is refused', async () => {
    await lockFuture();
    const bad = await backupWith((f) => delete f.schema);
    await expect(api.importBackup(bad)).rejects.toThrow(/no version number/);
    expect(await api.listBatches()).toHaveLength(1);
  });

  it('an unreadable photo is caught before the wipe', async () => {
    await lockFuture();
    const bad = await backupWith((f) => {
      f.photos = [{ id: 'p1', dataUrl: 'data:image/jpeg;base64,@@not base64@@' }];
    });
    await expect(api.importBackup(bad)).rejects.toThrow(/photo/);
    expect(await api.listBatches()).toHaveLength(1);
  });

  it('a bake missing its plan is refused', async () => {
    await lockFuture();
    const bad = await backupWith((f) => {
      (f.batches as Record<string, unknown>[])[0].planned = undefined;
    });
    await expect(api.importBackup(bad)).rejects.toThrow(/bake is incomplete/);
    expect(await api.listBatches()).toHaveLength(1);
  });

  it('text that is not JSON gets a plain message', async () => {
    await expect(api.importBackup('not json')).rejects.toThrow('Not a Dough backup file.');
  });

  it('a good file still restores', async () => {
    const b = await lockFuture();
    const { json } = await api.exportBackup();
    await api.deleteBatch(b.id);
    await api.importBackup(json);
    expect((await api.listBatches()).map((x) => x.id)).toEqual([b.id]);
  });
});

describe('reminder sync never undoes a check-off', () => {
  it('a slow sync that finishes last keeps the newer check-off', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    const [first, second] = api.batchProgress(b).steps.map((s) => s.key);

    let release!: () => void;
    push.gates.push(new Promise<void>((r) => (release = r)));
    const slow = api.checkStep(b.id, first); // held on the network
    await new Promise((r) => setTimeout(r, 20));
    await api.checkStep(b.id, second); // finishes first
    release();
    await slow;

    const stored = (await api.getBatch(b.id))!;
    expect(Object.keys(stored.actual.done ?? {}).sort()).toEqual([first, second].sort());
    expect(stored.actual.reminderSync).toBeUndefined();
    // The server's last copy matches the phone: neither step is still in it.
    const last = push.sent.at(-1)!.items.map((i) => i.title);
    const labels = api.batchProgress(stored).steps.filter((s) => s.doneAt).map((s) => s.label);
    for (const l of labels) expect(last).not.toContain(l);
  });

  it('turning reminders off is saved even when the server is unreachable', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    push.online = false;
    const off = await api.remindersOff(b.id);
    expect(off.actual.reminders).toBe(false);
    expect(off.actual.reminderSync).toBe('pending');
  });
});

describe('settings changes are patches', () => {
  it('a change from an old copy keeps the reminder id and other values', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    const id = (await api.getSettings()).pushDeviceId;
    expect(id).toBeTruthy();
    const next = await api.updateSettings({ warmUpH: 2 });
    expect(next.pushDeviceId).toBe(id);
    expect(next.warmUpH).toBe(2);
    expect((await api.getSettings()).pushDeviceId).toBe(id);
  });
});

describe('deleting a batch clears its reminders', () => {
  it('online: the server is told at once', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    await api.deleteBatch(b.id);
    expect(push.cancelled).toContain(b.id);
    expect((await api.getSettings()).pendingCancels).toBeUndefined();
  });

  it('offline: the clear waits in a queue and goes out on the next retry', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    push.online = false;
    await api.deleteBatch(b.id);
    expect((await api.getSettings()).pendingCancels).toEqual([b.id]);
    push.online = true;
    await api.retryReminders();
    expect(push.cancelled).toContain(b.id);
    expect((await api.getSettings()).pendingCancels).toBeUndefined();
  });

  it('the queue belongs to this phone: not in backups, kept through a restore', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    push.online = false;
    await api.deleteBatch(b.id);
    const { json } = await api.exportBackup();
    expect(JSON.parse(json).settings.pendingCancels).toBeUndefined();
    await api.importBackup(json);
    expect((await api.getSettings()).pendingCancels).toEqual([b.id]);
  });

  it('a sync still on the network does not bring a deleted batch back', async () => {
    const b = await lockFuture();
    await api.remindersOn(b.id);
    let release!: () => void;
    push.gates.push(new Promise<void>((r) => (release = r)));
    const slow = api.checkStep(b.id, api.batchProgress(b).steps[0].key);
    await new Promise((r) => setTimeout(r, 20));
    await api.deleteBatch(b.id);
    release();
    await slow;
    expect(await api.getBatch(b.id)).toBeUndefined();
  });
});
