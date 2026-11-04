import { describe, expect, it } from 'vitest';
import { HELP_COPY, WATER_SOURCES } from '../../src/ui/helpCopy';
import { READY_WINDOW_SOURCE } from '../../src/ui/presentation';

describe('help and attribution contracts', () => {
  it('retains every extracted explanation', () => {
    expect(Object.keys(HELP_COPY).sort()).toEqual([
      'dough balls', 'kitchen adjustment', 'planning times', 'reminder privacy',
      'room temperature', 'saved defaults', 'warm-up time', 'water temperature and friction', 'yeast override',
    ]);
    for (const text of Object.values(HELP_COPY)) expect(text.length).toBeGreaterThan(30);
  });
  it('keeps the fridge-time citation in both planning help and the ready window', () => {
    expect(HELP_COPY['planning times']).toContain('FWSY p.219');
    expect(HELP_COPY['planning times']).toContain('doesn’t change the yeast');
    expect(READY_WINDOW_SOURCE).toContain('FWSY p.219');
  });
  it('preserves the PizzaBlab warm-up range and temperature', () => {
    expect(HELP_COPY['warm-up time']).toContain('PizzaBlab: typically 0.5-3 h, until the ball is at least 50°F.');
  });
  it('keeps both King Arthur sources and the explanation of friction', () => {
    expect(WATER_SOURCES).toEqual([
      { href: 'https://www.kingarthurbaking.com/blog/2018/05/29/desired-dough-temperature', text: 'King Arthur: Desired dough temperature' },
      { href: 'https://www.kingarthurbaking.com/blog/2018/08/27/determining-the-friction-factor-in-baking', text: 'King Arthur: Determining the friction factor' },
    ]);
    expect(HELP_COPY['water temperature and friction']).toContain('King Arthur');
    expect(HELP_COPY['water temperature and friction']).toContain('3 × target dough temp');
    expect(HELP_COPY['water temperature and friction']).toContain('4 × with a poolish');
    expect(HELP_COPY['water temperature and friction']).toContain('Friction is the heat mixing adds.');
  });
  // Must match what api.reminderItems actually sends (tests/reminders.test.ts checks that side).
  it('reminder privacy names everything the server holds, and what stays on the phone', () => {
    const t = HELP_COPY['reminder privacy'];
    for (const s of ['notification address', 'random ID for this phone', 'its name, its time and the dough’s name']) {
      expect(t).toContain(s);
    }
    expect(t).toContain('Weights, notes, photos and ratings stay on your phone.');
    expect(t).toContain('Checking a step off re-sends the times');
    expect(t).not.toMatch(/only that address|never your recipe/i);
  });
  it('does not turn the yeast override into a required field or change its units', () => {
    expect(HELP_COPY['yeast override']).toContain('Leave blank.');
    expect(HELP_COPY['yeast override']).toContain('0.08 means 0.08%');
  });
});
