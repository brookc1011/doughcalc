// Full step instructions with this batch's amounts. Used for plans locked from stepVersion 3 on;
// older batches keep the short text in schedule.ts.
//
// Sources:
// - FWSY overnight straight dough (WPR reprint, FWSY p.220): yeast in about 3 tbsp of the measured
//   water; rest of the water over the flour in a 12-qt tub, mixed by hand just until incorporated,
//   covered 20-30 min; salt sprinkled over, yeast water poured on, cup wiped with a bit of dough;
//   wet hand, reach under and fold a quarter over 4 times, then alternate pincer and folding;
//   1-2 folds 30-60 min after mixing, then oil dough and tub; ready at 2-3x volume; floured counter,
//   cut equal pieces, medium-tight rounds without degassing; balls on a lightly floured sheet with
//   room to spread, tops oiled or floured, plastic wrap, fridge.
// - The same-day straight dough (FWSY p.218) uses the same method with more yeast.
// - Ball shaping moves: Baking Steel "How to make simple pizza dough balls" (fold edges to the
//   center, turn and repeat, pinch the seam, seam side down).
// - Poolish (FWSY pp.225-226): amounts and water temperatures from the preset; method unchanged.
// - Stand mixer: KitchenAid speed 2, America's Test Kitchen about 5 min (see methods.ts).

import type { MixMethod } from './methods';
import type { WaterTemp } from './temperature';
import type { BallGroup, Ingredient, MixPart } from './types';

export interface StepAmounts {
  parts: MixPart[];
  water: WaterTemp[];
  balls: BallGroup[];
}

const g = (n: number) => `${Math.round(n).toLocaleString('en-US')} g`;
const yeastG = (n: number) => `${n < 10 ? n.toFixed(2) : Math.round(n)} g`;
const temp = (w?: WaterTemp) => {
  if (!w) return 'the water temperature above';
  const lo = Math.round(w.lowF);
  const hi = Math.round(w.highF);
  return lo === hi ? `${lo}°F` : `${lo}-${hi}°F`;
};
const find = (list: Ingredient[], key: Ingredient['key']) => list.find((i) => i.key === key);
const yeastName = (y?: Ingredient) => (y?.name === 'Active dry yeast' ? 'active dry yeast' : 'instant yeast');

export function ballCut(balls: BallGroup[]): string {
  const live = balls.filter((b) => b.count > 0);
  const total = live.reduce((n, b) => n + b.count, 0);
  if (live.length === 1) return `${total} ${total === 1 ? 'piece' : 'pieces'} of ${g(live[0].grams)}`;
  return live.map((b) => `${b.count} of ${g(b.grams)}`).join(' and ') + ` (${total} pieces)`;
}

export interface FullText {
  poolish?: string;
  autolyse?: string;
  mix: string;
  fold: string;
  ball: string;
  fridge: string;
  pull: (warmUpH: number) => string;
}

export function fullStepText(a: StepAmounts, method: MixMethod, ddt: string, stageH: number): FullText {
  const fold =
    'One or two folds in the 30-60 min after mixing: with a wet hand, reach under, stretch a quarter of the dough up and fold it over the top, going around 4 times. ' +
    'After the last fold, lightly oil the dough and the bottom of the tub, then cover. It’s ready to divide at 2-3 times its starting size.';
  const ball =
    `Flour the counter. With floured hands, ease the dough out of the tub, dust the top with flour and cut ${ballCut(a.balls)}. ` +
    'Shape each gently into a medium-tight round without pressing the air out: fold the edges into the center, turn and repeat, then pinch the seam and set it seam side down.';
  const fridge = 'On a lightly floured baking sheet with room between them. Lightly oil or flour the tops, cover with plastic wrap, and into the fridge.';
  const pull = (h: number) => `Leave them covered at room temperature, about ${h} h, until they stretch easily.`;

  if (a.parts.length === 2) {
    const [pp, fp] = a.parts;
    const y = find(pp.ingredients, 'yeast');
    const salt = find(fp.ingredients, 'salt');
    const addLine =
      `Put ${g(find(fp.ingredients, 'flour')?.grams ?? 0)} flour in the tub. Add all the poolish, ${g(salt?.grams ?? 0)} salt and ` +
      `${g(find(fp.ingredients, 'water')?.grams ?? 0)} water at ${temp(a.water[1])}.`;
    return {
      poolish:
        `Mix ${g(find(pp.ingredients, 'flour')?.grams ?? 0)} flour, ${g(find(pp.ingredients, 'water')?.grams ?? 0)} water at ${temp(a.water[0])} ` +
        `and ${yeastG(y?.grams ?? 0)} ${yeastName(y)} just until incorporated. Cover and leave out overnight (${stageH} h).`,
      mix: mixLine(method, addLine, ddt),
      fold,
      ball,
      fridge,
      pull,
    };
  }

  const t = a.parts[0].ingredients;
  const y = find(t, 'yeast');
  return {
    autolyse:
      `Measure ${g(find(t, 'water')?.grams ?? 0)} water at ${temp(a.water[0])}. Put ${yeastG(y?.grams ?? 0)} ${yeastName(y)} in a small cup with about 3 tbsp of that water and set it aside. ` +
      `Pour the rest of the water over ${g(find(t, 'flour')?.grams ?? 0)} flour in a 12-qt tub${method === 'mixer' ? ' or the mixer bowl' : ''} and mix by hand just until there’s no dry flour. Cover and rest 20-30 min.`,
    mix: mixLine(
      method,
      `Sprinkle ${g(find(t, 'salt')?.grams ?? 0)} salt over the dough. Stir the yeast water with a finger and pour it over; wipe the cup with a pinch of dough and add that back.`,
      ddt,
    ),
    fold,
    ball,
    fridge,
    pull,
  };
}

function mixLine(method: MixMethod, add: string, ddt: string): string {
  if (method === 'mixer') {
    return `${add} Dough hook on speed 2 (KitchenAid) for about 5 minutes, until smooth and elastic (America's Test Kitchen). Aim for dough at ${ddt}.`;
  }
  return (
    `${add} Wet your hand. Reach under, grab a quarter of the dough, stretch it and fold it over the top; do this 4 times to wrap in the salt and yeast. ` +
    `Then alternate pinching through the dough with thumb and forefinger and folding it over (Forkish's pincer method) until it’s one mass with no dry bits. ` +
    `Rewet your hand when it sticks. Aim for dough at ${ddt}.`
  );
}

/** "25 min", "12 h", "1 h 30 min". */
export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** How long until the step after this one: "Then 25 min until Mix in salt and yeast", or "Then right away: Into the fridge". */
export function gapToNext(steps: { label: string; at: Date | string }[], i: number): string | undefined {
  const next = steps[i + 1];
  if (!next) return undefined;
  const ms = new Date(next.at).getTime() - new Date(steps[i].at).getTime();
  if (ms < 60_000) return `Then right away: ${next.label}`;
  return `Then ${fmtDuration(ms)} until ${next.label}`;
}
