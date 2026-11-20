// The ONE module the UI imports. Everything the screens need goes through here, so the
// engine and storage can be checked and protected separately from any UI restyle.
import { readyTally, suggestions, topSuggestion, type ReadyTally, type Suggestion, type Survey } from './engine/advice';
import { googleCalendarLink, stepsToIcs } from './engine/calendar';
import { rescaleBall, roundArea } from './engine/geometry';
import { coldOk, defaultStageH, planBatch, timingModes, type Plan, type PlanField, type TimingMode } from './engine/plan';
import { DEFAULT_EAT_HOUR, defaultBalls, isPresetId, PRESETS, STYLE_TF, STYLE_TF_SOURCE } from './engine/presets';
import type { Step } from './engine/schedule';
import { productOf, type BallGroup, type DoughDefaults, type Formula, type Ingredient, type Product } from './engine/types';
import { replan, type Progress, type ProgressStep } from './engine/progress';
import { downscalePhoto } from './data/photo';
import { cancelReminders, pushPermission, pushSupported, scheduleReminders } from './data/push';
import * as store from './data/store';
import type { Actual, BakeSession, Batch, Flour, Oven, Settings, StepRecord } from './data/types';
import { ACTIVE_DRY_SOURCE, type YeastType } from './engine/formula';

export type { Actual, BakeSession, Batch, BallGroup, Flour, YeastType, DoughDefaults, Formula, Ingredient, Oven, Plan, Product, Progress, ProgressStep, ReadyTally, Settings, Suggestion, Survey, TimingMode };
export type { Crust, Crumb, Loaf } from './engine/advice';
export type { PlanField };

/** A refusal with a message meant for the baker (the screen shows it as written). */
export class UserError extends Error {}
export { ACTIVE_DRY_SOURCE, PRESETS, STYLE_TF, STYLE_TF_SOURCE, suggestions, topSuggestion, productOf, timingModes };

/** Backup reminder cadence, in bake sessions. */
export const BACKUP_EVERY = 5;

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---------- settings ----------
export const getSettings = store.getSettings;
export const saveSettings = store.saveSettings;

/**
 * Change some settings without touching the rest: reads what is stored now and merges the change in.
 * Screens use this so an out-of-date copy on screen can't undo a restore or drop the reminder id.
 */
export async function updateSettings(patch: Partial<Omit<Settings, 'id' | 'pushDeviceId'>>): Promise<Settings> {
  const s = await store.getSettings();
  const next = { ...s, ...patch, id: s.id, pushDeviceId: s.pushDeviceId };
  await store.saveSettings(next);
  return next;
}

/** Ask the browser not to evict our data. Stores the answer in settings. */
export async function requestPersistence(): Promise<boolean> {
  const granted = (await navigator.storage?.persist?.()) ?? false;
  const s = await store.getSettings();
  await store.saveSettings({ ...s, persisted: granted });
  return granted;
}

// ---------- doughs ----------
// Book doughs live in code. Saving a dough with a book dough's id stores an edited copy that
// replaces it; "reset" deletes that copy. Removing a book dough only hides it, so it can come back.

export interface DoughEntry {
  formula: Formula;
  kind: 'book' | 'mine';
  /** Book dough with your own changes saved over it. */
  edited: boolean;
  hidden: boolean;
}

/** Every dough, pizza and bread. */
async function fullLibrary(): Promise<DoughEntry[]> {
  const s = await store.getSettings();
  const mine = await store.listDoughs();
  const byId = new Map(mine.map((d) => [d.id, d]));
  const book: DoughEntry[] = PRESETS.map((p) => ({
    formula: byId.get(p.id) ?? p,
    kind: 'book',
    edited: byId.has(p.id),
    hidden: s.hiddenDoughIds.includes(p.id),
  }));
  const custom: DoughEntry[] = mine
    .filter((d) => !isPresetId(d.id))
    .map((d) => ({ formula: d, kind: 'mine', edited: false, hidden: false }));
  return [...book, ...custom];
}

