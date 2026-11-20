import { buildBreadSchedule, COLD_BULK_MAX_H, COLD_BULK_MIN_H, COLD_WARM_UP_MIN, foldCount, foldKey, lastFoldMin } from './bread/schedule';
import { buildSchedule, PIZZA_COLD_MAX_H, PIZZA_COLD_MIN_H, PIZZA_COLD_REST_H, pizzaColdOk, type Schedule, type Step } from './schedule';
import type { MixMethod } from './methods';
import type { StepAmounts } from './stepText';
import { productOf, type Formula } from './types';

// Re-plans a locked batch from the steps you've checked off.
// Rule ("protect dinner"): later steps keep the book gaps from what actually happened, the
// fridge hold after balling absorbs the difference, and dinner only moves when nothing can.
// Yeast and recipe never change here: the dough is already mixed.

export interface ProgressInput {
  formula: Formula;
  stageH: number;
  warmUpH: number;
  /** Planned eat time. */
  eatAt: Date;
  /** Planned mix time (from the locked plan). */
  plannedMixAt: Date;
  mixer?: MixMethod;
  /** Preheat minutes stored with the batch; older batches have none and get no preheat step. */
  preheatMin?: number;
  /** Batches locked from stepVersion 3 on: their amounts, for the full step text. */
  amounts?: StepAmounts;
  /** Fridge rise (bread, or a straight pizza dough): stageH is the planned fridge hours. */
  coldBulk?: boolean;
}

export interface ProgressStep extends Step {
  /** Set when you've checked this step off; `at` is then the time you did it. */
  doneAt?: Date;
  /** Not checked off, but a later step is, so it's behind you. */
  passed?: boolean;
  /** Checked off at a time before a step that comes ahead of it in the plan. Allowed; the screen notes it. */
  outOfOrder?: boolean;
}

export interface Progress {
  steps: ProgressStep[];
  /** Eat time after adjusting; equals the planned one unless it had to move. */
  eatAt: Date;
  /** Set when dinner had to move later (not enough time after balling). Bread: set when the bake moved, earlier or later. */
  movedTo?: Date;
  /** First step not yet checked off. */
  nextKey?: string;
  errors: string[];
  /** Things to know that don't stop the bake (e.g. a fridge time past the source's limit). */
  warnings: string[];
}

const H = 3600_000;
const M = 60_000;

export function replan(input: ProgressInput, done: Record<string, Date>): Progress {
  const { formula: f, stageH, warmUpH } = input;
  const p = f.process;

  if (productOf(f) === 'bread') return replanBread(input, done);

  // Best estimate of the mix time from what's been done so far.
  let mixAt = input.plannedMixAt;
  if (done.mix) mixAt = done.mix;
  else if (done.autolyse) mixAt = new Date(done.autolyse.getTime() + p.autolyseMin * M);
  else if (done.poolish) mixAt = new Date(done.poolish.getTime() + stageH * H);

  if (input.coldBulk && pizzaColdOk(f)) return replanPizzaCold(input, done, mixAt);

  const base = { formula: f, stageH, warmUpH, mixAt, ballAt: done.ball, mixer: input.mixer, preheatMin: input.preheatMin, amounts: input.amounts };
  let eatAt = input.eatAt;
  let sch = buildSchedule({ ...base, eatAt });
  let movedTo: Date | undefined;

  const ball = sch.steps.find((s) => s.key === 'ball')!.at;
  const minBallToBakeH = p.minProofH + (p.proofInFridge ? warmUpH : 0);
  const earliest = new Date(ball.getTime() + minBallToBakeH * H);
  if (earliest.getTime() > eatAt.getTime() + 1000) {
    eatAt = movedTo = earliest;
    sch = buildSchedule({ ...base, eatAt });
  }

  return withDone(sch, done, eatAt, movedTo);
}

/**
 * Pizza fridge rise (Ooni): the fridge window (24-72 h from the fold) absorbs a late or early mix or fold,
 * so the tub comes out at the planned time while it is inside the window; outside it, the take-out time
 * moves to the nearest end. The balls then get Ooni's 5 h on the counter, so dinner follows the balling
 * time, earlier or later.
 */
