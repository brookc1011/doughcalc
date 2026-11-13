// Mix and fold instructions by mixing method, and the oven preheat line. Every figure has a source.
// Forkish mixes by hand and prints no mixer times; the mixer figures come from KitchenAid and
// America's Test Kitchen. No source says a mixer-kneaded dough can skip Forkish's folds, so the
// fold step is the same either way.

export type MixMethod = 'hand' | 'mixer';

export const METHOD_SOURCES = {
  hand: 'FWSY overnight straight dough (WPR reprint): pincer alternated with folding; Forkish, Elements of Pizza (Ooni reprint): 30-60 sec into one mass',
  mixer: 'KitchenAid "Kneading Times and Speeds": speed 2; America\'s Test Kitchen "Pizza Dough Kneaded in a Standing Mixer": about 5 min on low, smooth and elastic',
  preheat: 'King Arthur "How to make pizza crust crispy" (2024): at least an hour; Baking Steel: 45-60 min',
} as const;

export interface MixText {
  mix: string;
  fold: string;
}

export function mixSteps(method: MixMethod, poolish: boolean): MixText {
  const add = poolish ? 'Add the poolish, salt and the rest of the water.' : 'Sprinkle the salt over the dough and pour in the yeast water.';
  const fold = 'One or two folds, then oil the dough and tub lightly.';
  if (method === 'mixer') {
    return {
      mix: `${add} Dough hook on speed 2 (KitchenAid) for about 5 minutes (America's Test Kitchen). It will still be soft and sticky; the folds build its strength.`,
      fold,
    };
  }
  return {
    mix: `${add} Wet your hand. Pinch through the dough with thumb and forefinger, then fold it over itself; alternate until no dry flour or salt is left (Forkish's pincer method). No set time in the book.`,
    fold,
  };
}

export function preheatDetail(min: number): string {
  return `Stone or steel in, oven at 500-550°F (Baking Steel). ${min} minutes heats the stone through (King Arthur: at least an hour; Baking Steel: 45-60 min).`;
}
