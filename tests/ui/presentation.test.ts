import { describe, expect, it } from 'vitest';
import {
  defaultStart,
  HOME_SCREEN_HELP,
  infoLabel,
  reminderStatus,
  START_LEAD_MIN,
  START_WHEN_READY,
  stepPresentation,
  stepTimeText,
  TIMING_HINTS,
} from '../../src/ui/presentation';

describe('start-time breathing room', () => {
  const at = (s: string) => new Date(s);
  it('default start is at least 15 minutes out, on a quarter hour', () => {
    expect(START_LEAD_MIN).toBe(15);
    expect(defaultStart(at('2026-11-04T12:20:00')).getTime()).toBe(at('2026-11-04T12:45:00').getTime());
    expect(defaultStart(at('2026-11-04T12:30:00')).getTime()).toBe(at('2026-11-04T12:45:00').getTime());
    expect(defaultStart(at('2026-11-04T12:30:01')).getTime()).toBe(at('2026-11-04T13:00:00').getTime());
    expect(defaultStart(at('2026-11-04T23:50:00')).getTime()).toBe(at('2026-11-05T00:15:00').getTime());
  });
  it('the first untouched step says start when ready; others keep their time', () => {
    const fmt = (d: Date) => d.toISOString();
    const step = { key: 'autolyse' as const, at: at('2026-11-04T12:45:00Z') };
    expect(stepTimeText(step, true, fmt)).toBe(START_WHEN_READY);
    expect(stepTimeText(step, false, fmt)).toBe('2026-11-04T12:45:00.000Z');
    expect(stepTimeText({ ...step, doneAt: at('2026-11-04T12:50:00Z') }, true, fmt)).toBe('Done 2026-11-04T12:50:00.000Z');
    expect(stepTimeText({ ...step, passed: true }, false, fmt)).toBe('Not ticked');
  });
});

describe('checklist presentation preserves engine state precedence', () => {
  it('shows completed even if passed and next flags are also present', () => {
    expect(stepPresentation({ key: 'mix', doneAt: new Date(0), passed: true }, 'mix')).toBe('done');
  });
  it('does not offer a passed step as up next', () => {
    expect(stepPresentation({ key: 'mix', passed: true }, 'mix')).toBe('passed');
  });
  it('highlights only the engine-provided next key', () => {
    expect(stepPresentation({ key: 'mix' }, 'mix')).toBe('next');
    expect(stepPresentation({ key: 'fold' }, 'mix')).toBe('');
  });
  it('does not invent a next step when there is none', () => {
    expect(stepPresentation({ key: 'bake' })).toBe('');
  });
});

describe('planning mode hints', () => {
  it.each([
    ['eat', 'Dinner time is fixed. Work back to the first step.'],
    ['start', 'Start time is fixed. See when you can eat.'],
    ['both', 'Set both times. See whether this dough fits.'],
  ] as const)('%s describes the constraint without promising a fit', (mode, expected) => {
    expect(TIMING_HINTS[mode]).toBe(expected);
  });
});

describe('reminder status never hides a blocking permission state', () => {
  it.each([false, true])('unsupported takes precedence over enabled=%s', enabled => {
    expect(reminderStatus('unsupported', enabled)).toContain('This browser can’t show reminders.');
    expect(reminderStatus('unsupported', enabled)).toContain('On iPhone, add the app to your home screen first.');
  });
  it.each([false, true])('missing setup takes precedence over enabled=%s', enabled => {
    expect(reminderStatus('not-set-up', enabled)).toBe('Reminders aren’t set up on the server yet.');
  });
  it.each([false, true])('denial takes precedence over enabled=%s', enabled => {
    expect(reminderStatus('denied', enabled)).toContain('Notifications are blocked.');
  });
  it.each(['default', 'granted'] as const)('%s still reflects the batch toggle', permission => {
    expect(reminderStatus(permission, false)).toBe('A notification at each step, even with the app closed.');
    expect(reminderStatus(permission, true)).toBe('Your phone buzzes at each step, even with the app closed.');
  });
  it('gives installation and permission steps without claiming they apply to every phone', () => {
    for (const phrase of ['On iPhone', 'iOS 16.4', 'Share', 'Add to Home Screen', 'that icon', 'allow notifications']) {
      expect(HOME_SCREEN_HELP).toContain(phrase);
    }
  });
});

describe('info control labels', () => {
  it('names the field in both states', () => {
    expect(infoLabel(false, 'planning times')).toBe('Explain planning times');
    expect(infoLabel(true, 'planning times')).toBe('Hide planning times');
  });
});
