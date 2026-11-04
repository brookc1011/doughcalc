import { buildSchedule, type Step } from './schedule';
import type { Formula } from './types';

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
  /** Set when dinner had to move later (not enough time after balling). */
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

  // Best estimate of the mix time from what's been done so far.
  let mixAt = input.plannedMixAt;
  if (done.mix) mixAt = done.mix;
  else if (done.autolyse) mixAt = new Date(done.autolyse.getTime() + p.autolyseMin * M);
  else if (done.poolish) mixAt = new Date(done.poolish.getTime() + stageH * H);

  const base = { formula: f, stageH, warmUpH, mixAt, ballAt: done.ball };
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
