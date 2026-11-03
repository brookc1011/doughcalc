import type { Formula, YeastAnchor, YeastResult } from './types';

// Rate law published by PizzaOvenCalc ("Fermentation Time by Temperature Chart"):
// fermentation speed doubles for every +17°F, relative to 75°F. Used ONLY to scale
// from a proven recipe dose, never as an absolute yeast prediction.
export const RATE_SOURCE = 'PizzaOvenCalc rate law, 2^((T-75)/17)';

export function rate(tempF: number): number {
  return Math.pow(2, (tempF - 75) / 17);
}

export function equivalentHours(hours: number, tempF: number): number {
  return hours * rate(tempF);
}

/** Below this the stage is a cold (fridge) bulk, which the rate law is not validated for. */
export const COLD_LIMIT_F = 50;

/** A schedule counts as the book's own if it is within these tolerances of an anchor. */
const BOOK_HOURS_TOL = 1;
const BOOK_TEMP_TOL_F = 3;

export interface YeastStage {
  /** Hours of the stage the yeast carries: bulk (straight) or poolish ripening (poolish). */
  hours: number;
  tempF: number;
}

export interface YeastOptions {
  /** Baker-set multiplier for a kitchen that runs fast (<1) or slow (>1). Never auto-learned. */
  kitchenFactor?: number;
  /** Fraction of flour; bypasses the model entirely. */
  manualPct?: number;
}

function kitchenNote(k: number): string {
  if (k === 1) return '';
  return ` Includes your kitchen adjustment (x${k.toFixed(2)}).`;
}

export function chooseYeast(formula: Formula, stage: YeastStage, opts: YeastOptions = {}): YeastResult {
  const k = opts.kitchenFactor ?? 1;

  if (opts.manualPct !== undefined) {
    return { pct: opts.manualPct, basis: 'manual', note: 'Your own yeast amount.' };
  }

  if (stage.tempF < COLD_LIMIT_F) {
    return {
      pct: 0,
      basis: 'manual',
      note: 'Cold bulk fermentation is not modeled yet.',
      warning: 'Enter the yeast amount yourself for a fridge bulk.',
    };
  }

  const book = formula.anchors.find(
    (a) => Math.abs(stage.hours - a.hours) <= BOOK_HOURS_TOL && Math.abs(stage.tempF - a.tempF) <= BOOK_TEMP_TOL_F,
  );
  if (book) {
    return {
      pct: book.yeastPct * k,
      basis: 'book',
      anchor: book,
      note: `${book.source}.${kitchenNote(k)}`,
    };
  }

  // Scale from the anchor closest in equivalent fermentation, measured on a log scale.
  const eq = equivalentHours(stage.hours, stage.tempF);
  let best: YeastAnchor = formula.anchors[0];
  let bestDist = Infinity;
  for (const a of formula.anchors) {
    const d = Math.abs(Math.log(eq / equivalentHours(a.hours, a.tempF)));
    if (d < bestDist) {
      best = a;
      bestDist = d;
    }
  }
  const ratio = equivalentHours(best.hours, best.tempF) / eq;
  const result: YeastResult = {
    pct: best.yeastPct * ratio * k,
    basis: 'estimate',
    anchor: best,
    note: `Estimate: scaled from ${best.label} using the ${RATE_SOURCE}.${kitchenNote(k)}`,
  };
  if (ratio > 3 || ratio < 1 / 3) {
    result.warning = 'This schedule is far from any tested recipe. Treat the yeast amount as a rough guess.';
  }
  return result;
}