function replanPizzaCold(input: ProgressInput, done: Record<string, Date>, mixAt: Date): Progress {
  const f = input.formula;
  const fridgeIn = done.fold ?? new Date(mixAt.getTime() + f.process.foldAfterMin * M);
  const planned = input.eatAt.getTime() - PIZZA_COLD_REST_H * H;
  // Dinner stays put when the tub went in early (CJ, 2026-11-20); only a too-short fridge time moves it later.
  const t = Math.max(planned, fridgeIn.getTime() + PIZZA_COLD_MIN_H * H);
  const ballAt = done.ball ?? new Date(t);
  const warnings: string[] = [];
  const fridgeH = (ballAt.getTime() - fridgeIn.getTime()) / H;
  if (!done.ball && fridgeH > PIZZA_COLD_MAX_H + 1e-9) {
    warnings.push(
      `The tub would be in the fridge ${Math.round(fridgeH)} hours, past Ooni's ${PIZZA_COLD_MAX_H}. Dinner stays where it is; take the tub out earlier if you can.`,
    );
  }
  const eatAt = new Date(ballAt.getTime() + PIZZA_COLD_REST_H * H);
  // Mix is pinned; the fold may have been late or early, so the schedule's fold follows the checked time.
  const sch = buildSchedule({
    formula: f,
    stageH: input.stageH,
    warmUpH: input.warmUpH,
    eatAt,
    mixAt,
    ballAt,
    mixer: input.mixer,
    preheatMin: input.preheatMin,
    amounts: input.amounts,
    coldBulk: true,
  });
  const moved = Math.abs(eatAt.getTime() - input.eatAt.getTime()) > 1000;
  return withDone(sch, done, eatAt, moved ? eatAt : undefined, warnings);
}

/**
 * Bread fridge option: the fridge window (2-3 days) absorbs a late or early mix or fold, so the tub comes out
 * at the planned time while it has had at least the minimum and at most the maximum fridge time. Outside
 * that, the take-out time (and so the bake) moves to the nearest end of the window. After shaping, as below.
 *
 * Bread: the room proof has no hold (FWSY p.89: "15 minutes can make a difference"), so the loaves go in
 * when the proof is done. Later steps keep the book gaps from what was checked off, and the bake moves,
 * earlier or later, with the actual shaping time.
 */
function replanBread(input: ProgressInput, done: Record<string, Date>): Progress {
  const { formula: f, stageH } = input;
  let mixAt = input.plannedMixAt;
  if (done.mix) mixAt = done.mix;
  else if (done.autolyse) mixAt = new Date(done.autolyse.getTime() + f.process.autolyseMin * M);
  let pullAt: Date | undefined;
  if (input.coldBulk) {
    const last = foldKey(foldCount(f) - 1);
    const fridgeIn = done[last] ?? new Date(mixAt.getTime() + lastFoldMin(f) * M);
    const planned = input.eatAt.getTime() - (f.process.minProofH * H + COLD_WARM_UP_MIN * M);
    const t = Math.min(Math.max(planned, fridgeIn.getTime() + COLD_BULK_MIN_H * H), fridgeIn.getTime() + COLD_BULK_MAX_H * H);
    pullAt = done.pull ?? new Date(t);
  }
  const sch = buildBreadSchedule({
    formula: f,
    eatAt: input.eatAt,
    stageH,
    mixAt,
    coldBulk: input.coldBulk,
    pullAt,
    shapeAt: done.shape,
    bakeAt: done.bake,
    lidOffAt: done.lidOff,
    outAt: done.out,
    amounts: input.amounts,
  });
  const bake = sch.steps.find((s) => s.key === 'bake')!.at;
  const moved = Math.abs(bake.getTime() - input.eatAt.getTime()) > 1000;
  return withDone(sch, done, moved ? bake : input.eatAt, moved ? bake : undefined);
}

function withDone(sch: Schedule, done: Record<string, Date>, eatAt: Date, movedTo: Date | undefined, warnings: string[] = []): Progress {
  // In plan order, a check-off earlier than one ahead of it in the plan is out of order.
  let latest = -Infinity;
  const steps: ProgressStep[] = sch.steps.map((s) => {
    const at = done[s.key];
    if (!at) return s;
    const outOfOrder = at.getTime() < latest;
    latest = Math.max(latest, at.getTime());
    return outOfOrder ? { ...s, at, doneAt: at, outOfOrder } : { ...s, at, doneAt: at };
  });
  steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  // Unchecked steps before the latest checked one are behind you (e.g. you skipped ticking the autolyse).
  const last = steps.reduce((i, s, j) => (s.doneAt ? j : i), -1);
  steps.forEach((s, j) => {
    if (j < last && !s.doneAt) s.passed = true;
  });
  const next = steps.find((s, j) => j > last && !s.doneAt);
  return { steps, eatAt, movedTo, nextKey: next?.key, errors: sch.errors, warnings };
}