/** The dough library for one product (pizza by default, as before bread existed). */
export async function doughLibrary(product: Product = 'pizza'): Promise<DoughEntry[]> {
  return (await fullLibrary()).filter((e) => productOf(e.formula) === product);
}

/** Doughs shown in the Plan picker for one product. */
export async function allDoughs(product: Product = 'pizza'): Promise<Formula[]> {
  return (await doughLibrary(product)).filter((e) => !e.hidden).map((e) => e.formula);
}

/** A dough by id (any product). Missing: the first visible dough of `product`. */
export async function findDough(id: string, product?: Product): Promise<Formula> {
  const lib = await fullLibrary();
  const found = lib.find((e) => e.formula.id === id)?.formula;
  if (found) return found;
  const want = product ?? 'pizza';
  const same = lib.filter((e) => productOf(e.formula) === want);
  return same.find((e) => !e.hidden)?.formula ?? same[0]?.formula ?? PRESETS[0];
}

/** The dough to open the Plan screen on for a product: the last one you locked in. */
export async function lastDoughId(product: Product): Promise<string | undefined> {
  const s = await store.getSettings();
  return product === 'bread' ? s.lastBreadDoughId : s.lastDoughId;
}

export function isPreset(f: Formula): boolean {
  return isPresetId(f.id);
}

