import { computeRecipe, type Recipe, type YeastType } from './formula';
import type { MixMethod } from './methods';
import { getPreset } from './presets';
import { buildBreadSchedule, COLD_BULK_DEFAULT_H, COLD_BULK_MAX_H, COLD_BULK_MIN_H, mixToBakeH } from './bread/schedule';
import { buildSchedule, eatWindow, type Schedule } from './schedule';
import { waterTemps, type TempSettings, type WaterTemp } from './temperature';
import { productOf, type BallGroup, type Formula, type YeastResult } from './types';
import { chooseYeast } from './yeast';

/**
 * How the timeline is pinned:
 * - eat: work back from the eat-at time (the original behavior).
 * - start: start at a time; eat as soon as the dough is ready.
 * - both: start and eat times are fixed; the fridge hold after balling absorbs the gap,
 *   and if the gap is too short the plan steps down to a shorter book bulk (book yeast, never an estimate).
 */
export type TimingMode = 'eat' | 'start' | 'both';

export interface PlanInput {
  formula: Formula;
  balls: BallGroup[];
  eatAt: Date;
  /** Kitchen temperature at mixing. Sets the water temperature, and the yeast when riseF is blank. */
  roomF: number;
  /**
   * Average room temperature over the whole bulk rise (e.g. a house that cools overnight).
   * Sets the yeast only; blank uses roomF.
   */
  riseF?: number;
  /** Hours of the yeast stage; defaults to the dough's book time (e.g. 12 h overnight bulk). */
  stageH?: number;
  warmUpH: number;
  mixAt?: Date;
  timing?: TimingMode;
  /** First step of the plan (poolish or autolyse). Used by the start and both modes. */
  startAt?: Date;
  manualYeastPct?: number;
  kitchenFactor?: number;
  residuePct?: number;
  temp: TempSettings;
  /** Sets the mix and fold instructions. */
  mixer?: MixMethod;
  /** Oven preheat before the first pizza, minutes. Adds a preheat step. */
  preheatMin?: number;
  /** Mixer minutes, baker's setting (default 5, America's Test Kitchen). */
  mixerMin?: number;
  /** All-purpose flour chosen: adds King Arthur's less-water note to the first step. */
  apFlour?: boolean;
  yeastType?: YeastType;
  /** Bread only: bulk in the fridge for 2-3 days; stageH is then the fridge hours. */
  coldBulk?: boolean;
}

export interface Plan {
  /** input.eatAt is the resolved eat time (computed in start mode). */
  input: PlanInput;
  stageH: number;
  yeast: YeastResult;
  recipe: Recipe;
  water: WaterTemp[];
  schedule: Schedule;
  /** Start and both modes: the earliest and latest you can eat from this start. */
  window?: { earliest: Date; latest: Date };
  /** Both mode: set when the plan switched to a shorter book bulk to fit. */
  fitNote?: string;
  /** Everything that blocks locking in. */
  errors: string[];
}

/** Timing modes a dough offers. Bread (room proof, no hold) has no slack for "both". */
export function timingModes(f: Formula): TimingMode[] {
  return productOf(f) === 'bread' ? ['eat', 'start'] : ['eat', 'start', 'both'];
}

export function defaultStageH(f: Formula, coldBulk = false): number {
  if (coldBulk && productOf(f) === 'bread') return COLD_BULK_DEFAULT_H;
  // A dough with no yeast anchors (a future levain dough) needs its own stageH; 0 means "not set".
  return f.process.stageH ?? getPreset(f.id)?.process.stageH ?? f.anchors[f.anchors.length - 1]?.hours ?? 0;
}

