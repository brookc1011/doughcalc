// Bread schedule and step text (straight, yeasted doughs baked in a Dutch oven).
//
// Sources (transcribed in docs/sources/fwsy-bread.md, checked by CJ against the book 2026-11-13):
// - FWSY Overnight White Bread, p.89 and its two method pages: autolyse 20-30 min in a 12-qt tub; salt and
//   yeast sprinkled over, wet hand, a quarter folded over 4 times, pincer cuts alternated with folding, rest a
//   few minutes, fold 30 more seconds; dough at 77-78°F; 2-3 folds (three best) in the first 1½ hours; rise
//   overnight at room temperature to 2½-3x volume, 12-14 h after mixing; divide in 2 on a floured surface;
//   medium-tight balls seam side down in floured baskets; flour the tops, towel or nonperforated bag; bake
//   about 1¼ h after shaping at about 70°F (about 1 h warmer), finger-dent test (p.74) after 1 h; preheat
//   2 Dutch ovens, lids on, 475°F, at least 45 min (one Dutch oven: second loaf in the fridge about 20 min
//   before baking the first, 5-minute reheat); loaf in seam side up, 30 min lid on, 20-30 min lid off until at
//   least medium dark brown, check after 15 min uncovered; cool on a rack, rest at least 20 min before slicing.
// - Finger-dent test (FWSY ch. 4, p.74): poke about ½ inch; springs back at once, more time; slowly and not
//   fully, ready; not at all, overproofed.
// - Fold spacing: King Arthur (Maurizio Leo, "Mix and fold in bread dough"): about 30 minutes between folds.
//   Three folds 30 minutes apart fit the book's "first 1½ hours".
// - Active dry yeast: dissolved in about 3 tbsp of the measured water (FWSY p.220 method) warmed to
//   100-110°F (Fleischmann's Yeast 101). The bread page sprinkles instant yeast dry.

import { ACTIVE_DRY_WATER, ballCut, type StepAmounts, type StepIngredient, type StepTimer } from '../stepText';
import type { Schedule, Step } from '../schedule';
import type { Formula, Ingredient } from '../types';

const H = 3600_000;
const M = 60_000;
const add = (d: Date, ms: number) => new Date(d.getTime() + ms);

/** FWSY p.89: lid on 30 minutes. */
export const LID_ON_MIN = 30;
/** FWSY p.89: lid off 20-30 minutes; the schedule uses the shorter time and the timer shows the range. */
export const LID_OFF_MIN = 20;
export const LID_OFF_UP_TO_MIN = 30;
/** FWSY p.89: rest at least 20 minutes before slicing. */
export const REST_MIN = 20;
/** FWSY p.89: preheat at least 45 minutes. */
export const BREAD_PREHEAT_MIN = 45;
/** FWSY p.89: check the proof after 1 hour. */
export const PROOF_CHECK_H = 1;
/** King Arthur: about 30 minutes between folds. */
export const FOLD_GAP_MIN = 30;

export interface BreadScheduleInput {
  formula: Formula;
  /** When the loaves go in the oven (the bread "Bake at"). */
  eatAt: Date;
  stageH: number;
  /** Fixed mix time; otherwise worked back from eatAt. */
  mixAt?: Date;
  /** Actual times from the checklist; later steps re-time from them. */
  shapeAt?: Date;
  bakeAt?: Date;
  lidOffAt?: Date;
  outAt?: Date;
  amounts?: StepAmounts;
}

const g = (n: number) => `${Math.round(n).toLocaleString('en-US')} g`;
const yeastG = (n: number) => `${n < 10 ? n.toFixed(2) : Math.round(n)} g`;
const find = (list: Ingredient[], key: Ingredient['key']) => list.find((i) => i.key === key);
const loafWord = (n: number) => (n === 1 ? 'loaf' : 'loaves');

export function foldCount(f: Formula): number {
  return Math.max(1, f.process.folds ?? 2);
}

/** Fold step keys: the first is 'fold' (as for pizza), then 'fold2', 'fold3', ... */
export function foldKey(i: number): string {
  return i === 0 ? 'fold' : `fold${i + 1}`;
}

/** Hours from mixing to the loaves going in (bulk plus proof). */
export function mixToBakeH(f: Formula, stageH: number): number {
  return stageH + f.process.minProofH;
}

