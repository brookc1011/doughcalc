import type { Formula } from './types';

// Desired dough temperature (DDT) water formula, King Arthur Baking professional reference:
//   straight dough:  water = 3 x DDT - room - flour - friction
//   with preferment: water = 4 x DDT - room - flour - preferment - friction
// Flour and the preferment are assumed to sit at room temperature.

export interface TempSettings {
  /** Room temperatures inside this band use the book's water temperature as printed. */
  bandLowF: number;
  bandHighF: number;
  /** Temperature rise from mixing, °F. Hand folds: King Arthur 0-4°F. Stand mixer: King Arthur 22-24°F. */
  frictionF: number;
}

export interface WaterTemp {
  label: string;
  lowF: number;
  highF: number;
  basis: 'book' | 'calculated';
  note: string;
  warning?: string;
}

export function waterTemps(formula: Formula, roomF: number, s: TempSettings): WaterTemp[] {
  const inBand = roomF >= s.bandLowF && roomF <= s.bandHighF;
  const ddt = (formula.ddtF[0] + formula.ddtF[1]) / 2;

  return formula.waterF.map((w, i) => {
    const book: WaterTemp = { label: w.label, lowF: w.lowF, highF: w.highF, basis: 'book', note: `Book temperature (${formula.source}).` };
    // The poolish build has no stated DDT, so it always keeps the book's water temperature.
    const isPoolishBuild = formula.preferment && i === 0;
    if (inBand || isPoolishBuild) return book;

    const withPreferment = Boolean(formula.preferment);
    const t = withPreferment
      ? 4 * ddt - roomF - roomF - roomF - s.frictionF
      : 3 * ddt - roomF - roomF - s.frictionF;
    const out: WaterTemp = {
      label: w.label,
      lowF: t,
      highF: t,
      basis: 'calculated',
      note: `Room is outside ${s.bandLowF}-${s.bandHighF}°F, so water is set to land the dough at ${ddt}°F (King Arthur DDT formula, friction ${s.frictionF}°F).`,
    };
    if (t > 115) out.warning = 'Very hot water. Above about 115°F, use the book temperature and expect a slower ferment instead.';
    if (t < 35) out.warning = 'Ice-cold water needed. Consider a cooler spot for the bulk instead.';
    return out;
  });
}

export const FRICTION_DEFAULTS = {
  hand: { frictionF: 2, source: 'Assumed 2°F, inside King Arthur 0-4°F for gentle folds' },
  mixer: { frictionF: 23, source: 'Assumed 23°F, inside King Arthur 22-24°F for a KitchenAid' },
} as const;