export function planBatch(raw: PlanInput): Plan {
  const f = raw.formula;
  const timing = raw.startAt ? (raw.timing ?? 'eat') : 'eat';
  const bread = productOf(f) === 'bread';
  const cold = bread && !!raw.coldBulk;
  let stageH = raw.stageH ?? defaultStageH(f, cold);
  let input: PlanInput = raw;
  let window: Plan['window'];
  let fitNote: string | undefined;
  let fitAnchor: Formula['anchors'][number] | undefined;

  if (bread && timing !== 'eat' && raw.startAt) {
    // Bread: start at the autolyse; the loaves go in as soon as the proof is done (no hold).
    const mixAt = new Date(raw.startAt.getTime() + f.process.autolyseMin * 60_000);
    const bakeAt = new Date(mixAt.getTime() + mixToBakeH(f, stageH, cold) * 3600_000);
    window = { earliest: bakeAt, latest: bakeAt };
    input = { ...raw, mixAt, eatAt: timing === 'start' ? bakeAt : raw.eatAt };
  } else if (timing !== 'eat' && raw.startAt) {
    const start = raw.startAt;
    if (timing === 'both' && raw.stageH === undefined) {
      // Book bulk first. If it doesn't fit, the longest other book anchor that does.
      const fits = (h: number) => eatWindow(f, start, h, raw.warmUpH).earliest.getTime() <= raw.eatAt.getTime();
      if (!fits(stageH)) {
        const shorter = f.anchors
          .map((a) => a.hours)
          .filter((h) => h < stageH)
          .sort((a, b) => b - a)
          .find(fits);
        if (shorter !== undefined) {
          fitAnchor = f.anchors.find((x) => x.hours === shorter)!;
          stageH = shorter;
        }
      }
    }
    const w = eatWindow(f, start, stageH, raw.warmUpH);
    window = { earliest: w.earliest, latest: w.latest };
    input = { ...raw, mixAt: w.mixAt, eatAt: timing === 'start' ? w.earliest : raw.eatAt };
  }

  // Fridge option: the book's dose for its own room schedule, labeled as an assumption (CJ, 2026-11-20).
  // No source gives a dose for 2-3 days cold (docs/sources/cold-proof.md), so the rate law is not applied.
  const book = cold ? f.anchors[f.anchors.length - 1] : undefined;
  const yeastStage = book ? { hours: book.hours, tempF: book.tempF } : { hours: stageH, tempF: input.riseF ?? input.roomF };
  let yeast = chooseYeast(f, yeastStage, { kitchenFactor: input.kitchenFactor, manualPct: input.manualYeastPct });
  if (book && yeast.basis === 'book') {
    yeast = {
      ...yeast,
      note: `${yeast.note} Assumption: this is the book's dose for a room-temperature overnight rise; no source gives one for 2-3 days in the fridge.`,
    };
  }
  if (fitAnchor) {
    // Only claim the book's yeast when that is what was chosen (a cooler rise gives an estimate).
    fitNote =
      yeast.basis === 'book'
        ? `To fit your window, bulk is ${stageH} h with the book's yeast for that schedule (${fitAnchor.source}).`
        : `To fit your window, bulk is ${stageH} h. Yeast is scaled from ${fitAnchor.label} for your rise temperature.`;
  }
  // A typed override is taken as the yeast you're using, so it isn't converted again.
  const recipe = computeRecipe({
    formula: f,
    yeastPct: yeast.pct,
    balls: input.balls,
    residuePct: input.residuePct,
    yeastType: yeast.basis === 'manual' ? 'instant' : input.yeastType,
  });
  const water = waterTemps(f, input.roomF, input.temp);
  const amounts = { parts: recipe.parts, water, balls: input.balls, mixerMin: input.mixerMin, apFlour: input.apFlour };
  const schedule = bread
    ? buildBreadSchedule({ formula: f, eatAt: input.eatAt, stageH, mixAt: input.mixAt, amounts, coldBulk: cold })
    : buildSchedule({
    formula: f,
    eatAt: input.eatAt,
    stageH,
    warmUpH: input.warmUpH,
    mixAt: input.mixAt,
    mixer: input.mixer,
    preheatMin: input.preheatMin,
    amounts,
  });

  const errors = [...recipe.errors, ...schedule.errors];
  if (input.balls.every((b) => b.count <= 0)) errors.push(bread ? 'Add at least one loaf.' : 'Add at least one dough ball.');
  if (bread && timing === 'both') errors.push('Bread proofs at room temperature with no hold, so pick a start time or a bake time, not both.');
  if (cold && (stageH < COLD_BULK_MIN_H || stageH > COLD_BULK_MAX_H)) {
    errors.push(`Fridge time is 2-3 days: ${COLD_BULK_MIN_H}-${COLD_BULK_MAX_H} hours.`);
  }
  if (yeast.basis === 'manual' && yeast.pct <= 0) errors.push(yeast.warning ?? 'Enter a yeast amount.');

  return { input, stageH, yeast, recipe, water, schedule, window, fitNote, errors };
}
