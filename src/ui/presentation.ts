import type { batchProgress, pushPermission, TimingMode } from '../api';

type DisplayStep = Pick<ReturnType<typeof batchProgress>['steps'][number], 'key' | 'doneAt' | 'passed'>;
type Permission = ReturnType<typeof pushPermission>;

/** The existing display precedence, not a scheduler or completion rule. */
export function stepPresentation(step: DisplayStep, nextKey?: string): 'done' | 'passed' | 'next' | '' {
  return step.doneAt ? 'done' : step.passed ? 'passed' : step.key === nextKey ? 'next' : '';
}

/**
 * Breathing room before a "Start at" plan begins. Assumption (no source): 15 minutes to get flour,
 * water and the scale out. The default start is at least this far ahead, rounded up to a quarter hour.
 */
export const START_LEAD_MIN = 15;

export function defaultStart(now: Date = new Date()): Date {
  const d = new Date(now.getTime() + START_LEAD_MIN * 60_000);
  const q = Math.ceil((d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)) / 15) * 15;
  d.setMinutes(q, 0, 0);
  return d;
}

export const START_WHEN_READY = 'Start when you’re ready';

/**
 * Text under a checklist step's name. Before anything is ticked, the first step has no fixed clock:
 * the batch starts when you tap Done, and every later step follows from that.
 */
export function stepTimeText(
  step: DisplayStep & { at: Date },
  isFirstUntouched: boolean,
  fmt: (d: Date) => string,
): string {
  if (step.doneAt) return `Done ${fmt(step.doneAt)}`;
  if (step.passed) return 'Not ticked';
  if (isFirstUntouched) return START_WHEN_READY;
  return fmt(step.at);
}

export const TIMING_HINTS: Record<TimingMode, string> = {
  eat: 'Dinner time is fixed. Work back to the first step.',
  start: 'Start time is fixed. See when you can eat.',
  both: 'Set both times. See whether this dough fits.',
};

/** Preserve status precedence even if an old batch still has reminders enabled. */
export function reminderStatus(permission: Permission, remindersEnabled: boolean): string {
  return permission === 'unsupported'
    ? 'This browser can’t show reminders. On iPhone, add the app to your home screen first.'
    : permission === 'not-set-up'
      ? 'Reminders aren’t set up on the server yet.'
      : permission === 'denied'
        ? 'Notifications are blocked. Allow them in your phone’s settings.'
        : remindersEnabled
          ? 'Your phone buzzes at each step, even with the app closed.'
          : 'A notification at each step, even with the app closed.';
}

export const HOME_SCREEN_HELP = 'On iPhone with iOS 16.4 or later: open Safari’s Share menu, choose Add to Home Screen, then open Dough from that icon. Tap Remind me and allow notifications.';
export const READY_WINDOW_SOURCE = 'Same yeast throughout (FWSY p.219).';

export function infoLabel(open: boolean, label: string): string {
  return `${open ? 'Hide' : 'Explain'} ${label}`;
}

export const BATCH_TARGETS = {
  steps: 'batch-steps',
  recipe: 'batch-recipe',
  rating: 'batch-rating',
  result: 'batch-result',
} as const;

export type BatchTarget = typeof BATCH_TARGETS[keyof typeof BATCH_TARGETS];

/** Focus first, then align the section so fallback focus cannot undo the offset. */
export function jumpTo(id: BatchTarget): void {
  const section = document.getElementById(id);
  if (!section) return;
  try {
    section.focus({ preventScroll: true });
  } catch {
    section.focus();
  }
  section.scrollIntoView({ block: 'start', behavior: 'auto' });
}