/** The untouched book version of a book dough, for "reset". */
export function bookOriginal(id: string): Formula | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Start a new dough from any existing one (it keeps that dough's yeast schedule and sources). */
export async function cloneDough(f: Formula, name: string): Promise<Formula> {
  const copy: Formula = structuredClone({ ...f, id: newId('my'), name, source: `Based on ${f.name}` });
  await store.saveDough(copy);
  return copy;
}

/** Save a dough. For a book dough this stores your edited version over the book one. */
export const saveDough = store.saveDough;

/** Undo your edits to a book dough. */
export async function resetDough(id: string): Promise<void> {
  if (isPresetId(id)) await store.deleteDough(id);
}

/** Delete your own dough, or hide a book dough. At least one dough always stays. */
export async function removeDough(id: string): Promise<void> {
  const all = await fullLibrary();
  const target = all.find((e) => e.formula.id === id);
  const product = target ? productOf(target.formula) : 'pizza';
  // At least one dough of each product stays.
  const visible = all.filter((e) => !e.hidden && productOf(e.formula) === product);
  if (visible.length <= 1 && visible[0]?.formula.id === id) throw new Error('Keep at least one dough.');
  const s = await store.getSettings();
  const other = () => visible.find((e) => e.formula.id !== id)!.formula.id;
  const last =
    product === 'bread'
      ? { lastBreadDoughId: s.lastBreadDoughId === id ? other() : s.lastBreadDoughId }
      : { lastDoughId: s.lastDoughId === id ? other() : s.lastDoughId };
  if (isPresetId(id)) {
    await store.saveSettings({ ...s, hiddenDoughIds: [...new Set([...s.hiddenDoughIds, id])], ...last });
  } else {
    await store.deleteDough(id);
    await store.saveSettings({ ...s, ...last });
  }
}

/** Bring a hidden book dough back into the picker. */
export async function restoreDough(id: string): Promise<void> {
  const s = await store.getSettings();
  await store.saveSettings({ ...s, hiddenDoughIds: s.hiddenDoughIds.filter((x) => x !== id) });
}

export { defaultBalls, DEFAULT_EAT_HOUR };

/** Ball weight for a new diameter, keeping the thickness of a ball you already like. */
export function ballForDiameter(refBallG: number, refDiameterIn: number, newDiameterIn: number): number {
  return rescaleBall(refBallG, roundArea(refDiameterIn), roundArea(newDiameterIn));
}

export { coldOk, defaultStageH };

export type Rise = 'room' | 'fridge';
/** The rise path a batch was planned with. Batches from before the option are room rises. */
export const riseOf = (b: Batch): Rise => (b.planned.coldBulk ? 'fridge' : 'room');
export const RISE_LABELS: Record<Rise, string> = { room: 'Room rise', fridge: 'Fridge rise' };
export { gapToNext, DEFAULT_MIXER_MIN, MIXER_MIN_SOURCE } from './engine/stepText';
export type { Cover, StepIngredient, StepTimer } from './engine/stepText';

// ---------- planning ----------
export interface PlanForm {
  formula: Formula;
  balls: BallGroup[];
  eatAt: Date;
  roomF: number;
  /** Average room temperature over the whole rise; blank uses roomF. Sets the yeast only. */
  riseF?: number;
  stageH?: number;
  mixer: 'hand' | 'mixer';
  mixAt?: Date;
  /** eat: work back from eatAt. start: start at startAt, eat when ready. both: fit between the two. */
  timing?: TimingMode;
  startAt?: Date;
  manualYeastPct?: number;
  yeastType?: YeastType;
  /** Flour picked on the form. All-purpose adds King Arthur's less-water note to the first step. */
  flour?: Flour;
  /** Fridge rise: bread 2-3 days; straight pizza doughs, Ooni's 24-72 h. */
  coldBulk?: boolean;
  /** Recording a bake already under way: a first step in the past is allowed. */
  alreadyStarted?: boolean;
}

export function makePlan(form: PlanForm, s: Settings): Plan {
  return planBatch({
    now: new Date(),
    alreadyStarted: form.alreadyStarted,
    formula: form.formula,
    balls: form.balls,
    eatAt: form.eatAt,
    roomF: form.roomF,
    riseF: form.riseF,
    stageH: form.stageH,
    warmUpH: s.warmUpH,
    mixAt: form.mixAt,
    timing: form.timing,
    startAt: form.startAt,
    manualYeastPct: form.manualYeastPct,
    kitchenFactor: s.kitchenFactor,
    mixer: form.mixer,
    preheatMin: s.preheatMin,
    mixerMin: s.mixerMin,
    apFlour: (form.flour ?? s.flour) === 'ap',
    yeastType: form.yeastType ?? s.yeastType,
    coldBulk: form.coldBulk,
    temp: {
      bandLowF: s.bandLowF,
      bandHighF: s.bandHighF,
      frictionF: form.mixer === 'mixer' ? s.frictionMixerF : s.frictionHandF,
      machineMixed: form.mixer === 'mixer',
    },
  });
}

const toRecord = (st: Step): StepRecord => ({ key: st.key, label: st.label, at: st.at.toISOString(), detail: st.detail });

/** Save the plan as a batch. The planned part is frozen from here on. */
export async function lockIn(plan: Plan, mixer: 'hand' | 'mixer', flour?: Flour): Promise<Batch> {
  if (plan.errors.length) throw new Error(plan.errors.join(' '));
  const i = plan.input;
  const bread = productOf(i.formula) === 'bread';
  // Bread is mixed by hand (FWSY p.89); its steps have no mixer version.
  if (bread) mixer = 'hand';
  const balls = i.balls.filter((b) => b.count > 0);
  const n = balls.reduce((k, b) => k + b.count, 0);
  const batch: Batch = {
    id: newId('batch'),
    createdAt: new Date().toISOString(),
    title: `${i.formula.name}, ${n} ${bread ? (n === 1 ? 'loaf' : 'loaves') : 'balls'}`,
    planned: structuredClone({
      formula: i.formula,
      balls,
      eatAt: i.eatAt.toISOString(),
      roomF: i.roomF,
      riseF: i.riseF,
      stageH: plan.stageH,
      warmUpH: i.warmUpH,
      mixer,
      yeast: plan.yeast,
      recipe: plan.recipe,
      water: plan.water,
      steps: plan.schedule.steps.map(toRecord),
      stepVersion: 3 as const,
      preheatMin: i.preheatMin,
      mixerMin: i.mixerMin,
      yeastType: i.yeastType ?? 'instant',
      flour,
      ...(plan.coldBulk ? { coldBulk: true } : {}),
    }),
    actual: {},
    sessions: [],
  };
  await store.saveBatch(batch);
  const s = await store.getSettings();
  const last = bread ? { lastBreadDoughId: i.formula.id, lastLoaves: balls } : { lastDoughId: i.formula.id, lastBalls: balls, mixer };
  await store.saveSettings({ ...s, ...last, roomF: i.roomF, yeastType: i.yeastType ?? s.yeastType, flour: flour ?? s.flour });
  return batch;
}

// ---------- batches and bake sessions ----------
export const listBatches = store.listBatches;
export const getBatch = store.getBatch;
/**
 * Delete a batch and clear its reminders on the server so they stop buzzing. If the phone is offline,
 * the clear is queued and retried with the other reminder updates.
 */
export async function deleteBatch(id: string): Promise<void> {
  const b = await store.getBatch(id);
  await store.deleteBatch(id);
  if (b && (b.actual.reminders || b.actual.reminderSync)) await cancelOrQueue([id]);
}

/** Clear reminders for batches that no longer exist here; anything that fails waits in the retry queue. */
async function cancelOrQueue(ids: string[]): Promise<void> {
  const s = await store.getSettings();
  if (!s.pushDeviceId) return;
  const failed: string[] = [];
  for (const id of ids) await cancelReminders(s.pushDeviceId, id).catch(() => failed.push(id));
  const latest = await store.getSettings();
  const queue = [...new Set([...(latest.pendingCancels ?? []).filter((x) => !ids.includes(x)), ...failed])];
  await store.saveSettings({ ...latest, pendingCancels: queue.length ? queue : undefined });
}

export async function updateActual(batchId: string, actual: Actual): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const next = { ...b, actual: { ...b.actual, ...actual } };
  await store.saveBatch(next);
  return next;
}