export function buildBreadSchedule(input: BreadScheduleInput): Schedule {
  const { formula: f, stageH } = input;
  const p = f.process;
  const proofH = p.minProofH;
  const mix = input.mixAt ?? add(input.eatAt, -mixToBakeH(f, stageH) * H);
  const shape = input.shapeAt ?? add(mix, stageH * H);
  const bake = input.bakeAt ?? add(shape, proofH * H);
  const lidOff = input.lidOffAt ?? add(bake, LID_ON_MIN * M);
  const out = input.outAt ?? add(lidOff, LID_OFF_MIN * M);
  const slice = add(out, REST_MIN * M);

  const a = input.amounts;
  const t = a?.parts[0]?.ingredients ?? [];
  const flour = find(t, 'flour');
  const water = find(t, 'water');
  const salt = find(t, 'salt');
  const yeast = find(t, 'yeast');
  const activeDry = yeast?.name === 'Active dry yeast';
  const w = a?.water[0];
  const waterTemp = w ? (Math.round(w.lowF) === Math.round(w.highF) ? `${Math.round(w.lowF)}°F` : `${Math.round(w.lowF)}-${Math.round(w.highF)}°F`) : 'the water temperature above';
  const loaves = (a?.balls ?? f.defaults?.balls ?? []).filter((b) => b.count > 0).reduce((n, b) => n + b.count, 0) || 2;
  const ddt = `${f.ddtF[0]}${f.ddtF[1] !== f.ddtF[0] ? `-${f.ddtF[1]}` : ''}°F`;
  const ap = a?.apFlour ? ' All-purpose flour: King Arthur says to use less water than with bread flour, but gives no amount; hydration is in Details.' : '';
  const yeastText = yeast ? `${yeastG(yeast.grams)} ${activeDry ? 'active dry yeast' : 'instant yeast'}${yeast.tsp ? ` (${yeast.tsp})` : ''}` : 'the yeast';

  const steps: Step[] = [];
  const ingredients: Partial<Record<string, StepIngredient[]>> = {};

  if (p.autolyseMin > 0) {
    const cup = activeDry ? ' Keep back about 3 tbsp of the water in a small cup for the yeast.' : '';
    steps.push({
      key: 'autolyse',
      label: 'Autolyse',
      at: add(mix, -p.autolyseMin * M),
      detail:
        `Measure ${water ? g(water.grams) : 'the'} water at ${waterTemp}.${cup} Mix it with ${flour ? g(flour.grams) : 'the'} flour by hand in a 12-qt round tub, ` +
        `just until there's no dry flour. Cover and rest 20-30 min.${ap}`,
    });
    ingredients.autolyse = a
      ? [
          { name: 'Flour', amount: g(flour?.grams ?? 0) },
          { name: 'Water', amount: `${g(water?.grams ?? 0)} at ${waterTemp}${activeDry ? ', about 3 tbsp kept back' : ''}` },
        ]
      : undefined;
  }

  const addYeast = activeDry
    ? `Warm the cup of water you kept back to ${ACTIVE_DRY_WATER}, stir in ${yeastText} until dissolved, sprinkle ${salt ? g(salt.grams) : 'the'} salt evenly over the dough and pour the yeast water over.`
    : `Sprinkle ${salt ? g(salt.grams) : 'the'} salt and ${yeastText} evenly over the dough.`;
  steps.push({
    key: 'mix',
    label: 'Mix in salt and yeast',
    at: mix,
    detail:
      `${addYeast} Wet your mixing hand (rewetting it 3 or 4 times is fine). Reach under, grab about a quarter of the dough, stretch it and fold it over the top; ` +
      `do this 4 times to enclose the salt and yeast. Then pincer: 5 or 6 pinches through the whole mass with thumb and forefinger, fold it over itself a few times, ` +
      `and repeat until it's fully mixed and has some tension. Rest a few minutes, then fold 30 seconds more, until it tightens. Aim for dough at ${ddt}. Cover the tub.`,
  });
  ingredients.mix = a
    ? [
        { name: 'Salt', amount: g(salt?.grams ?? 0) },
        { name: activeDry ? 'Active dry yeast' : 'Instant yeast', amount: activeDry ? `${yeastG(yeast?.grams ?? 0)}, dissolved in the cup kept back` : `${yeastG(yeast?.grams ?? 0)}${yeast?.tsp ? ` (${yeast.tsp})` : ''}` },
      ]
    : undefined;

  const n = foldCount(f);
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const optional = n === 3 && i === 2 ? ' The book says three folds are best for volume, but two are fine: skip this one if you need to.' : '';
    const after = last
      ? ` Cover and leave it overnight at room temperature. It's ready to divide at 2½-3 times its starting size, ${stageHText(stageH)} after mixing (book: 12-14 h).`
      : ' Cover again.';
    steps.push({
      key: foldKey(i) as Step['key'],
      label: n > 1 ? `Fold ${i + 1} of ${n}` : 'Fold',
      at: add(mix, (p.foldAfterMin + i * FOLD_GAP_MIN) * M),
      detail: `With a wet hand, reach under, stretch a quarter of the dough up and fold it over the top, going around 4 times.${optional}${after}`,
    });
  }

  steps.push({
    key: 'shape',
    label: 'Divide and shape',
    at: shape,
    detail:
      `Dust ${loaves} proofing ${loaves === 1 ? 'basket' : 'baskets'} with flour. Moderately flour a work surface about 2 feet wide. Flour your hands and around the edge of the tub, ` +
      `tip the tub and work a floured hand under the dough to loosen it, then ease it out without pulling or tearing. ` +
      (loaves > 1 ? `Flour the middle and cut ${a ? ballCut(a.balls) : `${loaves} equal pieces`}. ` : '') +
      `Shape each into a medium-tight ball and set it seam side down in its basket. Lightly flour the tops; cover with a kitchen towel, or put each basket in a nonperforated plastic bag.`,
  });
  ingredients.shape = a ? [{ name: 'Loaves', amount: ballCut(a.balls).replace(/pieces?/, loafWord(loaves)) }] : undefined;

  steps.push({
    key: 'proofCheck',
    label: 'Finger-dent test',
    at: add(shape, PROOF_CHECK_H * H),
    detail:
      `Proof is about ${fmtH(proofH)} at about 70°F, closer to 1 h in a warmer kitchen. Poke a loaf about ½ inch deep. Springs back at once: give it more time. ` +
      `Springs back slowly and not all the way: ready to bake. Doesn't spring back: overproofed. With this bread 15 minutes can be the difference.`,
  });

  steps.push({
    key: 'preheat',
    label: 'Preheat the oven',
    at: add(bake, -BREAD_PREHEAT_MIN * M),
    detail:
      `Rack in the middle, ${loaves > 1 ? 'the Dutch ovens' : 'the Dutch oven'} on it with lids on, oven to 475°F, at least ${BREAD_PREHEAT_MIN} minutes. ` +
      (loaves > 1 ? 'Only one Dutch oven: put the second loaf in the fridge about 20 minutes before the first goes in, bake them one after the other, and give the pot a 5-minute reheat between loaves.' : ''),
  });

  steps.push({
    key: 'bake',
    label: loaves > 1 ? 'Loaves in, lid on' : 'Loaf in, lid on',
    at: bake,
    detail:
      `Careful: don't let hands, fingers or forearms touch the hot Dutch oven. Turn the loaf out onto a lightly floured counter; the side that was down in the basket is now the top. ` +
      `With mitts, take out the Dutch oven, lift the lid, set the loaf in seam side up, lid back on, and into the oven at 475°F for ${LID_ON_MIN} minutes.`,
  });
  steps.push({
    key: 'lidOff',
    label: 'Take the lid off',
    at: lidOff,
    detail: `Carefully remove the lid and bake ${LID_OFF_MIN}-${LID_OFF_UP_TO_MIN} minutes more, until at least medium dark brown all around. Check at 15 minutes in case your oven runs hot.`,
  });
  steps.push({
    key: 'out',
    label: 'Out of the oven',
    at: out,
    detail: `Tilt the Dutch oven to turn the loaf out. Cool on a rack, or set it on its side so air gets around it. Rest at least ${REST_MIN} minutes before slicing.`,
  });
  steps.push({ key: 'slice', label: 'Ready to slice', at: slice, detail: 'Rested 20 minutes. Slice and enjoy.' });

  for (const st of steps) {
    st.cover = BREAD_COVER[st.key];
    st.timer = breadTimer(st.key);
    st.ingredients = ingredients[st.key];
  }
  steps.sort((x, y) => x.at.getTime() - y.at.getTime());
  return { steps, errors: [], ballAgeH: (bake.getTime() - shape.getTime()) / H };
}

