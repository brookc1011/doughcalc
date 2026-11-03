import { computeRecipe, type Recipe } from './formula';
import { buildSchedule, type Schedule } from './schedule';
import { waterTemps, type TempSettings, type WaterTemp } from './temperature';
import type { BallGroup, Formula, YeastResult } from './types';
import { chooseYeast } from './yeast';

export interface PlanInput {
  formula: Formula;
  balls: BallGroup[];
  eatAt: Date;
  roomF: number;
  /** Hours of the yeast stage; defaults to the dough's first anchor (e.g. 12 h overnight bulk). */
  stageH?: number;
  warmUpH: number;
  mixAt?: Date;
  manualYeastPct?: number;
  kitchenFactor?: number;
  residuePct?: number;
  temp: TempSettings;
}

export interface Plan {
  input: PlanInput;
  stageH: number;
  yeast: YeastResult;
  recipe: Recipe;
  water: WaterTemp[];
  schedule: Schedule;
  /** Everything that blocks locking in. */
  errors: string[];
}

export function defaultStageH(f: Formula): number {
  return f.anchors[f.anchors.length - 1].hours;
}

export function planBatch(input: PlanInput): Plan {
  const f = input.formula;
  const stageH = input.stageH ?? defaultStageH(f);
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

  return { input, stageH, yeast, recipe, water, schedule, errors };
}