// ---------- checklist ----------
/** Where the batch stands: planned steps adjusted for the ones you've checked off. */
export function batchProgress(b: Batch): Progress {
  const p = b.planned;
  const mix = p.steps.find((s) => s.key === 'mix');
  const done = Object.fromEntries(Object.entries(b.actual.done ?? {}).map(([k, v]) => [k, new Date(v)]));
  return replan(
    {
      formula: p.formula,
      stageH: p.stageH,
      warmUpH: p.warmUpH,
      eatAt: new Date(p.eatAt),
      plannedMixAt: new Date(mix?.at ?? p.eatAt),
      coldBulk: p.coldBulk,
      // Older batches keep the steps they were planned with: by-hand text, no preheat.
      mixer: p.stepVersion ? p.mixer : 'hand',
      preheatMin: p.stepVersion ? p.preheatMin : undefined,
      // Version 3 on: full step text with this batch's grams.
      amounts:
        p.stepVersion === 3
          ? { parts: p.recipe.parts, water: p.water, balls: p.balls, mixerMin: p.mixerMin, apFlour: p.flour === 'ap' }
          : undefined,
    },
    done,
  );
}

/** Check a step off (now, or at a time you pick). Mix and ball also fill the "what happened" times. */
export async function checkStep(batchId: string, key: string, at: Date = new Date()): Promise<Batch> {
  // A minute's grace for a phone clock read a moment earlier.
  if (at.getTime() > Date.now() + 60_000) throw new UserError('That time is in the future. Pick a time up to now.');
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const iso = at.toISOString();
  const actual: Actual = { ...b.actual, done: { ...(b.actual.done ?? {}), [key]: iso } };
  if (key === 'mix') actual.mixAt = iso;
  // Bread's "Divide and shape" is its balling time.
  if (key === 'ball' || key === 'shape') actual.ballAt = iso;
  const next = { ...b, actual };
  await store.saveBatch(next);
  return syncReminders(next);
}

