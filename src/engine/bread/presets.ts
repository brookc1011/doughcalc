import type { Formula } from '../types';

// Bread presets. Every figure is from the book page named next to it; the transcription CJ checked
// against the book is docs/sources/fwsy-bread.md ("Overnight White Bread (p.89)" and its method pages).

/**
 * Book table for Overnight White (FWSY p.89): 1,000 g flour, 780 g water, 22 g salt, 0.8 g instant yeast,
 * divided into 2 equal pieces (method step 4). One loaf's dough is half the table's total.
 * The book's "about 1½ pounds" per loaf is the baked loaf, so it is not used as a dough weight.
 */
const OVERNIGHT_WHITE_DOUGH_G = 1000 + 780 + 22 + 0.8;
const OVERNIGHT_WHITE_LOAVES = 2;

export const OVERNIGHT_WHITE: Formula = {
  id: 'forkish-overnight-white',
  name: 'Overnight White Bread',
  product: 'bread',
  family: 'straight',
  source: 'FWSY p.89 and the two method pages after it',
  hydration: 0.78,
  salt: 0.022,
  oil: 0,
  sugar: 0,
  anchors: [
    {
      label: 'Overnight White (FWSY p.89)',
      // The book's bulk is 12-14 h. 13 h is its sample schedule: mix 7 p.m., shape 8 a.m.
      hours: 13,
      // The book gives no bulk room temperature (its "about 70°F" is for the proof), so 70°F is our assumption.
      tempF: 70,
      yeastPct: 0.0008,
      source: 'FWSY p.89: 0.8 g instant yeast per 1,000 g flour, bulk 12-14 hours',
      tempAssumed: true,
    },
  ],
  ballG: OVERNIGHT_WHITE_DOUGH_G / OVERNIGHT_WHITE_LOAVES,
  ballDiameterIn: 0,
  residuePct: 0,
  waterF: [{ label: 'Mix water', lowF: 90, highF: 95 }],
  // Method step 2: target dough temperature at the end of the mix, 77-78°F.
  ddtF: [77, 78],
  process: {
    // Book: rest 20-30 minutes. 25 is the middle of that range, as in the pizza presets; the timer shows 20-30.
    autolyseMin: 25,
    // First of the folds, 30 minutes after mixing: King Arthur's spacing, inside the book's first 1½ hours.
    foldAfterMin: 30,
    // Sample schedule: mix 7 p.m., shape 8 a.m. (13 h, inside the book's 12-14 h).
    stageH: 13,
    // Proof about 1¼ hours at about 70°F, check after 1 hour.
    minProofH: 1.25,
    proofInFridge: false,
    // Room proof: the book allows no hold ("15 minutes can make a difference"), so the bake follows the proof.
    maxHoldH: 1.25,
    // "Two or three folds. Three would be best ... two folds will be fine."
    folds: 3,
  },
  teaspoons: [
    { grams: 0.8, text: 'scant 1/4 tsp', source: 'FWSY p.89' },
    { grams: 22, text: '1 tbsp + 1 tsp', source: 'FWSY p.89' },
  ],
  defaults: {
    balls: [{ count: OVERNIGHT_WHITE_LOAVES, grams: OVERNIGHT_WHITE_DOUGH_G / OVERNIGHT_WHITE_LOAVES, label: 'loaf' }],
    // Sample schedule: bake at 9:15 a.m.
    eatHour: 9,
    eatMinute: 15,
    mixer: 'hand',
  },
};

export const BREAD_PRESETS: Formula[] = [OVERNIGHT_WHITE];
