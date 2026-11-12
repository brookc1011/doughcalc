import type { BallGroup, Formula, Ingredient, MixPart } from './types';

export interface RecipeInput {
  formula: Formula;
  /** IDY as a fraction of total flour (from the yeast module, or manual). */
  yeastPct: number;
  /** Either balls (usual) or a fixed flour weight (for reproducing a book table). */
  balls?: BallGroup[];
  flourG?: number;
  /** Overrides formula.residuePct. */
  residuePct?: number;
  /** Yeast on hand. yeastPct is always instant; active dry is converted by ACTIVE_DRY_FACTOR. */
  yeastType?: YeastType;
}

export type YeastType = 'instant' | 'activeDry';

/**
 * Active dry in place of instant: 25% more. Fleischmann's Yeast 101, America's Test Kitchen
 * "Yeast Types", Bob's Red Mill. King Arthur and Red Star call them 1:1; we take the cautious side.
 */
export const ACTIVE_DRY_FACTOR = 1.25;
export const ACTIVE_DRY_SOURCE = "Fleischmann's, America's Test Kitchen, Bob's Red Mill: 25% more active dry than instant";

export interface Recipe {
  usableDoughG: number;
  grossDoughG: number;
  totals: Ingredient[];
  parts: MixPart[];
  errors: string[];
}

const NAMES: Record<Ingredient['key'], string> = {
  flour: 'Flour',
  water: 'Water',
  salt: 'Fine sea salt',
  yeast: 'Instant dry yeast',
  oil: 'Olive oil',
  sugar: 'Sugar',
};

export function usableDough(balls: BallGroup[]): number {
  return balls.reduce((sum, b) => sum + b.count * b.grams, 0);
}

/** Teaspoon text from the source when the amount is within 2% of a printed figure. */
function tspFor(formula: Formula, grams: number): string | undefined {
  const hit = formula.teaspoons.find((t) => Math.abs(grams - t.grams) / t.grams <= 0.02);
  return hit?.text;
}

function ing(formula: Formula, key: Ingredient['key'], grams: number, flourTotal: number, activeDry = false): Ingredient {
  // Book teaspoon figures are for instant yeast, so active dry shows grams and % only.
  if (key === 'yeast' && activeDry) return { key, name: 'Active dry yeast', grams, pct: grams / flourTotal };
  return { key, name: NAMES[key], grams, pct: grams / flourTotal, tsp: tspFor(formula, grams) };
}

export function computeRecipe(input: RecipeInput): Recipe {
  const { formula: f } = input;
  const activeDry = input.yeastType === 'activeDry';
  const yeastPct = input.yeastPct * (activeDry ? ACTIVE_DRY_FACTOR : 1);
  const residue = input.residuePct ?? f.residuePct;
  const errors: string[] = [];
  const ratioSum = 1 + f.hydration + f.salt + yeastPct + f.oil + f.sugar;

  let flour: number;
  let usable: number;
  let gross: number;
  if (input.flourG !== undefined) {
    flour = input.flourG;
    gross = flour * ratioSum;
    usable = gross * (1 - residue);
  } else {
    usable = usableDough(input.balls ?? []);
    // Residue is a fraction of prepared dough left in the bowl: gross = usable / (1 - L).
    gross = usable / (1 - residue);
    flour = gross / ratioSum;
  }

  const water = flour * f.hydration;
  const salt = flour * f.salt;
  const yeast = flour * yeastPct;
  const oil = flour * f.oil;
  const sugar = flour * f.sugar;

  const totals: Ingredient[] = [
    ing(f, 'flour', flour, flour),
    ing(f, 'water', water, flour),
    ing(f, 'salt', salt, flour),
    ing(f, 'yeast', yeast, flour, activeDry),
  ];
  if (oil > 0) totals.push(ing(f, 'oil', oil, flour));
  if (sugar > 0) totals.push(ing(f, 'sugar', sugar, flour));

  let parts: MixPart[];
  if (f.preferment) {
    const pf = flour * f.preferment.flourPct;
    const pw = pf * f.preferment.hydration;
    const finalWater = water - pw;
    if (finalWater < 0) {
      errors.push(
        `The poolish needs ${pw.toFixed(0)} g water but the whole recipe only has ${water.toFixed(0)} g. ` +
          'Lower the poolish share or raise hydration.',
      );
    }
    // All commercial yeast goes into the poolish (FWSY p.226).
    const poolish: Ingredient[] = [ing(f, 'flour', pf, flour), ing(f, 'water', pw, flour), ing(f, 'yeast', yeast, flour, activeDry)];
    const finalDough: Ingredient[] = [
      ing(f, 'flour', flour - pf, flour),
      ing(f, 'water', Math.max(finalWater, 0), flour),
      ing(f, 'salt', salt, flour),
    ];
    if (oil > 0) finalDough.push(ing(f, 'oil', oil, flour));
    if (sugar > 0) finalDough.push(ing(f, 'sugar', sugar, flour));
    parts = [
      { title: 'Poolish (night before)', ingredients: poolish },
      { title: 'Final dough (add all the poolish)', ingredients: finalDough },
    ];
  } else {
    parts = [{ title: 'Dough', ingredients: totals }];
  }

  return { usableDoughG: usable, grossDoughG: gross, totals, parts, errors };
}