export async function uncheckStep(batchId: string, key: string): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const done = { ...(b.actual.done ?? {}) };
  const was = done[key];
  delete done[key];
  const actual: Actual = { ...b.actual, done };
  // Undo the mirrored "what happened" time too, unless it was edited separately since.
  if (key === 'mix' && actual.mixAt === was) delete actual.mixAt;
  if ((key === 'ball' || key === 'shape') && actual.ballAt === was) delete actual.ballAt;
  const next = { ...b, actual };
  await store.saveBatch(next);
  return syncReminders(next);
}

// ---------- step timers ----------
/** Start the timer offered on a step. A countdown also buzzes through reminders when they're on. */
export async function startTimer(batchId: string, key: string, now: Date = new Date()): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const t = batchProgress(b).steps.find((s) => s.key === key)?.timer;
  if (!t) throw new Error('No timer on this step');
  const endAt = t.kind === 'countdown' ? new Date(now.getTime() + t.min * 60_000).toISOString() : undefined;
  const next = { ...b, actual: { ...b.actual, timer: { key, startedAt: now.toISOString(), endAt } } };
  await store.saveBatch(next);
  return syncReminders(next);
}

export async function stopTimer(batchId: string): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const actual: Actual = { ...b.actual };
  delete actual.timer;
  const next = { ...b, actual };
  await store.saveBatch(next);
  return syncReminders(next);
}

/** The running timer as the screen needs it: which step, and ms left (countdown) or elapsed (stopwatch). */
export function timerState(b: Batch, now = Date.now()) {
  const t = b.actual.timer;
  if (!t) return undefined;
  const started = Date.parse(t.startedAt);
  if (t.endAt) {
    const left = Date.parse(t.endAt) - now;
    return { key: t.key, kind: 'countdown' as const, ms: Math.max(0, left), done: left <= 0 };
  }
  return { key: t.key, kind: 'stopwatch' as const, ms: Math.max(0, now - started), done: false };
}

// ---------- room temperature during the bulk rise ----------
/** Ask once the fold is checked off, until answered or skipped. */
export function wantsBulkRoomTemp(b: Batch): boolean {
  // A fridge rise doesn't use the room temperature during the rise, so it isn't asked.
  return !b.planned.coldBulk && !!b.actual.done?.fold && b.actual.bulkRoomF === undefined && !b.actual.bulkRoomSkipped;
}

/** Record the room temperature during the bulk rise (in the app's unit), or null to skip. Stored in °F. */
export async function recordBulkRoomTemp(batchId: string, value: number | null, unit: 'F' | 'C'): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const actual: Actual =
    value === null
      ? { ...b.actual, bulkRoomSkipped: true }
      : { ...b.actual, bulkRoomF: unit === 'C' ? (value * 9) / 5 + 32 : value, bulkRoomSkipped: undefined };
  const next = { ...b, actual };
  await store.saveBatch(next);
  return next;
}

// ---------- reminders ----------
export { pushSupported, pushPermission };

/** Turn phone reminders on for a batch: asks permission, then sends the remaining step times. */
export async function remindersOn(batchId: string): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  // Turning on is the one time we ask for permission, so its errors go to the screen instead of the retry queue.
  const next = { ...b, actual: { ...b.actual, reminders: true, reminderSync: undefined } };
  await sendReminders(next, await deviceId(), true);
  await store.saveBatch(next);
  return next;
}

export async function remindersOff(batchId: string): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const next = { ...b, actual: { ...b.actual, reminders: false } };
  await store.saveBatch(next);
  return pushSync(next);
}

/** Resend remaining steps after a check-off. */
async function syncReminders(b: Batch): Promise<Batch> {
  if (!b.actual.reminders && !b.actual.reminderSync) return b;
  return pushSync(b);
}