function stageHText(h: number): string {
  return `about ${fmtH(h)}`;
}

function fmtH(h: number): string {
  const whole = Math.floor(h);
  const q = Math.round((h - whole) * 4);
  const frac = ['', '¼', '½', '¾'][q] ?? '';
  return `${whole}${frac} h`;
}

/** Tub lid during bread steps. Oven steps have none (the Dutch oven lid is in the step text). */
export const BREAD_COVER: Partial<Record<string, 'on' | 'off'>> = {
  autolyse: 'on',
  mix: 'on',
  fold: 'on',
  fold2: 'on',
  fold3: 'on',
  fold4: 'on',
  shape: 'off',
};

export function breadTimer(key: string): StepTimer | undefined {
  if (key === 'autolyse') return { kind: 'countdown', min: 20, upToMin: 30, source: 'FWSY p.89: rest 20-30 minutes' };
  if (key === 'mix') return { kind: 'stopwatch', note: 'The book gives no time for mixing by hand: mix until fully integrated with some tension.' };
  if (/^fold\d*$/.test(key)) return { kind: 'countdown', min: FOLD_GAP_MIN, source: 'King Arthur: about 30 minutes between folds' };
  if (key === 'shape') return { kind: 'countdown', min: PROOF_CHECK_H * 60, source: 'FWSY p.89: check the loaves after 1 hour' };
  if (key === 'bake') return { kind: 'countdown', min: LID_ON_MIN, source: 'FWSY p.89: 30 minutes with the lid on' };
  if (key === 'lidOff') return { kind: 'countdown', min: LID_OFF_MIN, upToMin: LID_OFF_UP_TO_MIN, source: 'FWSY p.89: 20-30 minutes uncovered; check at 15' };
  if (key === 'out') return { kind: 'countdown', min: REST_MIN, source: 'FWSY p.89: rest at least 20 minutes before slicing' };
  return undefined;
}
