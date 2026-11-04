// Phone side of step reminders. The phone asks its push service (Google on Android, Apple on
// iPhone) for an address that reaches only this phone, then hands that address and the step times
// to our Cloudflare worker (worker/index.ts), which sends a push when each step is due.
// Nothing else leaves the phone: no recipe, no bake history, no name.
import { VAPID_PUBLIC_KEY } from './vapid';

export interface ReminderItem {
  at: string; // ISO
  title: string;
  body: string;
}

export type PushState = 'unsupported' | 'not-set-up' | 'default' | 'granted' | 'denied';

/** False on iPhone Safari until the app is added to the home screen (iOS 16.4+), and in old browsers. */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): PushState {
  if (!pushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'not-set-up';
  return Notification.permission;
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function subscription(askPermission: boolean): Promise<PushSubscriptionJSON> {
  if (!pushSupported()) throw new Error('This browser can’t show reminders. On iPhone, add the app to your home screen first.');
  if (!VAPID_PUBLIC_KEY) throw new Error('Reminders aren’t set up on the server yet.');
  let perm = Notification.permission;
  if (perm === 'default' && askPermission) perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked for this app. Allow them in your phone’s settings.');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  return sub.toJSON();
}

async function call(method: 'POST' | 'DELETE', body: unknown): Promise<void> {
  const res = await fetch('/api/schedule', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Reminder server said ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function scheduleReminders(r: {
  deviceId: string;
  batchId: string;
  items: ReminderItem[];
  askPermission: boolean;
}): Promise<void> {
  const sub = await subscription(r.askPermission);
  await call('POST', { deviceId: r.deviceId, batchId: r.batchId, subscription: sub, items: r.items });
}

export async function cancelReminders(deviceId: string, batchId: string): Promise<void> {
  await call('DELETE', { deviceId, batchId });
}
