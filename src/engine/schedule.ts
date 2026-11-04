import type { Formula } from './types';

export type StepKey = 'poolish' | 'autolyse' | 'mix' | 'fold' | 'ball' | 'fridge' | 'pull' | 'bake';

export interface Step {
  key: StepKey;
  label: string;
  at: Date;
  detail: string;
}

export interface ScheduleInput {
  formula: Formula;
  eatAt: Date;
  /** Hours of the yeast-carrying stage: bulk (straight) or poolish ripening (poolish). */
  stageH: number;
  /** Hours out of the fridge before stretching (fridge-proofed doughs only). */
  warmUpH: number;
  /** Optional fixed mix time; otherwise the plan works back from eatAt. */
  mixAt?: Date;
  /** Optional actual balling time (the dough was ready early or late); otherwise mix + bulk. */
  ballAt?: Date;
}

export interface Schedule {
  steps: Step[];
  errors: string[];
  /** Hours from balling to baking. */
  ballAgeH: number;
}

const H = 3600_000;
const M = 60_000;
const add = (d: Date, ms: number) => new Date(d.getTime() + ms);

/** Hours from the first step (poolish or autolyse) to mixing. */
export function leadH(f: Formula, stageH: number): number {
  return f.family === 'poolish' ? stageH : f.process.autolyseMin / 60;
}

export interface EatWindow {
  mixAt: Date;
  /** Soonest the balls are ready to bake. */
  earliest: Date;
  /** Latest the book keeps the balls (fridge hold after balling). */
  latest: Date;
}

/**
 * Starting at `startAt` (the first step), when can you eat? The bulk stays at the book time;
 * the slack is a fridge hold after balling, which FWSY allows for up to maxHoldH without
 * changing the yeast (FWSY p.219).
 */
export function eatWindow(f: Formula, startAt: Date, stageH: number, warmUpH: number): EatWindow {
  const p = f.process;
  const bulkH = f.family === 'poolish' ? (p.finalBulkH ?? 0) : stageH;
  const fridge = p.proofInFridge;
  const mixAt = add(startAt, leadH(f, stageH) * H);
  const ball = add(mixAt, bulkH * H);
  return {
    mixAt,
    earliest: add(ball, (p.minProofH + (fridge ? warmUpH : 0)) * H),
    latest: add(ball, (p.maxHoldH + (fridge ? warmUpH : 0)) * H),
  };
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const { formula: f, eatAt, stageH, warmUpH } = input;
  const p = f.process;
  const isPoolish = f.family === 'poolish';
  const bulkH = isPoolish ? (p.finalBulkH ?? 0) : stageH;
  const fridge = p.proofInFridge;
  // Shortest time from balling to the oven.
  const minBallToBakeH = p.minProofH + (fridge ? warmUpH : 0);

  const mix = input.mixAt ?? add(eatAt, -(minBallToBakeH + bulkH) * H);
  const ball = input.ballAt ?? add(mix, bulkH * H);
  const ballAgeH = (eatAt.getTime() - ball.getTime()) / H;

  const errors: string[] = [];
  if (ballAgeH < minBallToBakeH - 1e-9) {
    errors.push(`Not enough time: the balls need at least ${minBallToBakeH} h after balling before you bake.`);
  }
  if (ballAgeH > p.maxHoldH + (fridge ? warmUpH : 0) + 1e-9) {
    errors.push(`Too long: the book keeps balls up to ${p.maxHoldH / 24} days in the fridge.`);
  }

  const steps: Step[] = [];
  if (isPoolish) {
    steps.push({
      key: 'poolish',
      label: 'Mix the poolish',
      at: add(mix, -stageH * H),
      detail: `Flour, 80°F water and yeast, just until incorporated. Leave out overnight (${stageH} h).`,
    });
  } else if (p.autolyseMin > 0) {
    steps.push({
      key: 'autolyse',
      label: 'Autolyse',
      at: add(mix, -p.autolyseMin * M),
      detail: 'Hydrate the yeast in a little of the water. Mix flour with the rest of the water; cover and rest.',
    });
  }
  steps.push({
    key: 'mix',
    label: isPoolish ? 'Mix the final dough' : 'Mix in salt and yeast',
    at: mix,
    detail: `Pincer and fold until fully combined. Target dough temp ${f.ddtF[0]}${f.ddtF[1] !== f.ddtF[0] ? `-${f.ddtF[1]}` : ''}°F.`,
  });
  steps.push({
    key: 'fold',
    label: 'Fold',
    at: add(mix, p.foldAfterMin * M),
    detail: 'One or two folds, then oil the dough and tub lightly.',
  });
  steps.push({ key: 'ball', label: 'Divide and ball', at: ball, detail: 'Medium-tight rounds; do not degas.' });
  // Room-proofed doughs baked much later than their minimum go in the fridge after a short rest
  // (FWSY p.219: rest 30-60 minutes, then refrigerate).
  const heldCold = fridge || ballAgeH > p.minProofH + warmUpH;
  if (heldCold) {
    steps.push({
      key: 'fridge',
      label: 'Into the fridge',
      at: fridge ? ball : add(ball, 60 * M),
      detail: 'Covered, on a lightly floured tray.',
    });
    steps.push({
      key: 'pull',
      label: 'Take balls out of the fridge',
      at: add(eatAt, -warmUpH * H),
      detail: 'Leave covered at room temperature until they stretch easily.',
    });
  }
  steps.push({ key: 'bake', label: 'Bake', at: eatAt, detail: 'Stretch, top and bake.' });

  steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { steps, errors, ballAgeH };
}