/**
 * Bring the server in line with this batch: send its remaining steps (reminders on) or clear them (off).
 * If that fails (no signal), the batch is marked so the app retries later and can warn that reminders
 * may be out of date. The checklist itself never waits on the server.
 */
async function pushSync(b: Batch): Promise<Batch> {
  // What the server needs to match. If another check-off lands while this one is on the network,
  // the saved batch changes under us: send again with the newer copy (a few tries, then the retry queue).
  const sig = (x: Batch) => JSON.stringify([x.actual.reminders, x.actual.done ?? {}, x.actual.timer ?? null]);
  let sent = b;
  for (let attempt = 0; attempt < 3; attempt++) {
    let ok = true;
    try {
      const device = await deviceId();
      if (sent.actual.reminders) await sendReminders(sent, device, false);
      else await cancelReminders(device, sent.id);
    } catch {
      ok = false;
    }
    // Always save onto the latest stored copy, never the one read before the network call,
    // so a slow sync can't undo a check-off made meanwhile.
    const fresh = await store.getBatch(sent.id);
    if (!fresh) return sent; // deleted meanwhile: don't bring it back
    if (!ok || sig(fresh) === sig(sent)) {
      const next = { ...fresh, actual: { ...fresh.actual, reminderSync: ok ? undefined : ('pending' as const) } };
      await store.saveBatch(next);
      return next;
    }
    sent = fresh;
  }
  const fresh = (await store.getBatch(sent.id)) ?? sent;
  const next = { ...fresh, actual: { ...fresh.actual, reminderSync: 'pending' as const } };
  await store.saveBatch(next);
  return next;
}

/** Retry any reminder updates that failed earlier. Call on app start and when the phone reconnects. */
export async function retryReminders(): Promise<number> {
  const queued = (await store.getSettings()).pendingCancels ?? [];
  if (queued.length) await cancelOrQueue(queued);
  const pending = (await store.listBatches()).filter((b) => b.actual.reminderSync === 'pending');
  let fixed = 0;
  for (const b of pending) if (!(await pushSync(b)).actual.reminderSync) fixed++;
  return fixed;
}

/** Longest heads-up allowed, minutes. A sanity cap chosen by Claude, not from a source. */
export const MAX_REMINDER_LEAD_MIN = 60;

/**
 * What a reminder carries: the step's name, the dough's name, and how much notice it gives. Nothing more.
 * (With the phone's push address, a random phone id and the batch id, that is all the server ever holds.)
 * With a heads-up, each reminder is due leadMin before its step; a step still ahead whose heads-up time
 * has already passed is sent right away.
 */
export function reminderItems(b: Batch, leadMin = 0, now = Date.now()) {
  const lead = Math.min(Math.max(0, Math.round(leadMin)), MAX_REMINDER_LEAD_MIN);
  const steps = batchProgress(b).steps;
  const items = steps
    .filter((s) => !s.doneAt && !s.passed && s.at.getTime() > now)
    .map((s) => ({
      at: new Date(Math.max(s.at.getTime() - lead * 60_000, now)).toISOString(),
      title: s.label,
      body: lead ? `${b.planned.formula.name} · in ${lead} min` : b.planned.formula.name,
    }));
  // A running countdown buzzes when it ends: the step's name, the dough's name, no heads-up.
  const t = b.actual.timer;
  if (t?.endAt && Date.parse(t.endAt) > now) {
    const label = steps.find((s) => s.key === t.key)?.label ?? 'Timer';
    items.push({ at: t.endAt, title: `${label}: time’s up`, body: b.planned.formula.name });
    items.sort((a, c) => Date.parse(a.at) - Date.parse(c.at));
  }
  return items;
}

