// Post-bake survey -> one direction-only suggestion for next time.
// Rules follow the troubleshooting matrix in the ChatGPT research file (section 8):
// timing first, oven before dough, and no invented numbers. The only figures quoted
// are sourced ones (King Arthur 15-minute rest; PizzaBlab 0.5-3 h warm-up to 50°F).

export type Stretch = 'tore' | 'good' | 'snapped';
export type Rim = 'flat' | 'good' | 'puffy';
export type Bottom = 'pale' | 'good' | 'burnt';
export type Center = 'gummy' | 'set';
export type Ready = 'early' | 'onTime' | 'late';
// Bread ("Add bread details").
export type Crust = 'pale' | 'good' | 'dark';
export type Loaf = 'flat' | 'good' | 'tight';
export type Crumb = 'gummy' | 'good';

export interface Survey {
  stretch?: Stretch;
  rim?: Rim;
  bottom?: Bottom;
  center?: Center;
  ready?: Ready;
  overall?: 1 | 2 | 3 | 4 | 5;
  makeAgain?: boolean;
  crust?: Crust;
  loaf?: Loaf;
  crumb?: Crumb;
}

export type Area = 'timing' | 'oven' | 'handling' | 'shaping';

export interface Suggestion {
  area: Area;
  text: string;
  source?: string;
}

const KA_REST = 'King Arthur, How to Stretch Pizza Dough';
const PB_WARM = 'PizzaBlab, How to Cold Ferment Pizza Dough';
const FWSY_BAKE = 'FWSY p.89: bake until at least medium dark brown, check after 15 minutes uncovered, rest at least 20 minutes';
const FWSY_DENT = 'FWSY p.74: the finger-dent test';

/** What the advice needs to know about the bake. A fridge rise has a fixed yeast amount and no warm-up setting. */
export interface AdviceContext {
  fridge?: boolean;
}

/** All suggestions in priority order. The first one is "the one change" for next time. */
export function suggestions(s: Survey, ctx: AdviceContext = {}): Suggestion[] {
  const out: Suggestion[] = [];
  const fridge = !!ctx.fridge;

  // 1. Timing first: a dough that peaked early or late explains most handling problems.
  // A fridge rise keeps its source yeast amount, so the advice points at the fridge time instead.
  if (s.ready === 'early') {
    out.push({
      area: 'timing',
      text: fridge
        ? 'Dough ran ahead of schedule. Next time: a shorter fridge time, or a cooler spot once it’s out. The fridge yeast amount stays as it is.'
        : 'Dough ran ahead of schedule. Next time: less yeast, a cooler spot, or a shorter bulk.',
    });
  } else if (s.ready === 'late') {
    out.push({
      area: 'timing',
      text: fridge
        ? 'Dough ran behind schedule. Next time: a longer fridge time, or a warmer spot once it’s out. The fridge yeast amount stays as it is.'
        : 'Dough ran behind schedule. Next time: a warmer spot, a longer bulk, or a little more yeast.',
    });
  }

  // 2. Oven before dough for bake problems.
  if (s.bottom === 'pale') {
    out.push({ area: 'oven', text: 'Pale bottom. Next time: preheat the stone or steel longer, or move it closer to the heat.' });
  } else if (s.bottom === 'burnt') {
    out.push({ area: 'oven', text: 'Bottom burnt before the top was done. Next time: less heat from below or more from above (rack higher, or use the broiler).' });
  }
  if (s.crust === 'pale') {
    out.push({ area: 'oven', text: 'Pale crust. Next time: leave the lid off longer, until the loaf is at least medium dark brown all around.', source: FWSY_BAKE });
  } else if (s.crust === 'dark') {
    out.push({ area: 'oven', text: 'Crust too dark. Next time: check the loaf 15 minutes after the lid comes off; your oven may run hot.', source: FWSY_BAKE });
  }
  if (s.crumb === 'gummy') {
    out.push({ area: 'oven', text: 'Gummy crumb. Next time: bake to at least medium dark brown and rest the loaf at least 20 minutes before slicing.', source: FWSY_BAKE });
  }
  if (s.center === 'gummy') {
    out.push({ area: 'oven', text: 'Gummy center. Next time: lighter, drier toppings or a longer bake. Check the oven before changing the dough.' });
  }

  // 3. Handling.
  if (s.stretch === 'tore') {
    if (s.ready === 'early') {
      out.push({ area: 'handling', text: 'Tearing after an early peak points to over-fermentation. Next time: shorten the ferment.' });
    } else if (fridge) {
      out.push({ area: 'handling', text: 'Tore while stretching. Next time: let the balls finish the full counter rest so they reach room temperature (Ooni).' });
    } else {
      out.push({
        area: 'handling',
        text: 'Tore while stretching. Next time: a longer warm-up so the ball is at least 50°F (typically 0.5-3 h out of the fridge).',
        source: PB_WARM,
      });
    }
  } else if (s.stretch === 'snapped') {
    out.push({
      area: 'handling',
      text: `Snapped back. When it resists, cover it and rest 15 minutes, then continue.${fridge ? '' : ' A longer warm-up helps too.'}`,
      source: KA_REST,
    });
  }

  // 4. Shaping / rim.
  if (s.rim === 'flat') {
    out.push(
      s.ready === 'early'
        ? { area: 'shaping', text: 'Flat rim after an early peak: likely over-proofed. Next time: shorten the ferment.' }
        : { area: 'shaping', text: 'Flat rim. Next time: keep your fingers off the outer edge when opening the ball.' },
    );
  } else if (s.rim === 'puffy') {
    out.push({ area: 'shaping', text: 'Rim too puffy. Next time: press the edge a little more, or use a slightly smaller ball.' });
  }

  // 5. Bread proof.
  if (s.loaf === 'flat') {
    out.push({ area: 'shaping', text: 'Loaf spread flat: likely overproofed. Next time: do the finger-dent test at 1 hour and bake as soon as the dent springs back slowly.', source: FWSY_DENT });
  } else if (s.loaf === 'tight') {
    out.push({ area: 'shaping', text: 'Loaf tight or burst open: likely underproofed. Next time: if the dent springs right back, give it more time.', source: FWSY_DENT });
  }

  return out;
}

export function topSuggestion(s: Survey, ctx: AdviceContext = {}): Suggestion | undefined {
  return suggestions(s, ctx)[0];
}

export interface ReadyTally {
  early: number;
  onTime: number;
  late: number;
}

export function readyTally(surveys: Survey[]): ReadyTally {
  const t: ReadyTally = { early: 0, onTime: 0, late: 0 };
  for (const s of surveys) if (s.ready) t[s.ready] += 1;
  return t;
}
