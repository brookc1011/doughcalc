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
    settings: (({ pushDeviceId: _omit, ...s }) => s)(await getSettings()) as Settings,
    doughs: await d.getAll('doughs'),
    batches: await d.getAll('batches'),
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, dataUrl: await blobToDataUrl(p.blob) }))),
  };
}

/** Replaces everything on this phone with the backup's contents. */
export async function importAll(file: ExportFile): Promise<void> {
  if (file.app !== 'dough-app') throw new Error('Not a Dough backup file.');
  if (file.schema > SCHEMA_VERSION) throw new Error('This backup is from a newer version of the app. Update the app first.');
  const d = await db();
  const tx = d.transaction(['settings', 'doughs', 'batches', 'photos'], 'readwrite');
  // Keep this phone's own reminder id, never the one in the file (older backups carried it).
  const ownDeviceId = ((await tx.objectStore('settings').get('settings')) as Settings | undefined)?.pushDeviceId;
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('doughs').clear(),
    tx.objectStore('batches').clear(),
    tx.objectStore('photos').clear(),
  ]);
  const { pushDeviceId: _fromFile, ...settings } = file.settings;
  await tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...settings, pushDeviceId: ownDeviceId });
  for (const f of file.doughs) await tx.objectStore('doughs').put(f);
  // Restored batches start with reminders off on this phone; turn them back on per batch.
  for (const b of file.batches) {
    await tx.objectStore('batches').put({ ...b, actual: { ...b.actual, reminders: false, reminderSync: undefined } });
  }
  for (const p of file.photos) await tx.objectStore('photos').put({ id: p.id, blob: dataUrlToBlob(p.dataUrl) });
  await tx.done;
}
