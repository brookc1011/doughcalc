import { mixSteps, preheatDetail, type MixMethod } from './methods';
import { fullStepText, PIZZA_COLD_REST_H, STEP_COVER, stepTimer, type Cover, type StepAmounts, type StepIngredient, type StepTimer } from './stepText';
import type { Formula } from './types';

export type StepKey =
  | 'poolish' | 'autolyse' | 'mix' | 'fold' | 'ball' | 'fridge' | 'pull' | 'preheat' | 'bake'
  // Bread steps (engine/bread/schedule.ts).
  | 'fold2' | 'fold3' | 'fold4' | 'shape' | 'proofCheck' | 'lidOff' | 'out' | 'slice';

export interface Step {
  key: StepKey;
  label: string;
  at: Date;
  detail: string;
  /** Lid on or off during this step. Missing: doesn't apply (oven steps). */
  cover?: Cover;
  /** Timer offered on this step, with its source. */
  timer?: StepTimer;
  /** What goes in at this step (stepVersion 3 batches and new plans). */
  ingredients?: StepIngredient[];
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
  /** How the dough is mixed; sets the mix and fold instructions. Defaults to by hand. */
  mixer?: MixMethod;
  /** Minutes of oven preheat before the first pizza goes in. Omitted: no preheat step (older batches). */
  preheatMin?: number;
  /** This batch's amounts. Set: full step text with grams (stepVersion 3). Omitted: the short text. */
  amounts?: StepAmounts;
  /**
   * Fridge rise (straight pizza doughs): after the fold the tub goes into the fridge for stageH hours,
   * then the dough is divided and balled and the balls rest on the counter before baking (Ooni).
   */
  coldBulk?: boolean;
}

export interface Schedule {
  steps: Step[];
  errors: string[];
  /** Hours from balling to baking. */
  ballAgeH: number;
}

// Fridge rise for pizza: Ooni, "Cold-proof pizza dough" (ooni.com/blogs/recipes/cold-prove-pizza-dough,
// read 2026-11-20; docs/sources/cold-proof.md). Mixed and into the fridge as one mass, 24-72 h; out when
// roughly doubled, divided and balled, then 5 h on the counter to come to room temperature and double.
export const PIZZA_COLD_MIN_H = 24;
export const PIZZA_COLD_MAX_H = 72;
/** Default fridge time: 2 days, the start of the 2-3 days CJ asked for (2026-11-20). An editable setting. */
export const PIZZA_COLD_DEFAULT_H = 48;
export { PIZZA_COLD_REST_H };
/** Ooni's yeast: 1.4 g instant yeast (or 1.6 g active dry) for 607 g "00" flour. */
export const OONI_YEAST_G = 1.4;
export const OONI_ACTIVE_DRY_G = 1.6;
export const OONI_FLOUR_G = 607;
export const OONI_SOURCE = 'Ooni cold-proof pizza dough: 1.4 g instant yeast (or 1.6 g active dry) to 607 g flour, 24-72 h in the fridge';

/** Whether a dough can take the pizza fridge rise: straight pizza doughs (Ooni's is a straight dough). */
export function pizzaColdOk(f: Formula): boolean {
  return f.family === 'straight';
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
  if (input.coldBulk && pizzaColdOk(input.formula)) return buildColdSchedule(input);
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

  const ddt = `${f.ddtF[0]}${f.ddtF[1] !== f.ddtF[0] ? `-${f.ddtF[1]}` : ''}°F`;
  const full = input.amounts && fullStepText(input.amounts, input.mixer ?? 'hand', ddt, stageH);
  const steps: Step[] = [];
  if (isPoolish) {
    steps.push({
      key: 'poolish',
      label: 'Mix the poolish',
      at: add(mix, -stageH * H),
      detail: full?.poolish ?? `Flour, 80°F water and yeast, just until incorporated. Leave out overnight (${stageH} h).`,
    });
  } else if (p.autolyseMin > 0) {
    steps.push({
      key: 'autolyse',
      label: 'Autolyse',
      at: add(mix, -p.autolyseMin * M),
      detail: full?.autolyse ?? 'Hydrate the yeast in a little of the water. Mix flour with the rest of the water; cover and rest.',
    });
  }
  const how = mixSteps(input.mixer ?? 'hand', isPoolish);
  steps.push({
    key: 'mix',
    label: isPoolish ? 'Mix the final dough' : 'Mix in salt and yeast',
    at: mix,
    detail: full?.mix ?? `${how.mix} Target dough temp ${ddt}.`,
  });
  steps.push({
    key: 'fold',
    label: 'Fold',
    at: add(mix, p.foldAfterMin * M),
    detail: full?.fold ?? how.fold,
  });
  const ballText = full?.ball ?? 'Medium-tight rounds; do not degas.';
  const fridgeText = full?.fridge ?? 'Covered, on a lightly floured tray.';
  // Room-proofed doughs baked much later than their minimum go in the fridge after a short rest
  // (FWSY p.219: rest 30-60 minutes, then refrigerate).
  const heldCold = fridge || ballAgeH > p.minProofH + warmUpH;
  if (fridge) {
    // Fridge-proofed doughs go in the fridge as soon as they're balled: one step, not two at the same minute.
    steps.push({
      key: 'ball',
      label: 'Divide, ball and into the fridge',
      at: ball,
      detail: `${ballText.replace(/ No cover needed while you shape\.$/, '')} ${fridgeText}`,
    });
  } else {
    steps.push({ key: 'ball', label: 'Divide and ball', at: ball, detail: ballText });
  }
  if (heldCold) {
    if (!fridge) {
      steps.push({ key: 'fridge', label: 'Into the fridge', at: add(ball, 60 * M), detail: fridgeText });
    }
    steps.push({
      key: 'pull',
      label: 'Take balls out of the fridge',
      at: add(eatAt, -warmUpH * H),
      detail: full?.pull(warmUpH) ?? 'Leave covered at room temperature until they stretch easily.',
    });
  }
  if (input.preheatMin && input.preheatMin > 0) {
    steps.push({
      key: 'preheat',
      label: 'Preheat the oven',
      at: add(eatAt, -input.preheatMin * M),
      detail: preheatDetail(input.preheatMin),
    });
  }
  steps.push({ key: 'bake', label: 'Bake', at: eatAt, detail: 'First pizza in. Stretch, top and bake.' });

  const method = input.mixer ?? 'hand';
  for (const st of steps) {
    st.cover = STEP_COVER[st.key];
    st.timer = stepTimer(st.key, method, input.amounts?.mixerMin);
    st.ingredients = full?.ingredients[st.key as keyof typeof full.ingredients];
  }
  steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { steps, errors, ballAgeH };
}

