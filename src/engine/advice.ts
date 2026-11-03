// Post-bake survey -> one direction-only suggestion for next time.
// Rules follow the troubleshooting matrix in the ChatGPT research file (section 8):
// timing first, oven before dough, and no invented numbers. The only figures quoted
// are sourced ones (King Arthur 15-minute rest; PizzaBlab 0.5-3 h warm-up to 50°F).

export type Stretch = 'tore' | 'good' | 'snapped';
export type Rim = 'flat' | 'good' | 'puffy';
export type Bottom = 'pale' | 'good' | 'burnt';
export type Center = 'gummy' | 'set';
export type Ready = 'early' | 'onTime' | 'late';

export interface Survey {
  stretch?: Stretch;
  rim?: Rim;
  bottom?: Bottom;
  center?: Center;
  ready?: Ready;
  overall?: 1 | 2 | 3 | 4 | 5;
  makeAgain?: boolean;
}

export type Area = 'timing' | 'oven' | 'handling' | 'shaping';

export interface Suggestion {
  area: Area;
  text: string;
  source?: string;
}

const KA_REST = 'King Arthur, How to Stretch Pizza Dough';
const PB_WARM = 'PizzaBlab, How to Cold Ferment Pizza Dough';

/** All suggestions in priority order. The first one is "the one change" for next time. */
export function suggestions(s: Survey): Suggestion[] {
  const out: Suggestion[] = [];

  // 1. Timing first: a dough that peaked early or late explains most handling problems.
  if (s.ready === 'early') {
    out.push({ area: 'timing', text: 'Dough ran ahead of schedule. Next time: less yeast, a cooler spot, or a shorter bulk.' });
  } else if (s.ready === 'late') {
    out.push({ area: 'timing', text: 'Dough ran behind schedule. Next time: a warmer spot, a longer bulk, or a little more yeast.' });
  }

  // 2. Oven before dough for bake problems.
  if (s.bottom === 'pale') {
    out.push({ area: 'oven', text: 'Pale bottom. Next time: preheat the stone or steel longer, or move it closer to the heat.' });
  } else if (s.bottom === 'burnt') {
    out.push({ area: 'oven', text: 'Bottom burnt before the top was done. Next time: less heat from below or more from above (rack higher, or use the broiler).' });
  }
  if (s.center === 'gummy') {
    out.push({ area: 'oven', text: 'Gummy center. Next time: lighter, drier toppings or a longer bake. Check the oven before changing the dough.' });
  }

  // 3. Handling.
  if (s.stretch === 'tore') {
    if (s.ready === 'early') {
      out.push({ area: 'handling', text: 'Tearing after an early peak points to over-fermentation. Next time: shorten the ferment.' });
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
      text: 'Snapped back. When it resists, cover it and rest 15 minutes, then continue. A longer warm-up helps too.',
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

  return out;
}

export function topSuggestion(s: Survey): Suggestion | undefined {
  return suggestions(s)[0];
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
