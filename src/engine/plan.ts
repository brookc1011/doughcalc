import { computeRecipe, type Recipe, type YeastType } from './formula';
import type { MixMethod } from './methods';
import { getPreset } from './presets';
import { buildBreadSchedule, COLD_BULK_DEFAULT_H, COLD_BULK_MAX_H, COLD_BULK_MIN_H, mixToBakeH } from './bread/schedule';
import {
  buildSchedule,
  eatWindow,
  OONI_ACTIVE_DRY_G,
  OONI_FLOUR_G,
  OONI_SOURCE,
  OONI_YEAST_G,
  PIZZA_COLD_DEFAULT_H,
  PIZZA_COLD_MAX_H,
  PIZZA_COLD_MIN_H,
  PIZZA_COLD_REST_H,
  pizzaColdOk,
  type Schedule,
} from './schedule';
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
  /**
   * Fridge rise; stageH is then the fridge hours. Bread: bulk in the fridge 2-3 days (book yeast, an
   * assumption). Straight pizza doughs: Ooni's cold-proof method and yeast. Ignored for poolish pizza.
   */
  coldBulk?: boolean;
  /** The current time. When set, a plan whose first step has already passed is refused unless alreadyStarted. */
  now?: Date;
  /** Recording a bake already under way: past steps are allowed. */
  alreadyStarted?: boolean;
}

/** Form fields a plan error can belong to, so the screen can show it by that field. */
export type PlanField = 'balls' | 'time' | 'room' | 'rise' | 'stage' | 'yeast' | 'hydration' | 'salt' | 'kitchen';

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
  /** The errors that belong to one form field (each is also in errors). */
  fieldErrors: Partial<Record<PlanField, string>>;
  /** Set when the first step is already in the past (blocks locking in unless alreadyStarted). */
  pastStart?: Date;
  /** The rise path this plan uses: true when it is the fridge rise. */
  coldBulk: boolean;
}

/** Whether a dough offers the fridge rise: all bread, and straight pizza doughs. */
export function coldOk(f: Formula): boolean {
  return productOf(f) === 'bread' || pizzaColdOk(f);
}

/** Timing modes a dough offers. Bread (room proof, no hold) has no slack for "both". */
export function timingModes(f: Formula, coldBulk = false): TimingMode[] {
  // The pizza fridge rise has a fixed counter rest after the fridge, so no "both" either.
  return productOf(f) === 'bread' || (coldBulk && coldOk(f)) ? ['eat', 'start'] : ['eat', 'start', 'both'];
}

export function defaultStageH(f: Formula, coldBulk = false): number {
  if (coldBulk && productOf(f) === 'bread') return COLD_BULK_DEFAULT_H;
  if (coldBulk && pizzaColdOk(f)) return PIZZA_COLD_DEFAULT_H;
  // A dough with no yeast anchors (a future levain dough) needs its own stageH; 0 means "not set".
  return f.process.stageH ?? getPreset(f.id)?.process.stageH ?? f.anchors[f.anchors.length - 1]?.hours ?? 0;
}

/** Impossible inputs, found before any math: a blank, zero or negative value where the math needs a real one. */
function inputProblems(raw: PlanInput): Partial<Record<PlanField, string>> {
  const out: Partial<Record<PlanField, string>> = {};
  const fin = Number.isFinite;
  const bread = productOf(raw.formula) === 'bread';
  const unit = bread ? 'loaf' : 'ball';
  if (raw.balls.some((b) => !fin(b.count) || b.count < 0 || !Number.isInteger(b.count))) out.balls = `Each ${unit} count must be a whole number, 0 or more.`;
  else if (raw.balls.some((b) => b.count > 0 && (!fin(b.grams) || b.grams <= 0))) out.balls = `Each ${unit} must weigh more than 0 g.`;
  else if (raw.balls.every((b) => b.count <= 0)) out.balls = bread ? 'Add at least one loaf.' : 'Add at least one dough ball.';
  if (!fin(raw.eatAt.getTime()) || (raw.startAt && !fin(raw.startAt.getTime()))) out.time = 'Pick a date and time.';
  if (!fin(raw.roomF)) out.room = 'Enter the room temperature.';
  if (raw.riseF !== undefined && !fin(raw.riseF)) out.rise = 'Enter a number, or leave it blank.';
  if (raw.stageH !== undefined && (!fin(raw.stageH) || raw.stageH <= 0)) out.stage = 'Enter a time above 0 hours.';
  if (raw.manualYeastPct !== undefined && (!fin(raw.manualYeastPct) || raw.manualYeastPct < 0)) out.yeast = 'Enter a yeast amount of 0 or more.';
  if (!fin(raw.formula.hydration) || raw.formula.hydration <= 0) out.hydration = 'Hydration must be above 0%.';
  if (!fin(raw.formula.salt) || raw.formula.salt < 0) out.salt = 'Salt must be 0% or more.';
  if (raw.kitchenFactor !== undefined && (!fin(raw.kitchenFactor) || raw.kitchenFactor <= 0)) {
    out.kitchen = 'The kitchen adjustment in Settings must be above 0.';
  }
  return out;
}

