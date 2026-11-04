// The ONE module the UI imports. Everything the screens need goes through here, so the
// engine and storage can be checked and protected separately from any UI restyle.
import { readyTally, suggestions, topSuggestion, type ReadyTally, type Suggestion, type Survey } from './engine/advice';
import { googleCalendarLink, stepsToIcs } from './engine/calendar';
import { rescaleBall, roundArea } from './engine/geometry';
import { defaultStageH, planBatch, type Plan, type TimingMode } from './engine/plan';
import { DEFAULT_EAT_HOUR, defaultBalls, isPresetId, PRESETS, STYLE_TF, STYLE_TF_SOURCE } from './engine/presets';
import type { Step } from './engine/schedule';
import type { BallGroup, DoughDefaults, Formula, Ingredient } from './engine/types';
import { replan, type Progress, type ProgressStep } from './engine/progress';
import { downscalePhoto } from './data/photo';
import { cancelReminders, pushPermission, pushSupported, scheduleReminders } from './data/push';
import * as store from './data/store';
import type { Actual, BakeSession, Batch, Oven, Settings, StepRecord } from './data/types';

export type { Actual, BakeSession, Batch, BallGroup, DoughDefaults, Formula, Ingredient, Oven, Plan, Progress, ProgressStep, ReadyTally, Settings, Suggestion, Survey, TimingMode };
export { PRESETS, STYLE_TF, STYLE_TF_SOURCE, suggestions, topSuggestion };

/** Backup reminder cadence, in bake sessions. */
export const BACKUP_EVERY = 5;

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---------- settings ----------
export const getSettings = store.getSettings;
export const saveSettings = store.saveSettings;

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

export async function doughLibrary(): Promise<DoughEntry[]> {
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

/** Doughs shown in the Plan picker. */
export async function allDoughs(): Promise<Formula[]> {
  return (await doughLibrary()).filter((e) => !e.hidden).map((e) => e.formula);
}

export async function findDough(id: string): Promise<Formula> {
  const lib = await doughLibrary();
  return lib.find((e) => e.formula.id === id)?.formula ?? lib.find((e) => !e.hidden)?.formula ?? PRESETS[0];
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
  const lib = await doughLibrary();
  const visible = lib.filter((e) => !e.hidden);
  if (visible.length <= 1 && visible[0]?.formula.id === id) throw new Error('Keep at least one dough.');
  const s = await store.getSettings();
  const nextLast = s.lastDoughId === id ? visible.find((e) => e.formula.id !== id)!.formula.id : s.lastDoughId;
  if (isPresetId(id)) {
    await store.saveSettings({ ...s, hiddenDoughIds: [...new Set([...s.hiddenDoughIds, id])], lastDoughId: nextLast });
  } else {
    await store.deleteDough(id);
    await store.saveSettings({ ...s, lastDoughId: nextLast });
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

export { defaultStageH };

// ---------- planning ----------
export interface PlanForm {
  formula: Formula;
  balls: BallGroup[];
  eatAt: Date;
  roomF: number;
  stageH?: number;
  mixer: 'hand' | 'mixer';
  mixAt?: Date;
  /** eat: work back from eatAt. start: start at startAt, eat when ready. both: fit between the two. */
  timing?: TimingMode;
  startAt?: Date;
  manualYeastPct?: number;
}

export function makePlan(form: PlanForm, s: Settings): Plan {
  return planBatch({
    formula: form.formula,
    balls: form.balls,
    eatAt: form.eatAt,
    roomF: form.roomF,
    stageH: form.stageH,
    warmUpH: s.warmUpH,
    mixAt: form.mixAt,
    timing: form.timing,
    startAt: form.startAt,
    manualYeastPct: form.manualYeastPct,
    kitchenFactor: s.kitchenFactor,
    temp: {
      bandLowF: s.bandLowF,
      bandHighF: s.bandHighF,
      frictionF: form.mixer === 'mixer' ? s.frictionMixerF : s.frictionHandF,
    },
  });
}

const toRecord = (st: Step): StepRecord => ({ key: st.key, label: st.label, at: st.at.toISOString(), detail: st.detail });

/** Save the plan as a batch. The planned part is frozen from here on. */
export async function lockIn(plan: Plan, mixer: 'hand' | 'mixer'): Promise<Batch> {
  if (plan.errors.length) throw new Error(plan.errors.join(' '));
  const i = plan.input;
  const balls = i.balls.filter((b) => b.count > 0);
  const batch: Batch = {
    id: newId('batch'),
    createdAt: new Date().toISOString(),
    title: `${i.formula.name}, ${balls.reduce((n, b) => n + b.count, 0)} balls`,
    planned: structuredClone({
      formula: i.formula,
      balls,
      eatAt: i.eatAt.toISOString(),
      roomF: i.roomF,
      stageH: plan.stageH,
      warmUpH: i.warmUpH,
      mixer,
      yeast: plan.yeast,
      recipe: plan.recipe,
      water: plan.water,
      steps: plan.schedule.steps.map(toRecord),
    }),
    actual: {},
    sessions: [],
  };
  await store.saveBatch(batch);
  const s = await store.getSettings();
  await store.saveSettings({ ...s, lastDoughId: i.formula.id, lastBalls: balls, roomF: i.roomF, mixer });
  return batch;
}

// ---------- batches and bake sessions ----------
export const listBatches = store.listBatches;
export const getBatch = store.getBatch;
export const deleteBatch = store.deleteBatch;

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
    },
    done,
  );
}

