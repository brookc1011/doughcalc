// The ONE module the UI imports. Everything the screens need goes through here, so the
// engine and storage can be checked and protected separately from any UI restyle.
import { readyTally, suggestions, topSuggestion, type ReadyTally, type Suggestion, type Survey } from './engine/advice';
import { googleCalendarLink, stepsToIcs } from './engine/calendar';
import { rescaleBall, roundArea } from './engine/geometry';
import { defaultStageH, planBatch, type Plan } from './engine/plan';
import { DEFAULT_EAT_HOUR, defaultBalls, isPresetId, PRESETS, STYLE_TF, STYLE_TF_SOURCE } from './engine/presets';
import type { Step } from './engine/schedule';
import type { BallGroup, DoughDefaults, Formula, Ingredient } from './engine/types';
import { downscalePhoto } from './data/photo';
import * as store from './data/store';
import type { Actual, BakeSession, Batch, Oven, Settings, StepRecord } from './data/types';

export type { Actual, BakeSession, Batch, BallGroup, DoughDefaults, Formula, Ingredient, Oven, Plan, ReadyTally, Settings, Suggestion, Survey };
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
  await store.importAll(JSON.parse(json));
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