/** Save the heads-up and re-send the times for every batch with reminders on. */
export async function setReminderLead(min: number): Promise<Settings> {
  const s = await store.getSettings();
  const next = { ...s, reminderLeadMin: Math.min(Math.max(0, Math.round(min)), MAX_REMINDER_LEAD_MIN) };
  await store.saveSettings(next);
  for (const b of await store.listBatches()) if (b.actual.reminders) await pushSync(b);
  return next;
}

async function sendReminders(b: Batch, device: string, askPermission: boolean): Promise<void> {
  const items = reminderItems(b, (await store.getSettings()).reminderLeadMin ?? 0);
  if (items.length === 0) return cancelReminders(device, b.id);
  await scheduleReminders({ deviceId: device, batchId: b.id, items, askPermission });
}

async function deviceId(): Promise<string> {
  const s = await store.getSettings();
  if (s.pushDeviceId) return s.pushDeviceId;
  const id = crypto.randomUUID();
  await store.saveSettings({ ...s, pushDeviceId: id });
  return id;
}

export interface SessionForm {
  ovenId: string;
  balls: number;
  survey: Survey;
  note?: string;
  photo?: File;
  at?: Date;
}

export async function addSession(
  batchId: string,
  form: SessionForm,
): Promise<{ batch: Batch; suggestion?: Suggestion; backupDue: boolean }> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  let photoId: string | undefined;
  if (form.photo) {
    photoId = newId('photo');
    await store.savePhoto({ id: photoId, blob: await downscalePhoto(form.photo) });
  }
  const session: BakeSession = {
    id: newId('bake'),
    at: (form.at ?? new Date()).toISOString(),
    ovenId: form.ovenId,
    balls: form.balls,
    survey: form.survey,
    note: form.note,
    photoId,
  };
  const suggestion = topSuggestion(form.survey, { fridge: !!b.planned.coldBulk });
  const batch: Batch = { ...b, sessions: [...b.sessions, session], nextTry: suggestion?.text ?? b.nextTry };
  await store.saveBatch(batch);
  const s = await store.getSettings();
  const bakesSinceBackup = s.bakesSinceBackup + 1;
  await store.saveSettings({ ...s, lastOvenId: form.ovenId, bakesSinceBackup });
  return { batch, suggestion, backupDue: bakesSinceBackup >= BACKUP_EVERY };
}

export async function photoUrl(photoId: string): Promise<string | undefined> {
  const p = await store.getPhoto(photoId);
  return p ? URL.createObjectURL(p.blob) : undefined;
}

/** Early / on time / late counts across every bake. The baker decides whether to act on it. */
export async function timingTally(): Promise<ReadyTally> {
  const batches = await store.listBatches();
  return readyTally(batches.flatMap((b) => b.sessions.map((s) => s.survey)));
}

/** History summary per dough: bakes, average overall score, best batch. */
export async function doughHistory(): Promise<
  { key: string; doughId: string; rise: Rise; name: string; bakes: number; avgOverall?: number; bestBatchId?: string; scores: number[] }[]
> {
  // One row per dough and rise path: the same dough made on the counter or in the fridge is compared apart.
  const batches = (await store.listBatches()).slice().reverse(); // oldest first for trend lines
  const by = new Map<string, { doughId: string; rise: Rise; name: string; scores: number[]; best?: { id: string; score: number }; bakes: number }>();
  for (const b of batches) {
    const rise = riseOf(b);
    const key = `${b.planned.formula.id}:${rise}`;
    const row = by.get(key) ?? { doughId: b.planned.formula.id, rise, name: b.planned.formula.name, scores: [], bakes: 0 };
    for (const s of b.sessions) {
      row.bakes += 1;
      if (s.survey.overall) {
        row.scores.push(s.survey.overall);
        if (!row.best || s.survey.overall >= row.best.score) row.best = { id: b.id, score: s.survey.overall };
      }
    }
    by.set(key, row);
  }
  return [...by.entries()].map(([key, r]) => ({
    key,
    doughId: r.doughId,
    rise: r.rise,
    name: r.name,
    bakes: r.bakes,
    scores: r.scores,
    avgOverall: r.scores.length ? r.scores.reduce((a, c) => a + c, 0) / r.scores.length : undefined,
    bestBatchId: r.best?.id,
  }));
}

