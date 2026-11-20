import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Formula } from '../engine/types';
import { SCHEMA_VERSION, type Batch, type ExportFile, type Photo, type Settings } from './types';

interface DoughDB extends DBSchema {
  settings: { key: string; value: Settings };
  doughs: { key: string; value: Formula };
  batches: { key: string; value: Batch; indexes: { createdAt: string } };
  photos: { key: string; value: Photo };
}

const DB_NAME = 'dough-app';

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  unit: 'F',
  roomF: 70,
  // Within PizzaBlab's "typically 0.5-3 h" out of the fridge; adjust to taste.
  warmUpH: 1.5,
  // Book water temperatures are used when the room sits inside this band.
  bandLowF: 66,
  bandHighF: 74,
  mixer: 'hand',
  frictionHandF: 2,
  frictionMixerF: 23,
  kitchenFactor: 1,
  lastDoughId: 'forkish-overnight',
  lastBalls: [{ count: 5, grams: 340, label: 'pizza' }],
  ovens: [{ id: 'home-oven', name: 'Home oven' }],
  lastOvenId: 'home-oven',
  hiddenDoughIds: [],
  bakesSinceBackup: 0,
  reminderLeadMin: 0,
  // King Arthur: preheat a stone or steel "at least an hour" (How to make pizza crust crispy, 2024).
  // Baking Steel says 45-60 minutes. Editable in Settings.
  preheatMin: 60,
  // America's Test Kitchen "Pizza Dough Kneaded in a Standing Mixer": about 5 minutes. Editable in Settings.
  mixerMin: 5,
  yeastType: 'instant',
};

let dbPromise: Promise<IDBPDatabase<DoughDB>> | null = null;

/**
 * Schema migrations. Each step upgrades from the version before it.
 * Add a new `if (oldVersion < N)` block for every schema change; never edit an old one.
 */
export function db(): Promise<IDBPDatabase<DoughDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DoughDB>(DB_NAME, SCHEMA_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore('settings', { keyPath: 'id' });
          database.createObjectStore('doughs', { keyPath: 'id' });
          const batches = database.createObjectStore('batches', { keyPath: 'id' });
          batches.createIndex('createdAt', 'createdAt');
          database.createObjectStore('photos', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/** Test hook: forget the cached connection. */
export function resetConnection(): void {
  dbPromise = null;
}

export async function getSettings(): Promise<Settings> {
  const s = await (await db()).get('settings', 'settings');
  // Spread over defaults so settings saved by an older version pick up new fields.
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('settings', s);
}

export async function listDoughs(): Promise<Formula[]> {
  return (await db()).getAll('doughs');
}

export async function saveDough(f: Formula): Promise<void> {
  await (await db()).put('doughs', f);
}

export async function deleteDough(id: string): Promise<void> {
  await (await db()).delete('doughs', id);
}

export async function listBatches(): Promise<Batch[]> {
  const all = await (await db()).getAllFromIndex('batches', 'createdAt');
  return all.reverse();
}

export async function getBatch(id: string): Promise<Batch | undefined> {
  return (await db()).get('batches', id);
}

export async function saveBatch(b: Batch): Promise<void> {
  await (await db()).put('batches', b);
}

export async function deleteBatch(id: string): Promise<void> {
  const d = await db();
  const b = await d.get('batches', id);
  for (const s of b?.sessions ?? []) if (s.photoId) await d.delete('photos', s.photoId);
  await d.delete('batches', id);
}

export async function savePhoto(p: Photo): Promise<void> {
  await (await db()).put('photos', p);
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return (await db()).get('photos', id);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const type = /data:(.*?);base64/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportAll(): Promise<ExportFile> {
  const d = await db();
  const photos = await d.getAll('photos');
  return {
    app: 'dough-app',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    // The reminder id belongs to this phone; a restore on another phone must not share its server slot.
    // Same for its queue of reminder clears still owed to the server.
    settings: (({ pushDeviceId: _omit, pendingCancels: _queue, ...s }) => s)(await getSettings()) as Settings,
    doughs: await d.getAll('doughs'),
    batches: await d.getAll('batches'),
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, dataUrl: await blobToDataUrl(p.blob) }))),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasId = (v: unknown) => isObj(v) && typeof v.id === 'string' && v.id !== '';

/**
 * Checks a backup file before anything on the phone is touched. Throws a plain-language error naming
 * what is wrong, so a damaged or partial file can never clear the phone first.
 */
export function checkBackup(file: unknown): ExportFile {
  if (!isObj(file) || file.app !== 'dough-app') throw new Error('Not a Dough backup file.');
  const schema = file.schema;
  if (typeof schema !== 'number' || !Number.isInteger(schema) || schema < 1) {
    throw new Error('This backup file is damaged (no version number). Nothing was changed.');
  }
  if (schema > SCHEMA_VERSION) throw new Error('This backup is from a newer version of the app. Update the app first.');
  const bad = (what: string) => new Error(`This backup file is damaged (${what}). Nothing was changed.`);
  if (!isObj(file.settings)) throw bad('settings missing');
  for (const key of ['doughs', 'batches', 'photos'] as const) {
    if (!Array.isArray(file[key])) throw bad(`${key} missing`);
  }
  if (!(file.doughs as unknown[]).every(hasId)) throw bad('a dough has no id');
  if (!(file.batches as unknown[]).every((b) => hasId(b) && isObj((b as Record<string, unknown>).planned) && isObj((b as Record<string, unknown>).actual))) {
    throw bad('a bake is incomplete');
  }
  if (!(file.photos as unknown[]).every((p) => hasId(p) && typeof (p as Record<string, unknown>).dataUrl === 'string' && ((p as Record<string, unknown>).dataUrl as string).startsWith('data:'))) {
    throw bad('a photo is unreadable');
  }
  return file as unknown as ExportFile;
}

/** Replaces everything on this phone with the backup's contents. Checks the whole file first. */
export async function importAll(raw: unknown): Promise<void> {
  const file = checkBackup(raw);
  // Decode photos before the wipe too: a bad one fails here, with the phone untouched.
  let photos: Photo[];
  try {
    photos = file.photos.map((p) => ({ id: p.id, blob: dataUrlToBlob(p.dataUrl) }));
  } catch {
    throw new Error('This backup file is damaged (a photo is unreadable). Nothing was changed.');
  }
  const d = await db();
  const tx = d.transaction(['settings', 'doughs', 'batches', 'photos'], 'readwrite');
  try {
    // Keep this phone's own reminder id, never the one in the file (older backups carried it).
    const own = (await tx.objectStore('settings').get('settings')) as Settings | undefined;
    await Promise.all([
      tx.objectStore('settings').clear(),
      tx.objectStore('doughs').clear(),
      tx.objectStore('batches').clear(),
      tx.objectStore('photos').clear(),
    ]);
    const { pushDeviceId: _fromFile, pendingCancels: _theirQueue, ...settings } = file.settings;
    await tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...settings, pushDeviceId: own?.pushDeviceId, pendingCancels: own?.pendingCancels });
    for (const f of file.doughs) await tx.objectStore('doughs').put(f);
    // Restored batches start with reminders off on this phone; turn them back on per batch.
    for (const b of file.batches) {
      await tx.objectStore('batches').put({ ...b, actual: { ...b.actual, reminders: false, reminderSync: undefined } });
    }
    for (const p of photos) await tx.objectStore('photos').put(p);
    await tx.done;
  } catch (e) {
    // Roll back the clear so the phone keeps what it had.
    try { tx.abort(); } catch { /* already finished */ }
    await tx.done.catch(() => undefined);
    throw e;
  }
}
