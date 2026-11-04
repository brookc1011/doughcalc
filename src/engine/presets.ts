import type { BallGroup, Formula, YeastAnchor } from './types';

// Source key used throughout: FWSY = Ken Forkish, "Flour Water Salt Yeast", page numbers from CJ's copy.

// Forkish does not state a room temperature for the straight-dough bulk; 70°F is our
// assumption (flagged with tempAssumed) so the estimate math has a starting point.
const STRAIGHT_ANCHORS: YeastAnchor[] = [
  {
    label: 'Same-day (FWSY p.218)',
    hours: 6,
    tempF: 70,
    yeastPct: 0.002,
    source: 'FWSY p.218: 2 g IDY per 1,000 g flour, bulk about 6 hours',
    tempAssumed: true,
  },
  {
    label: 'Overnight (FWSY p.220)',
    hours: 12,
    tempF: 70,
    yeastPct: 0.0008,
    source: 'FWSY p.220: 0.8 g IDY per 1,000 g flour, bulk about 12 hours',
    tempAssumed: true,
  },
];

const STRAIGHT_BASE = {
  family: 'straight' as const,
  hydration: 0.7,
  salt: 0.02,
  oil: 0,
  sugar: 0,
  anchors: STRAIGHT_ANCHORS,
  ballG: 340,
  ballDiameterIn: 12,
  residuePct: 0,
  waterF: [{ label: 'Mix water', lowF: 90, highF: 95 }],
  ddtF: [77, 78] as [number, number],
};

export const PRESETS: Formula[] = [
  {
    ...STRAIGHT_BASE,
    id: 'forkish-overnight',
    name: 'Forkish Overnight Straight',
    source: 'FWSY pp.220-221',
    process: { autolyseMin: 25, foldAfterMin: 45, minProofH: 6, proofInFridge: true, maxHoldH: 48 },
    teaspoons: [
      { grams: 0.8, text: 'scant 1/4 tsp', source: 'FWSY p.220' },
      { grams: 20, text: '1 tbsp + 3/4 tsp', source: 'FWSY p.220' },
    ],
  },
  {
    ...STRAIGHT_BASE,
    id: 'forkish-same-day',
    name: 'Forkish Same-Day Straight',
    source: 'FWSY pp.218-219',
    process: { autolyseMin: 25, foldAfterMin: 45, minProofH: 1.5, proofInFridge: false, maxHoldH: 48 },
    teaspoons: [
      { grams: 2, text: '1/2 tsp', source: 'FWSY p.218' },
      { grams: 20, text: '1 tbsp + 3/4 tsp', source: 'FWSY p.218' },
    ],
  },
  {
    id: 'forkish-poolish',
    name: 'Forkish Overnight Poolish',
    family: 'poolish',
    source: 'FWSY pp.225-226',
    hydration: 0.75,
    salt: 0.02,
    oil: 0,
    sugar: 0,
    // The book's timeline assumes a 65-70°F overnight room for the poolish (p.226).
    anchors: [
      {
        label: 'Poolish overnight (FWSY p.226)',
        hours: 13,
        tempF: 68,
        yeastPct: 0.0004,
        source: 'FWSY p.226: 0.4 g IDY in the poolish per 1,000 g total flour, 12-14 h at 65-70°F',
        tempAssumed: false,
      },
    ],
    preferment: { type: 'poolish', flourPct: 0.5, hydration: 1 },
    ballG: 350,
    ballDiameterIn: 12,
    residuePct: 0,
    waterF: [
      { label: 'Poolish water', lowF: 80, highF: 80 },
      { label: 'Final dough water', lowF: 105, highF: 105 },
    ],
    ddtF: [75, 75],
    process: {
      autolyseMin: 0,
      foldAfterMin: 45,
      finalBulkH: 6,
      minProofH: 1.5,
      proofInFridge: false,
      maxHoldH: 48,
    },
    teaspoons: [
      { grams: 0.4, text: 'scant 1/8 tsp', source: 'FWSY p.226' },
      { grams: 20, text: '1 tbsp + 3/4 tsp', source: 'FWSY p.226' },
    ],
  },
];

export function getPreset(id: string): Formula | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function isPresetId(id: string): boolean {
  return PRESETS.some((p) => p.id === id);
}

/** Every Forkish pizza dough "makes five" balls (FWSY pp.218, 220, 225). */
const BOOK_BALL_COUNT = 5;
/** Dinner at 6 p.m. matches the book's same-day sample schedule ("anytime after 6 p.m.", FWSY p.218). */
export const DEFAULT_EAT_HOUR = 18;

/** Ball groups the Plan screen starts with for this dough. */
export function defaultBalls(f: Formula): BallGroup[] {
  return f.defaults?.balls?.length ? f.defaults.balls : [{ count: BOOK_BALL_COUNT, grams: f.ballG, label: 'pizza' }];
}

/** Thickness-factor bands (oz per sq in), PizzaBlab "Thickness Factor in Pizza Making". Shown in Details only. */
export const STYLE_TF = [
  { style: 'Neapolitan', low: 0.07, high: 0.08 },
  { style: 'New York', low: 0.085, high: 0.095 },
  { style: 'Thin', low: 0.07, high: 0.1 },
  { style: 'Cracker', low: 0.05, high: 0.07 },
  { style: 'Medium / home', low: 0.11, high: 0.11 },
  { style: 'Detroit / Sicilian', low: 0.115, high: 0.14 },
  { style: 'Thick pan', low: 0.12, high: 0.13 },
] as const;
export const STYLE_TF_SOURCE = 'PizzaBlab, Thickness Factor in Pizza Making';