export const FLOUR_LABELS: Record<Flour, string> = { '00': '00', ap: 'All-purpose', bread: 'Bread flour', other: 'Other' };

/** Average overall score per flour, for batches that recorded one. The baker draws the conclusion. */
export async function flourHistory(): Promise<{ flour: Flour; label: string; bakes: number; rated: number; avgOverall?: number }[]> {
  const by = new Map<Flour, { bakes: number; scores: number[] }>();
  for (const b of await store.listBatches()) {
    const fl = b.planned.flour;
    if (!fl) continue;
    const row = by.get(fl) ?? { bakes: 0, scores: [] };
    for (const s of b.sessions) {
      row.bakes += 1;
      if (s.survey.overall) row.scores.push(s.survey.overall);
    }
    by.set(fl, row);
  }
  return [...by.entries()]
    .filter(([, r]) => r.bakes > 0)
    .map(([flour, r]) => ({
      flour,
      label: FLOUR_LABELS[flour],
      bakes: r.bakes,
      rated: r.scores.length,
      avgOverall: r.scores.length ? r.scores.reduce((a, c) => a + c, 0) / r.scores.length : undefined,
    }));
}

// ---------- calendar ----------
/** The calendar gets the steps as re-timed by what has been checked off, not the original plan. */
export function batchIcs(b: Batch): string {
  return stepsToIcs(batchProgress(b).steps, b.planned.formula.name, b.id);
}

export function planIcs(plan: Plan): string {
  return stepsToIcs(plan.schedule.steps, plan.input.formula.name, `plan-${plan.input.eatAt.getTime()}`);
}

export function stepCalendarLink(step: Step | StepRecord, title: string): string {
  const st: Step = { ...step, key: step.key as Step['key'], at: new Date(step.at) };
  return googleCalendarLink(st, title);
}

// ---------- backup ----------
export async function exportBackup(): Promise<{ filename: string; json: string }> {
  const file = await store.exportAll();
  const s = await store.getSettings();
  await store.saveSettings({ ...s, lastBackupAt: file.exportedAt, bakesSinceBackup: 0 });
  return { filename: `dough-backup-${file.exportedAt.slice(0, 10)}.json`, json: JSON.stringify(file) };
}

export async function importBackup(json: string): Promise<void> {
  // Batches with reminders on before the restore: clear them on the server too (best effort), since the
  // restore replaces them and restored batches start with reminders off.
  const before = (await store.listBatches()).filter((b) => b.actual.reminders);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not a Dough backup file.');
  }
  await store.importAll(parsed);
  const s = await store.getSettings();
  if (s.pushDeviceId && before.length) await cancelOrQueue(before.map((b) => b.id));
}

// ---------- display helpers ----------
export function fmtGrams(g: number): string {
  if (g < 1) return `${g.toFixed(2)} g`;
  if (g < 10) return `${g.toFixed(1)} g`;
  return `${Math.round(g).toLocaleString()} g`;
}

export function fmtPct(fraction: number): string {
  const p = fraction * 100;
  return `${p < 1 ? p.toFixed(2) : p.toFixed(1).replace(/\.0$/, '')}%`;
}

export function fmtTemp(f: number, unit: 'F' | 'C'): string {
  return unit === 'F' ? `${Math.round(f)}°F` : `${Math.round(((f - 32) * 5) / 9)}°C`;
}

export function fmtTempRange(lowF: number, highF: number, unit: 'F' | 'C'): string {
  return Math.round(lowF) === Math.round(highF)
    ? fmtTemp(lowF, unit)
    : `${fmtTemp(lowF, unit)} to ${fmtTemp(highF, unit)}`;
}

export function fmtWhen(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
