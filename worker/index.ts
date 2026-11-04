// Reminder server for the Dough app (Cloudflare Worker + one Durable Object per phone).
// Static files are served by Cloudflare's asset handling; only /api/* reaches this code
// (wrangler.jsonc: assets.run_worker_first). Holds a phone's push address and step times, nothing else.
import { DurableObject } from 'cloudflare:workers';
import { buildPushHTTPRequest } from '@pushforge/builder';
import { LIMITS, nextAlarm, parseKey, splitDue, validateIds, validateSchedule, type Item, type Subscription } from './logic';

interface Env {
  REMINDERS: DurableObjectNamespace<Reminders>;
  /** Private VAPID key as JWK JSON. Cloudflare secret, set by CJ; never in git. */
  VAPID_PRIVATE_KEY?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/api/schedule') return json(404, { error: 'Not found' });
    if (req.method !== 'POST' && req.method !== 'DELETE') return json(405, { error: 'Method not allowed' });
    if (!env.VAPID_PRIVATE_KEY) return json(503, { error: 'Reminders are not set up on the server yet.' });

    const text = await req.text();
    if (text.length > LIMITS.bodyBytes) return json(413, { error: 'Too big.' });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: 'Body must be JSON.' });
    }

    if (req.method === 'DELETE') {
      const ids = validateIds(body);
      if (!ids.ok) return json(400, { error: ids.error });
      await env.REMINDERS.get(env.REMINDERS.idFromName(ids.value.deviceId)).cancel(ids.value.batchId);
      return json(200, { ok: true });
    }

    const v = validateSchedule(body, Date.now());
    if (!v.ok) return json(400, { error: v.error });
    const stub = env.REMINDERS.get(env.REMINDERS.idFromName(v.value.deviceId));
    const err = await stub.schedule(v.value.batchId, v.value.subscription, v.value.items, url.origin);
    return err ? json(400, { error: err }) : json(200, { ok: true });
  },
};

/** One phone's slot: its push address, its batches' pending steps, one alarm for the next one. */
export class Reminders extends DurableObject<Env> {
  async schedule(batchId: string, sub: Subscription, items: Item[], origin: string): Promise<string | undefined> {
    const batches = await this.ctx.storage.list<Item[]>({ prefix: 'batch:' });
    if (!batches.has(`batch:${batchId}`) && batches.size >= LIMITS.batchesPerDevice) {
      return `At most ${LIMITS.batchesPerDevice} batches with reminders at once.`;
    }
    await this.ctx.storage.put({ sub, origin, [`batch:${batchId}`]: items });
    await this.rearm();
    return undefined;
  }

  async cancel(batchId: string): Promise<void> {
    await this.ctx.storage.delete(`batch:${batchId}`);
    await this.rearm();
  }

  async alarm(): Promise<void> {
    const sub = await this.ctx.storage.get<Subscription>('sub');
    const origin = (await this.ctx.storage.get<string>('origin')) ?? 'https://example.invalid';
    const batches = await this.ctx.storage.list<Item[]>({ prefix: 'batch:' });
    const now = Date.now();
    for (const [key, items] of batches) {
      const { due, later } = splitDue(items, now);
      for (const item of due) {
        let alive = true;
        try {
          alive = !!sub && (await this.send(sub, item, key.slice(6), origin));
        } catch (e) {
          // Bad key or push-service hiccup: log and drop this one step rather than retry-looping the alarm.
          console.error('Reminder send failed:', (e as Error).message);
        }
        if (!alive) {
          await this.ctx.storage.deleteAll(); // phone unsubscribed or app removed: drop the whole slot
          return;
        }
      }
      if (later.length) await this.ctx.storage.put(key, later);
      else await this.ctx.storage.delete(key);
    }
    await this.rearm();
  }

  /** False when the push service says this phone's address is gone (404/410). */
  private async send(sub: Subscription, item: Item, batchId: string, origin: string): Promise<boolean> {
    const req = await buildPushHTTPRequest({
      privateJWK: parseKey(this.env.VAPID_PRIVATE_KEY!),
      subscription: sub,
      message: {
        payload: { title: item.title, body: item.body, batchId, at: item.at },
        adminContact: origin,
        options: { ttl: 3600, urgency: 'high', topic: `step-${batchId}`.replace(/[^\w-]/g, '').slice(0, 32) },
      },
    });
    const res = await fetch(req.endpoint, { method: 'POST', headers: req.headers, body: req.body });
    if (!res.ok) console.error(`Push service answered ${res.status} for ${new URL(sub.endpoint).hostname}`);
    return res.status !== 404 && res.status !== 410;
  }

  private async rearm(): Promise<void> {
    const batches = await this.ctx.storage.list<Item[]>({ prefix: 'batch:' });
    const next = nextAlarm([...batches.values()]);
    if (next === undefined) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }
}
