import { describe, expect, it } from 'vitest';
import { suggestions } from '../src/engine/advice';
import { planBatch, UNCHECKED_PAGE } from '../src/engine/plan';
import { PRESETS } from '../src/engine/presets';
import { tempsIn } from '../src/ui/common';

// Phase 3 of the 2026-11-20 fix plan: words and docs.

const temp = { bandLowF: 66, bandHighF: 74, frictionF: 2 };
const overnight = PRESETS.find((p) => p.id === 'forkish-overnight')!;
const base = { formula: overnight, balls: [{ count: 4, grams: 340 }], eatAt: new Date('2026-11-15T18:00:00'), roomF: 70, warmUpH: 2, temp };

describe('phase 3 wording', () => {
  it('shows step temperatures in °C when that is the setting, and leaves °F alone', () => {
    expect(tempsIn('Water at 90-95°F, oven to 475°F.', 'C')).toBe('Water at 32-35°C, oven to 246°C.');
    expect(tempsIn('Water at 90°F.', 'F')).toBe('Water at 90°F.');
  });

  it('labels a pizza book yeast amount whose page is not in the source notes', () => {
    const p = planBatch(base);
    expect(p.yeast.note).toContain(UNCHECKED_PAGE);
  });

  it('fridge-rise advice keeps the yeast and drops the warm-up', () => {
    const early = suggestions({ ready: 'early' }, { fridge: true })[0].text;
    expect(early).toContain('fridge time');
    expect(early).not.toMatch(/less yeast/);
    const snapped = suggestions({ stretch: 'snapped' } as never, { fridge: true }).map((s) => s.text).join(' ');
    expect(snapped).not.toContain('longer warm-up');
  });
});
