// Pure rules for the reminder server: what a phone may send, and what is due. No Cloudflare APIs
// here, so tests/worker.test.ts can run it under Vitest.

export interface Item {
  at: string; // ISO time the step is due
  title: string;
  body: string;
}

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface ScheduleBody {
  deviceId: string;
  batchId: string;
  subscription: Subscription;
  items: Item[];
}

/** Limits, because the link is shared with friends and the endpoint is public. */
export const LIMITS = {
  bodyBytes: 8 * 1024,
  batchesPerDevice: 5,
  itemsPerBatch: 20,
  textChars: 120,
  horizonMs: 7 * 24 * 3600_000,
  /** Send anything due within this window in one alarm run. */
  dueWindowMs: 30_000,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BATCH_ID = /^[\w-]{1,64}$/;
/** Push services the browsers use. Anything else is refused, so the server can't be aimed elsewhere. */
const PUSH_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.apple\.com$/,
];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function validateIds(body: unknown): Result<{ deviceId: string; batchId: string }> {
  const b = body as Partial<ScheduleBody> | null;
  if (!b || typeof b !== 'object') return fail('Body must be JSON.');
  if (typeof b.deviceId !== 'string' || !UUID.test(b.deviceId)) return fail('Bad deviceId.');
  if (typeof b.batchId !== 'string' || !BATCH_ID.test(b.batchId)) return fail('Bad batchId.');
  return { ok: true, value: { deviceId: b.deviceId, batchId: b.batchId } };
}

export function validateSchedule(body: unknown, now: number): Result<ScheduleBody> {
  const ids = validateIds(body);
  if (!ids.ok) return ids;
  const b = body as ScheduleBody;

  const s = b.subscription;
  if (!s || typeof s.endpoint !== 'string' || typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') {
    return fail('Bad subscription.');
  }
  let host: string;
  try {
    const u = new URL(s.endpoint);
    if (u.protocol !== 'https:') return fail('Bad subscription.');
    host = u.hostname;
  } catch {
    return fail('Bad subscription.');
  }
  if (!PUSH_HOSTS.some((h) => h.test(host))) return fail('Unknown push service.');

  if (!Array.isArray(b.items) || b.items.length === 0) return fail('No items.');
  if (b.items.length > LIMITS.itemsPerBatch) return fail(`At most ${LIMITS.itemsPerBatch} steps.`);
  const items: Item[] = [];
  for (const i of b.items) {
    const t = typeof i?.at === 'string' ? Date.parse(i.at) : NaN;
    if (Number.isNaN(t)) return fail('Bad time.');
    if (t > now + LIMITS.horizonMs) return fail('Too far ahead.');
    if (typeof i.title !== 'string' || typeof i.body !== 'string') return fail('Bad text.');
    items.push({
      at: new Date(t).toISOString(),
      title: i.title.slice(0, LIMITS.textChars),
      body: i.body.slice(0, LIMITS.textChars),
    });
  }
  return {
    ok: true,
    value: {
      deviceId: b.deviceId,
      batchId: b.batchId,
      subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
      items: items.sort((a, c) => Date.parse(a.at) - Date.parse(c.at)),
    },
  };
}

/**
 * The VAPID private key secret is a JWK as JSON. Pasting it into a terminal prompt or the dashboard can add
 * things around it (quotes, a second copy, the next line of output), so take the first {...} object in it
 * and check it really is a private EC key. Never echoes the value in errors.
 */
export function parseKey(raw: string): JsonWebKey {
  const text = raw.trim();
  let candidate = text;
  try {
    const once = JSON.parse(text);
    if (typeof once === 'string') candidate = once; // pasted with extra quotes around it
  } catch {
    // not plain JSON: fall through to pulling out the first object
  }
  const obj = /\{[^{}]*\}/.exec(candidate)?.[0];
  if (!obj) throw new Error('VAPID_PRIVATE_KEY does not contain a JSON key.');
  let key: unknown;
  try {
    key = JSON.parse(obj);
  } catch {
    throw new Error('VAPID_PRIVATE_KEY could not be read as JSON.');
  }
  const k = key as Record<string, unknown>;
  if (k.kty !== 'EC' || k.crv !== 'P-256' || typeof k.d !== 'string' || typeof k.x !== 'string' || typeof k.y !== 'string') {
    throw new Error('VAPID_PRIVATE_KEY is not a private P-256 key.');
  }
  return { kty: 'EC', crv: 'P-256', x: k.x, y: k.y, d: k.d };
}

/** Split one batch's items into those to send now and those to keep. */
export function splitDue(items: Item[], now: number): { due: Item[]; later: Item[] } {
  const cut = now + LIMITS.dueWindowMs;
  return {
    due: items.filter((i) => Date.parse(i.at) <= cut),
    later: items.filter((i) => Date.parse(i.at) > cut),
  };
}

/** Earliest pending time across all batches, or undefined when nothing is left. */
export function nextAlarm(batches: Item[][]): number | undefined {
  const times = batches.flat().map((i) => Date.parse(i.at));
  return times.length ? Math.min(...times) : undefined;
}
