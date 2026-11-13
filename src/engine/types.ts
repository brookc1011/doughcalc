// Core types for the dough engine. Everything in src/engine is pure: no UI, no storage.
// All baker's percentages are decimal fractions of TOTAL flour (0.70 = 70%).

export type DoughFamily = 'straight' | 'poolish';

/** What the dough becomes. Missing on a formula means pizza (every dough saved before bread). */
export type Product = 'pizza' | 'bread';

export function productOf(f: { product?: Product }): Product {
  return f.product ?? 'pizza';
}

/** A proven schedule point: the yeast dose a source uses for a given ferment. */
export interface YeastAnchor {
  label: string;
  /** Hours of the stage the yeast has to carry (bulk for straight doughs, poolish ripening for poolish). */
  hours: number;
  /** Temperature the stage runs at, °F. */
  tempF: number;
  /** IDY as a fraction of total flour. */
  yeastPct: number;
  /** Where the figure comes from. */
  source: string;
  /** True when tempF is our assumption rather than stated by the source. */
  tempAssumed: boolean;
}

export interface Preferment {
  type: 'poolish';
  /** Fraction of total flour that goes into the poolish. */
  flourPct: number;
  /** Water / flour inside the poolish. */
  hydration: number;
}

export interface TeaspoonNote {
  grams: number;
  text: string;
  source: string;
}

export interface Formula {
  id: string;
  name: string;
  /** Missing: pizza. Locked batches copy the whole formula, so old batches read as pizza with no migration. */
  product?: Product;
  family: DoughFamily;
  source: string;
  hydration: number;
  salt: number;
  oil: number;
  sugar: number;
  /** Default yeast stage anchors. The engine picks the nearest one. */
  anchors: YeastAnchor[];
  preferment?: Preferment;
  /** Default ball weight (g) and the diameter (in) it is meant for. Bread: loaf dough weight; diameter unused (0). */
  ballG: number;
  ballDiameterIn: number;
  /** Bowl/tool loss as a fraction of usable dough. 0 for presets that already carry surplus. */
  residuePct: number;
  /** Book water temperature range, °F, for each mix. */
  waterF: { label: string; lowF: number; highF: number }[];
  /** Desired dough temperature at end of mix, °F (midpoint used for calculations). */
  ddtF: [number, number];
  /** Process times, hours. */
  process: {
    autolyseMin: number;
    foldAfterMin: number;
    /** The book's bulk (or poolish ripening) time for this dough, hours. Missing: the longest anchor. */
    stageH?: number;
    /** Poolish doughs only: bulk time of the final dough after the poolish is mixed in. */
    finalBulkH?: number;
    /** Minimum time from balling to baking. */
    minProofH: number;
    /** Whether the balls proof in the fridge. */
    proofInFridge: boolean;
    /** Longest the balls keep after balling (fridge), hours. */
    maxHoldH: number;
    /** Bread only: how many folds the recipe calls for. */
    folds?: number;
  };
  /** Known gram-to-teaspoon equivalents printed in the source. */
  teaspoons: TeaspoonNote[];
  /** Free text the baker keeps with this dough. */
  notes?: string;
  /** What the Plan screen starts with when this dough is picked. */
  defaults?: DoughDefaults;
}

export interface DoughDefaults {
  balls: BallGroup[];
  /** Hour of day (0-23) for the default "eat at" time (bread: when the loaves go in). */
  eatHour?: number;
  /** Minutes past eatHour (bread: the book's sample bake is 9:15 a.m.). Missing: on the hour. */
  eatMinute?: number;
  mixer?: 'hand' | 'mixer';
}

export interface BallGroup {
  count: number;
  grams: number;
  /** Optional label, e.g. "pizza", "focaccia" or "loaf". Bread uses the same shape: count loaves of grams dough. */
  label?: string;
}

export interface Ingredient {
  key: 'flour' | 'water' | 'salt' | 'yeast' | 'oil' | 'sugar';
  name: string;
  grams: number;
  pct: number;
  /** Teaspoon text when the source prints one for this exact amount. */
  tsp?: string;
}

export interface MixPart {
  title: string;
  ingredients: Ingredient[];
}

export type YeastBasis = 'book' | 'estimate' | 'manual';

export interface YeastResult {
  pct: number;
  basis: YeastBasis;
  anchor?: YeastAnchor;
  /** Plain-language explanation shown next to the number. */
  note: string;
  warning?: string;
}