/** Check a step off (now, or at a time you pick). Mix and ball also fill the "what happened" times. */
export async function checkStep(batchId: string, key: string, at: Date = new Date()): Promise<Batch> {
  const b = await store.getBatch(batchId);
  if (!b) throw new Error('Batch not found');
  const iso = at.toISOString();
  const actual: Actual = { ...b.actual, done: { ...(b.actual.done ?? {}), [key]: iso } };
  if (key === 'mix') actual.mixAt = iso;
  if (key === 'ball') actual.ballAt = iso;
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
  if (key === 'ball' && actual.ballAt === was) delete actual.ballAt;
  const next = { ...b, actual };
  await store.saveBatch(next);
  return syncReminders(next);
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
  return pushSync({ ...b, actual: { ...b.actual, reminders: false } });
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
  let ok = true;
  try {
    const device = await deviceId();
    if (b.actual.reminders) await sendReminders(b, device, false);
    else await cancelReminders(device, b.id);
  } catch {
    ok = false;
  }
  const actual: Actual = { ...b.actual, reminderSync: ok ? undefined : 'pending' };
  const next = { ...b, actual };
  await store.saveBatch(next);
  return next;
}

/** Retry any reminder updates that failed earlier. Call on app start and when the phone reconnects. */
export async function retryReminders(): Promise<number> {
  const pending = (await store.listBatches()).filter((b) => b.actual.reminderSync === 'pending');
  let fixed = 0;
  for (const b of pending) if (!(await pushSync(b)).actual.reminderSync) fixed++;
  return fixed;
}

/**
 * What a reminder carries: the step's name and the dough's name, nothing more.
 * (With the phone's push address, a random phone id and the batch id, that is all the server ever holds.)
 */
export function reminderItems(b: Batch, now = Date.now()) {
  return batchProgress(b)
    .steps.filter((s) => !s.doneAt && !s.passed && s.at.getTime() > now)
    .map((s) => ({ at: s.at.toISOString(), title: s.label, body: b.planned.formula.name }));
}

async function sendReminders(b: Batch, device: string, askPermission: boolean): Promise<void> {
  const items = reminderItems(b);
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
  const suggestion = topSuggestion(form.survey);
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
  { doughId: string; name: string; bakes: number; avgOverall?: number; bestBatchId?: string; scores: number[] }[]
> {
  const batches = (await store.listBatches()).slice().reverse(); // oldest first for trend lines
  const by = new Map<string, { name: string; scores: number[]; best?: { id: string; score: number }; bakes: number }>();
  for (const b of batches) {
    const key = b.planned.formula.id;
    const row = by.get(key) ?? { name: b.planned.formula.name, scores: [], bakes: 0 };
    for (const s of b.sessions) {
      row.bakes += 1;
      if (s.survey.overall) {
        row.scores.push(s.survey.overall);
        if (!row.best || s.survey.overall >= row.best.score) row.best = { id: b.id, score: s.survey.overall };
      }
    }
    by.set(key, row);
  }
  return [...by.entries()].map(([doughId, r]) => ({
    doughId,
    name: r.name,
    bakes: r.bakes,
    scores: r.scores,
    avgOverall: r.scores.length ? r.scores.reduce((a, c) => a + c, 0) / r.scores.length : undefined,
    bestBatchId: r.best?.id,
  }));
}

// ---------- calendar ----------
function stepsOf(b: Batch): Step[] {
  return b.planned.steps.map((s) => ({ ...s, key: s.key as Step['key'], at: new Date(s.at) }));
}

export function batchIcs(b: Batch): string {
  return stepsToIcs(stepsOf(b), b.planned.formula.name, b.id);
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
  await store.importAll(JSON.parse(json));
  const s = await store.getSettings();
  if (s.pushDeviceId) {
    for (const b of before) await cancelReminders(s.pushDeviceId, b.id).catch(() => undefined);
  }
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
