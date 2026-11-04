import { computeRecipe, type Recipe } from './formula';
import { getPreset } from './presets';
import { buildSchedule, eatWindow, type Schedule } from './schedule';
import { waterTemps, type TempSettings, type WaterTemp } from './temperature';
import type { BallGroup, Formula, YeastResult } from './types';
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
  roomF: number;
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

export function defaultStageH(f: Formula): number {
  return f.process.stageH ?? getPreset(f.id)?.process.stageH ?? f.anchors[f.anchors.length - 1].hours;
}

export function planBatch(raw: PlanInput): Plan {
  const f = raw.formula;
  const timing = raw.startAt ? (raw.timing ?? 'eat') : 'eat';
  let stageH = raw.stageH ?? defaultStageH(f);
  let input: PlanInput = raw;
  let window: Plan['window'];
  let fitNote: string | undefined;

  if (timing !== 'eat' && raw.startAt) {
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
          const a = f.anchors.find((x) => x.hours === shorter)!;
          fitNote = `To fit your window, bulk is ${shorter} h with the book's yeast for that schedule (${a.source}).`;
          stageH = shorter;
        }
      }
    }
    const w = eatWindow(f, start, stageH, raw.warmUpH);
    window = { earliest: w.earliest, latest: w.latest };
    input = { ...raw, mixAt: w.mixAt, eatAt: timing === 'start' ? w.earliest : raw.eatAt };
  }

  const yeast = chooseYeast(
    f,
    { hours: stageH, tempF: input.roomF },
    { kitchenFactor: input.kitchenFactor, manualPct: input.manualYeastPct },
  );
  const recipe = computeRecipe({ formula: f, yeastPct: yeast.pct, balls: input.balls, residuePct: input.residuePct });
  const water = waterTemps(f, input.roomF, input.temp);
  const schedule = buildSchedule({ formula: f, eatAt: input.eatAt, stageH, warmUpH: input.warmUpH, mixAt: input.mixAt });

  const errors = [...recipe.errors, ...schedule.errors];
  if (input.balls.every((b) => b.count <= 0)) errors.push('Add at least one dough ball.');
  if (yeast.basis === 'manual' && yeast.pct <= 0) errors.push(yeast.warning ?? 'Enter a yeast amount.');

  return { input, stageH, yeast, recipe, water, schedule, window, fitNote, errors };
}
