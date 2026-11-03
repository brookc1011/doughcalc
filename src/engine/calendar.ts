import type { Step } from './schedule';

// Calendar export replaces in-app reminders: a closed web app on Android cannot reliably
// fire its own notifications, but the phone's calendar can.

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** One .ics file with every step as a 15-minute event and a reminder at start time. */
export function stepsToIcs(steps: Step[], title: string, uidSeed: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dough-app//EN', 'CALSCALE:GREGORIAN'];
  steps.forEach((s, i) => {
    const end = new Date(s.at.getTime() + 15 * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidSeed}-${i}@dough-app`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(s.at)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${esc(`${title}: ${s.label}`)}`,
      `DESCRIPTION:${esc(s.detail)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(s.label)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Google Calendar "add event" link for a single step. */
export function googleCalendarLink(step: Step, title: string): string {
  const end = new Date(step.at.getTime() + 15 * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${title}: ${step.label}`,
    dates: `${icsDate(step.at)}/${icsDate(end)}`,
    details: step.detail,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
