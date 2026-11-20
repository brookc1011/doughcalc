import { buildBreadSchedule, COLD_BULK_MAX_H, COLD_BULK_MIN_H, COLD_WARM_UP_MIN, foldCount, foldKey, lastFoldMin } from './bread/schedule';
import { buildSchedule, type Schedule, type Step } from './schedule';
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
  /** Bread fridge option: stageH is the planned fridge hours. */
  coldBulk?: boolean;
}

export interface ProgressStep extends Step {
  /** Set when you've checked this step off; `at` is then the time you did it. */
  doneAt?: Date;
  /** Not checked off, but a later step is, so it's behind you. */
  passed?: boolean;
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

function withDone(sch: Schedule, done: Record<string, Date>, eatAt: Date, movedTo: Date | undefined): Progress {
  const steps: ProgressStep[] = sch.steps.map((s) => (done[s.key] ? { ...s, at: done[s.key], doneAt: done[s.key] } : s));
  steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  // Unchecked steps before the latest checked one are behind you (e.g. you skipped ticking the autolyse).
  const last = steps.reduce((i, s, j) => (s.doneAt ? j : i), -1);
  steps.forEach((s, j) => {
    if (j < last && !s.doneAt) s.passed = true;
  });
  const next = steps.find((s, j) => j > last && !s.doneAt);
  return { steps, eatAt, movedTo, nextKey: next?.key, errors: sch.errors };
}