export function planBatch(raw: PlanInput): Plan {
  const fieldErrors = inputProblems(raw);
  const f = raw.formula;
  const timing = raw.startAt ? (raw.timing ?? 'eat') : 'eat';
  const bread = productOf(f) === 'bread';
  const cold = bread && !!raw.coldBulk;
  const pizzaCold = !bread && !!raw.coldBulk && pizzaColdOk(f);
  let stageH = raw.stageH ?? defaultStageH(f, cold || pizzaCold);
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
  } else if (pizzaCold && timing !== 'eat' && raw.startAt) {
    // Pizza fridge rise: start at the autolyse; bake after the fridge time and Ooni's 5 h counter rest.
    const mixAt = new Date(raw.startAt.getTime() + f.process.autolyseMin * 60_000);
    const bakeAt = new Date(mixAt.getTime() + (f.process.foldAfterMin / 60 + stageH + PIZZA_COLD_REST_H) * 3600_000);
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
  // The kitchen adjustment is for a counter rise; the fridge dose is the book's, never scaled (CJ's rule).
  let yeast = chooseYeast(f, yeastStage, { kitchenFactor: book ? undefined : input.kitchenFactor, manualPct: input.manualYeastPct });
  if (book && yeast.basis === 'book') {
    yeast = {
      ...yeast,
      note: `${yeast.note} Assumption: this is the book's dose for a room-temperature overnight rise; no source gives one for 2-3 days in the fridge.`,
    };
  }
  if (pizzaCold && input.manualYeastPct === undefined) {
    // Ooni's own dose for its cold-proof dough, used as is: the rate law is not applied to a fridge rise,
    // and the kitchen adjustment is for the counter, not the fridge.
    yeast = {
      pct: OONI_YEAST_G / OONI_FLOUR_G,
      basis: 'book',
      note: `${OONI_SOURCE}. Ooni's dose for its own dough, used for this one as is.`,
    };
  }
  // Ooni gives its own active dry figure, so it is used rather than converted from instant.
  const activeDryPct = pizzaCold && input.manualYeastPct === undefined ? OONI_ACTIVE_DRY_G / OONI_FLOUR_G : undefined;
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
    activeDryPct,
  });
  const water = waterTemps(f, input.roomF, input.temp);
  const amounts = { parts: recipe.parts, water, balls: input.balls, mixerMin: input.mixerMin, apFlour: input.apFlour };
  const schedule = bread
    ? buildBreadSchedule({ formula: f, eatAt: input.eatAt, stageH, mixAt: input.mixAt, amounts, coldBulk: cold })
    : buildSchedule({
    coldBulk: pizzaCold,
    formula: f,
    eatAt: input.eatAt,
    stageH,
    warmUpH: input.warmUpH,
    mixAt: input.mixAt,
    mixer: input.mixer,
    preheatMin: input.preheatMin,
    amounts,
  });

  // Rise temperatures far from the book can scale the yeast to nothing; don't hand out a recipe with no yeast.
  const yeastG = recipe.totals.find((x) => x.key === 'yeast')?.grams ?? 0;
  if (Object.keys(fieldErrors).length === 0 && yeast.basis !== 'manual' && !(yeastG >= 0.005)) {
    fieldErrors.rise ??= 'At this rise temperature the yeast works out to 0 g. Check the temperature.';
  }
  let pastStart: Date | undefined;
  const first = schedule.steps[0]?.at;
  // A minute's grace so a plan made "now" isn't refused for the seconds spent on the form.
  if (raw.now && !raw.alreadyStarted && first && first.getTime() < raw.now.getTime() - 60_000) {
    pastStart = first;
    fieldErrors.time ??= 'The first step is already in the past.';
  }
  const errors = [...new Set(Object.values(fieldErrors))];
  // Bad inputs make the rest meaningless (NaN times and grams), so only their messages are shown.
  if (errors.length && Object.keys(fieldErrors).some((k) => k !== 'time' || !pastStart)) {
    return { input, stageH, yeast, recipe, water, schedule, window, fitNote, errors, fieldErrors, pastStart, coldBulk: cold || pizzaCold };
  }
  errors.push(...recipe.errors, ...schedule.errors);
  if (pizzaCold && timing === 'both') errors.push('The fridge rise has a set counter rest after the fridge, so pick a start time or a bake time, not both.');
  if (pizzaCold && (stageH < PIZZA_COLD_MIN_H || stageH > PIZZA_COLD_MAX_H)) {
    errors.push(`Fridge time is ${PIZZA_COLD_MIN_H}-${PIZZA_COLD_MAX_H} hours (Ooni).`);
  }
  if (bread && timing === 'both') errors.push('Bread proofs at room temperature with no hold, so pick a start time or a bake time, not both.');
  if (cold && (stageH < COLD_BULK_MIN_H || stageH > COLD_BULK_MAX_H)) {
    errors.push(`Fridge time is 2-3 days: ${COLD_BULK_MIN_H}-${COLD_BULK_MAX_H} hours.`);
  }
  if (yeast.basis === 'manual' && yeast.pct <= 0) errors.push(yeast.warning ?? 'Enter a yeast amount.');

  return { input, stageH, yeast, recipe, water, schedule, window, fitNote, errors, fieldErrors, pastStart, coldBulk: cold || pizzaCold };
}
