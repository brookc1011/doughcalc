import { beforeAll, describe, expect, it } from 'vitest';
import { LIMITS, nextAlarm, parseKey, splitDue, validateIds, validateSchedule } from '../worker/logic';

describe('reading the VAPID private key secret', () => {
  // Web Crypto (built into Node and browsers) so the app's type check needs no Node typings.
  let jwk: JsonWebKey = {};
  let line = '';
  let want: JsonWebKey = {};
  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    line = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
    want = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d };
  });

  it('reads the line as printed by npm run vapid', () => expect(parseKey(line)).toEqual(want));
  it('ignores what a messy paste adds around it', () => {
    expect(parseKey(`${line}${line}`)).toEqual(want); // pasted twice
    expect(parseKey(`${line}\r\nThen close this window.`)).toEqual(want); // next output line came along
    expect(parseKey(`  ${line}  `)).toEqual(want);
    expect(parseKey(JSON.stringify(line))).toEqual(want); // wrapped in quotes
  });
  it('refuses something that is not a private P-256 key, without echoing it', () => {
    expect(() => parseKey('nothing here')).toThrow(/does not contain/);
    const pub = JSON.stringify({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y });
    expect(() => parseKey(pub)).toThrow(/not a private P-256 key/);
    try {
      parseKey(pub);
    } catch (e) {
      expect(String(e)).not.toContain(jwk.x as string);
    }
  });
});

const now = Date.parse('2026-11-04T12:00:00Z');
const good = () => ({
  deviceId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
  batchId: 'batch-abc123',
  subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: { p256dh: 'p', auth: 'a' } },
  items: [
    { at: '2026-11-04T20:00:00Z', title: 'Fold', body: 'One or two folds' },
    { at: '2026-11-04T13:00:00Z', title: 'Mix', body: 'Pincer and fold' },
  ],
});

describe('reminder server rules', () => {
  it('accepts a normal schedule and sorts it', () => {
    const v = validateSchedule(good(), now);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.items.map((i) => i.title)).toEqual(['Mix', 'Fold']);
  });

  it('rejects a bad device id, too many steps, far-future times and unknown push hosts', () => {
    expect(validateSchedule({ ...good(), deviceId: 'cj' }, now).ok).toBe(false);
    const many = { ...good(), items: Array.from({ length: LIMITS.itemsPerBatch + 1 }, () => good().items[0]) };
    expect(validateSchedule(many, now).ok).toBe(false);
    const far = { ...good(), items: [{ at: '2026-11-20T12:00:00Z', title: 'x', body: 'y' }] };
    expect(validateSchedule(far, now).ok).toBe(false);
    const evil = { ...good(), subscription: { ...good().subscription, endpoint: 'https://example.com/hook' } };
    expect(validateSchedule(evil, now).ok).toBe(false);
    expect(validateIds({ deviceId: good().deviceId, batchId: '../x' }).ok).toBe(false);
  });

  it('caps text length', () => {
    const long = { ...good(), items: [{ at: '2026-11-04T13:00:00Z', title: 'x'.repeat(500), body: 'y'.repeat(500) }] };
    const v = validateSchedule(long, now);
    expect(v.ok && v.value.items[0].title.length).toBe(LIMITS.textChars);
  });

  it('sends what is due (with a 30 s window) and keeps the rest', () => {
    const items = [
      { at: '2026-11-04T11:59:00Z', title: 'late', body: '' },
      { at: '2026-11-04T12:00:20Z', title: 'now', body: '' },
      { at: '2026-11-04T13:00:00Z', title: 'later', body: '' },
    ];
    const { due, later } = splitDue(items, now);
    expect(due.map((i) => i.title)).toEqual(['late', 'now']);
    expect(later.map((i) => i.title)).toEqual(['later']);
  });

  it('next alarm is the earliest pending step across batches', () => {
    expect(nextAlarm([])).toBeUndefined();
    expect(nextAlarm([[{ at: '2026-11-05T00:00:00Z', title: '', body: '' }], [{ at: '2026-11-04T18:00:00Z', title: '', body: '' }]])).toBe(
      Date.parse('2026-11-04T18:00:00Z'),
    );
  });
});