/**
 * Pizza fridge rise (Ooni): autolyse and mix as the dough's own method, the fold, then the tub into the
 * fridge for stageH hours (from the fold), out to divide and ball, 5 h on the counter, bake.
 */
function buildColdSchedule(input: ScheduleInput): Schedule {
  const { formula: f, eatAt, stageH } = input;
  const p = f.process;
  const mix = input.mixAt ?? add(eatAt, -(PIZZA_COLD_REST_H * H + stageH * H + p.foldAfterMin * M));
  const fridgeIn = add(mix, p.foldAfterMin * M);
  const ball = input.ballAt ?? add(fridgeIn, stageH * H);
  const ballAgeH = (eatAt.getTime() - ball.getTime()) / H;
  const errors: string[] = [];
  if (ballAgeH < PIZZA_COLD_REST_H - 1e-9) {
    errors.push(`Not enough time: the balls need ${PIZZA_COLD_REST_H} h on the counter after the fridge (Ooni).`);
  }
  const ddt = `${f.ddtF[0]}${f.ddtF[1] !== f.ddtF[0] ? `-${f.ddtF[1]}` : ''}°F`;
  const method = input.mixer ?? 'hand';
  const full = input.amounts && fullStepText(input.amounts, method, ddt, stageH);
  const how = mixSteps(method, false);
  const steps: Step[] = [];
  if (p.autolyseMin > 0) {
    steps.push({
      key: 'autolyse',
      label: 'Autolyse',
      at: add(mix, -p.autolyseMin * M),
      detail: full?.autolyse ?? 'Hydrate the yeast in a little of the water. Mix flour with the rest of the water; cover and rest.',
    });
  }
  steps.push({ key: 'mix', label: 'Mix in salt and yeast', at: mix, detail: full?.mix ?? `${how.mix} Target dough temp ${ddt}.` });
  steps.push({
    key: 'fold',
    label: 'Fold, then the tub into the fridge',
    at: fridgeIn,
    detail: full?.foldCold ?? `${how.fold} Then the tub, lid on, straight into the fridge (Ooni).`,
  });
  steps.push({
    key: 'ball',
    label: 'Out of the fridge: divide and ball',
    at: ball,
    detail:
      full?.ballCold ??
      `Take the tub out (Ooni: when the dough has roughly doubled). Divide and shape medium-tight rounds. Cover and leave on the counter about ${PIZZA_COLD_REST_H} h, until they double (Ooni).`,
  });
  if (input.preheatMin && input.preheatMin > 0) {
    steps.push({ key: 'preheat', label: 'Preheat the oven', at: add(eatAt, -input.preheatMin * M), detail: preheatDetail(input.preheatMin) });
  }
  steps.push({ key: 'bake', label: 'Bake', at: eatAt, detail: 'First pizza in. Stretch, top and bake.' });
  for (const st of steps) {
    st.cover = STEP_COVER[st.key];
    st.timer = stepTimer(st.key, method, input.amounts?.mixerMin);
    st.ingredients = full?.ingredients[st.key as keyof typeof full.ingredients];
  }
  steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { steps, errors, ballAgeH };
}
