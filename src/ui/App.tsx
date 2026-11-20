import { useEffect, useRef, useState } from 'react';
import { productOf, type Product, getSettings, requestPersistence, retryReminders, type Batch, type Settings } from '../api';
import { BatchScreen } from './BatchScreen';
import { DoughEditor, DoughsScreen } from './DoughsScreen';
import { HistoryScreen } from './HistoryScreen';
import { PlanScreen } from './PlanScreen';
import { SettingsScreen } from './SettingsScreen';

type RepeatBake = Pick<Batch['planned'], 'formula' | 'balls' | 'mixer' | 'yeastType' | 'flour' | 'coldBulk'>;

export type Route =
  | { name: 'plan'; fromBatch?: string; repeat?: RepeatBake }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'batch'; id: string }
  | { name: 'doughs'; fromPlan?: boolean }
  | { name: 'dough'; id: string; fromPlan?: boolean };

const same = (a?: Route, b?: Route) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

function fieldAndBarButton(target: EventTarget | null): HTMLElement | undefined {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !field.matches('input:not([type=file]), select, textarea')) return;
  if (target instanceof Element && target.closest(':is(.plan-action, .editor-action, .batch-jumps, nav.tabs) button')
      && window.matchMedia('(any-pointer: coarse)').matches) return field;
}

export function App() {
  const [product, setProduct] = useState<Product>(() => {
    try { return localStorage.getItem('plan-product') === 'bread' ? 'bread' : 'pizza'; }
    catch { return 'pizza'; }
  });
  useEffect(() => {
    try { localStorage.setItem('plan-product', product); } catch { /* Use the session preference. */ }
  }, [product]);
  const [route, setRoute] = useState<Route>({ name: 'plan' });
  const [settings, setSettings] = useState<Settings | null>(null);
  // Screens visited, mirrored in the browser history so Android's back swipe steps back through them.
  const stack = useRef<Route[]>([{ name: 'plan' }]);
  const idx = useRef(0);

  // Read before the history reset below drops it from the address.
  const openBatch = useRef(new URLSearchParams(location.search).get('batch'));

  useEffect(() => {
    history.replaceState({ idx: 0 }, '', location.pathname);
    const onPop = (e: PopStateEvent) => {
      const i = typeof e.state?.idx === 'number' ? e.state.idx : 0;
      idx.current = i;
      const dest = stack.current[i] ?? { name: 'plan' };
      if (dest.name === 'plan' && dest.repeat) setProduct(productOf(dest.repeat.formula));
      setRoute(dest);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  /** Open a screen. Going to the screen you just came from counts as going back. */
  const go = (r: Route) => {
    if (r.name === 'plan' && r.repeat) setProduct(productOf(r.repeat.formula));
    if (same(r, stack.current[idx.current])) return;
    if (same(r, stack.current[idx.current - 1])) {
      history.back();
      return;
    }
    idx.current += 1;
    stack.current = [...stack.current.slice(0, idx.current), r];
    history.pushState({ idx: idx.current }, '');
    setRoute(r);
  };

  // A tapped reminder opens its batch: ?batch=<id> on a cold start, or a message from the service worker.
  useEffect(() => {
    if (openBatch.current) go({ name: 'batch', id: openBatch.current });
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'open-batch' && typeof e.data.batchId === 'string') go({ name: 'batch', id: e.data.batchId });
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  // Reminder updates that failed offline: retry on start and whenever the phone reconnects.
  useEffect(() => {
    const retry = () => void retryReminders().catch(() => undefined);
    retry();
    addEventListener('online', retry);
    return () => removeEventListener('online', retry);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [route.name]);

  const reloadSettings = () => getSettings().then(setSettings);

  useEffect(() => {
    reloadSettings().then(async () => {
      const s = await getSettings();
      if (s.persisted === undefined) {
        await requestPersistence();
        await reloadSettings();
      }
    });
  }, []);

  if (!settings) return <p className="pad">Loading…</p>;

  return (
    <div className="app"
      onMouseDownCapture={(event) => {
        // On touch layouts, blurring a field moves these bars. Keep the pressed
        // button under the pointer until click has a confirmed target.
        if (fieldAndBarButton(event.target)) event.preventDefault();
      }}
      onClickCapture={(event) => fieldAndBarButton(event.target)?.blur()}
    >
      <main>
        {route.name === 'plan' && <PlanScreen key={product + (route.fromBatch ?? '')} product={product} chooseProduct={(next) => {
          if (next === product) return;
          if (route.repeat) go({ name: 'plan' });
          setProduct(next);
        }} repeat={route.repeat && productOf(route.repeat.formula) === product ? route.repeat : undefined} settings={settings} go={go} onSaved={reloadSettings} />}
        {route.name === 'history' && <HistoryScreen settings={settings} go={go} />}
        {route.name === 'settings' && <SettingsScreen settings={settings} onChange={reloadSettings} go={go} />}
        {route.name === 'doughs' && <DoughsScreen product={product} fromPlan={route.fromPlan} go={go} onChange={reloadSettings} />}
        {route.name === 'dough' && <DoughEditor fromPlan={route.fromPlan} product={product} key={route.id} id={route.id} go={go} onChange={reloadSettings} />}
        {route.name === 'batch' && (
          <BatchScreen id={route.id} settings={settings} go={go} onSaved={reloadSettings} />
        )}
      </main>
      <nav className="tabs" aria-label="Main navigation">
        <button aria-current={route.name === 'plan' ? 'page' : undefined} className={route.name === 'plan' ? 'on' : ''} onClick={() => { if (route.name !== 'plan') go({ name: 'plan' }); }}>
          Plan
        </button>
        <button
          aria-current={route.name === 'history' || route.name === 'batch' ? 'page' : undefined}
          className={route.name === 'history' || route.name === 'batch' ? 'on' : ''}
          onClick={() => go({ name: 'history' })}
        >
          Bakes
        </button>
        <button
          aria-current={['settings', 'doughs', 'dough'].includes(route.name) ? 'page' : undefined}
          className={['settings', 'doughs', 'dough'].includes(route.name) ? 'on' : ''}
          onClick={() => go({ name: 'settings' })}
        >
          Settings
        </button>
      </nav>
    </div>
  );
}
